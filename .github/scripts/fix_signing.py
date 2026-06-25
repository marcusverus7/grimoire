"""
fix_signing.py — Regenerate iOS signing materials and update GitHub secrets.
Steps:
  1. Generate new RSA-2048 private key + CSR
  2. Create new Apple Distribution cert via ASC API (or use existing if --cert-id given)
  3. Bundle key + cert into a P12 (no password)
  4. Create new App Store provisioning profile for com.grimoirettrpg.app
  5. Update IOS_DIST_P12_BASE64, IOS_PROVISION_PROFILE_BASE64, IOS_DIST_P12_PASSWORD GitHub secrets

Usage:
  python3 fix_signing.py                        # creates new cert + profile
  python3 fix_signing.py --cert-id 63RTDJHPA3  # reuse existing cert (avoids 2-cert limit)
"""

import json, time, base64, os, sys, tempfile, subprocess, argparse
import urllib.request, urllib.error
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives.serialization import pkcs12

# ── CLI args ─────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser()
parser.add_argument("--cert-id", default=None, help="Reuse an existing cert ID (avoids creating a new one)")
args_cli = parser.parse_args()

# ── ASC credentials ──────────────────────────────────────────────────────────
KEY_ID   = "V7JYZ8YUDH"
ISSUER   = "de9eacfa-8bf1-4d2e-bbcb-e6ef66dac8c4"
APP_ID   = "6781072827"
BUNDLE   = "com.grimoirettrpg.app"
TEAM_ID  = "JQS67937W6"
REPO     = "marcusverus7/grimoire"
P12_PASS = b"grimoire"
KEY_PATH = Path("apps/mobile/AuthKey_V7JYZ8YUDH.p8")

# ── JWT auth ─────────────────────────────────────────────────────────────────
_asc_key = serialization.load_pem_private_key(KEY_PATH.read_bytes(), password=None)

def b64url(data):
    if isinstance(data, str): data = data.encode()
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def make_jwt():
    now = int(time.time())
    h = b64url(json.dumps({"alg":"ES256","kid":KEY_ID,"typ":"JWT"},separators=(',',':')))
    p = b64url(json.dumps({"iss":ISSUER,"iat":now,"exp":now+1200,"aud":"appstoreconnect-v1"},separators=(',',':')))
    sig_der = _asc_key.sign(f"{h}.{p}".encode(), ec.ECDSA(hashes.SHA256()))
    r, s = decode_dss_signature(sig_der)
    sig = b64url(r.to_bytes(32,'big') + s.to_bytes(32,'big'))
    return f"{h}.{p}.{sig}"

def api(method, path, body=None, ok204=False):
    token = make_jwt()
    url = f"https://api.appstoreconnect.apple.com{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method,
        headers={"Authorization": f"Bearer {token}",
                 "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            if not raw:
                return {}
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        if e.code == 204 or ok204:
            return {}
        print(f"  HTTP {e.code}: {e.read().decode()}", file=sys.stderr)
        raise

# ── Step 1: Generate RSA-2048 private key ────────────────────────────────────
print("Step 1: Generating RSA-2048 private key…")
private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
key_pem = private_key.private_bytes(
    serialization.Encoding.PEM,
    serialization.PrivateFormat.TraditionalOpenSSL,
    serialization.NoEncryption()
)
# Save the key immediately in case we crash later
key_save_path = Path("apps/mobile/dist_key_tmp.pem")
key_save_path.write_bytes(key_pem)
print(f"  Saved private key to {key_save_path} (delete after run)")
print("  Done.")

# ── Step 2: Generate CSR ─────────────────────────────────────────────────────
print("Step 2: Generating CSR…")
csr = (x509.CertificateSigningRequestBuilder()
    .subject_name(x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "US"),
        x509.NameAttribute(NameOID.COMMON_NAME, "Apple Distribution: Mark Loughran"),
    ]))
    .sign(private_key, hashes.SHA256())
)
csr_pem = csr.public_bytes(serialization.Encoding.PEM)
# ASC API wants the base64-encoded DER (i.e. the PEM body without header/footer lines)
csr_der = csr.public_bytes(serialization.Encoding.DER)
csr_b64 = base64.b64encode(csr_der).decode()
print("  Done.")

# ── Step 3: Create or fetch cert via ASC API ─────────────────────────────────
if args_cli.cert_id:
    print(f"Step 3: Fetching existing cert {args_cli.cert_id}…")
    resp = api("GET", f"/v1/certificates/{args_cli.cert_id}")
    cert_data = resp["data"]
    cert_id   = cert_data["id"]
    cert_name = cert_data["attributes"]["name"]
    cert_b64  = cert_data["attributes"]["certificateContent"]
    print(f"  Using: {cert_name} (id={cert_id})")
    cert_der = base64.b64decode(cert_b64)
    cert_obj = x509.load_der_x509_certificate(cert_der)
    print(f"  Expires: {cert_obj.not_valid_after_utc}")
else:
    print("Step 3: Creating Apple Distribution certificate via ASC API…")
    def create_cert():
        return api("POST", "/v1/certificates", {
            "data": {
                "type": "certificates",
                "attributes": {
                    "certificateType": "DISTRIBUTION",
                    "csrContent": csr_b64
                }
            }
        })
    try:
        resp = create_cert()
    except urllib.error.HTTPError as e:
        if e.code == 409:
            # At the 2-cert limit — revoke the most recently created one (no key for it)
            print("  At cert limit. Listing certs to find one to revoke…")
            all_certs = api("GET", "/v1/certificates?filter[certificateType]=DISTRIBUTION&limit=10&sort=-id")
            for c in all_certs["data"]:
                print(f"    Cert: {c['id']} {c['attributes']['name']} expires={c['attributes']['expirationDate']}")
            # Revoke the most recently created (first in sort=-id order) — we don't have its key
            to_revoke = all_certs["data"][0]["id"]
            print(f"  Revoking {to_revoke}…")
            api("DELETE", f"/v1/certificates/{to_revoke}", ok204=True)
            print("  Revoked. Retrying cert creation…")
            resp = create_cert()
        else:
            raise
    cert_data = resp["data"]
    cert_id   = cert_data["id"]
    cert_name = cert_data["attributes"]["name"]
    cert_b64  = cert_data["attributes"]["certificateContent"]
    print(f"  Created: {cert_name} (id={cert_id})")
    cert_der = base64.b64decode(cert_b64)
    cert_obj = x509.load_der_x509_certificate(cert_der)
    print(f"  Subject: {cert_obj.subject}")
    print(f"  Expires: {cert_obj.not_valid_after_utc}")

# ── Step 4: Build P12 ────────────────────────────────────────────────────────
print("Step 4: Building P12 bundle…")
p12_bytes = pkcs12.serialize_key_and_certificates(
    name=b"Grimoire Distribution",
    key=private_key,
    cert=cert_obj,
    cas=None,
    encryption_algorithm=serialization.BestAvailableEncryption(P12_PASS)
)
p12_b64 = base64.b64encode(p12_bytes).decode()
print(f"  P12 size: {len(p12_bytes)} bytes")

# ── Step 5: Get bundle ID ─────────────────────────────────────────────────────
print("Step 5: Looking up bundle ID resource…")
bundle_resp = api("GET", f"/v1/bundleIds?filter[identifier]={BUNDLE}&limit=5")
bundle_id = bundle_resp["data"][0]["id"]
print(f"  Bundle ID resource: {bundle_id}")

# ── Step 6: Create new provisioning profile ───────────────────────────────────
# For IOS_APP_STORE profiles, devices are NOT included (distribution, not ad-hoc).
print("Step 6: Creating new App Store provisioning profile…")
new_profile = api("POST", "/v1/profiles", {
    "data": {
        "type": "profiles",
        "attributes": {
            "name": "Grimoire AppStore",
            "profileType": "IOS_APP_STORE"
        },
        "relationships": {
            "bundleId": {"data": {"type": "bundleIds", "id": bundle_id}},
            "certificates": {"data": [{"type": "certificates", "id": cert_id}]}
        }
    }
})
profile_content_b64 = new_profile["data"]["attributes"]["profileContent"]
profile_b64 = profile_content_b64  # already base64
profile_name = new_profile["data"]["attributes"]["name"]
profile_id = new_profile["data"]["id"]
print(f"  Created profile: {profile_name} ({profile_id})")

# ── Step 7: Update GitHub secrets ────────────────────────────────────────────
print("Step 7: Updating GitHub secrets…")

def gh_secret(name, value):
    result = subprocess.run(
        ["gh", "secret", "set", name, "--repo", REPO, "--body", value],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"  ERROR setting {name}: {result.stderr}", file=sys.stderr)
        return False
    print(f"  Set {name} ok")
    return True

ok1 = gh_secret("IOS_DIST_P12_BASE64", p12_b64)
ok2 = gh_secret("IOS_PROVISION_PROFILE_BASE64", profile_b64)
ok3 = gh_secret("IOS_DIST_P12_PASSWORD", P12_PASS.decode())

if ok1 and ok2 and ok3:
    print("\nAll secrets updated. Ready to trigger build.")
else:
    print("\nSome secrets failed — check above.", file=sys.stderr)
    sys.exit(1)

# Clean up temp key file
if key_save_path.exists():
    key_save_path.unlink()
    print("  Cleaned up temp key file.")
