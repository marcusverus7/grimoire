"""
make_legacy_p12.py — Create legacy-format P12 using openssl (macOS-compatible).
1. Revoke keyless cert RB2WZDUX84
2. Generate new RSA key + CSR
3. Create new Apple Distribution cert
4. Save key + cert as PEM files
5. Use `openssl pkcs12 -legacy -export` to build macOS-compatible P12
6. Fetch provisioning profile HPGKH26CT2
7. Push secrets
"""
import json, time, base64, sys, subprocess, os
import urllib.request, urllib.error
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
from cryptography.hazmat.primitives.asymmetric import rsa, ec
from cryptography import x509
from cryptography.x509.oid import NameOID

KEY_ID     = "V7JYZ8YUDH"
ISSUER     = "de9eacfa-8bf1-4d2e-bbcb-e6ef66dac8c4"
BUNDLE     = "com.grimoirettrpg.app"
REPO       = "marcusverus7/grimoire"
PROFILE_ID = "HPGKH26CT2"
P12_PASS   = "grimoire"
KEY_PATH   = Path("apps/mobile/AuthKey_V7JYZ8YUDH.p8")
TMP        = Path("apps/mobile/_signing_tmp")

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
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        if e.code == 204 or ok204:
            return {}
        print(f"  HTTP {e.code}: {e.read().decode()}", file=sys.stderr)
        raise

TMP.mkdir(exist_ok=True)
key_pem_path  = TMP / "dist.key.pem"
cert_pem_path = TMP / "dist.cert.pem"
p12_path      = TMP / "dist.p12"

# 1. Revoke keyless cert RB2WZDUX84
print("1. Revoking keyless cert RB2WZDUX84...")
api("DELETE", "/v1/certificates/RB2WZDUX84", ok204=True)
print("   Done.")

# 2. Generate new key
print("2. Generating RSA-2048 private key...")
private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
key_pem = private_key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption())
key_pem_path.write_bytes(key_pem)
print(f"   Saved: {key_pem_path}")

# 3. Generate CSR
print("3. Generating CSR...")
csr = (x509.CertificateSigningRequestBuilder()
    .subject_name(x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "US"),
        x509.NameAttribute(NameOID.COMMON_NAME, "Apple Distribution: Mark Loughran"),
    ]))
    .sign(private_key, hashes.SHA256())
)
csr_der = csr.public_bytes(serialization.Encoding.DER)
csr_b64 = base64.b64encode(csr_der).decode()
print("   Done.")

# 4. Create new Apple Distribution cert
print("4. Creating Apple Distribution cert via ASC API...")
resp = api("POST", "/v1/certificates", {
    "data": {
        "type": "certificates",
        "attributes": {"certificateType": "DISTRIBUTION", "csrContent": csr_b64}
    }
})
cert_id   = resp["data"]["id"]
cert_name = resp["data"]["attributes"]["name"]
cert_b64  = resp["data"]["attributes"]["certificateContent"]
cert_der  = base64.b64decode(cert_b64)
print(f"   Created: {cert_name} id={cert_id}")

# Save cert as PEM for openssl
cert_pem = b"-----BEGIN CERTIFICATE-----\n" + base64.encodebytes(cert_der) + b"-----END CERTIFICATE-----\n"
cert_pem_path.write_bytes(cert_pem)
print(f"   Saved: {cert_pem_path}")

# 5. Create legacy P12 via openssl
print("5. Building legacy P12 via openssl...")
result = subprocess.run([
    "openssl", "pkcs12", "-export", "-legacy",
    "-out", str(p12_path),
    "-inkey", str(key_pem_path),
    "-in", str(cert_pem_path),
    "-passout", f"pass:{P12_PASS}",
    "-name", "Grimoire Distribution"
], capture_output=True, text=True)
if result.returncode != 0:
    print(f"   openssl error: {result.stderr}", file=sys.stderr)
    sys.exit(1)
print(f"   P12 size: {p12_path.stat().st_size} bytes")

p12_b64 = base64.b64encode(p12_path.read_bytes()).decode()

# 6. Fetch provisioning profile
print(f"6. Fetching profile {PROFILE_ID}...")
profile_b64 = api("GET", f"/v1/profiles/{PROFILE_ID}")["data"]["attributes"]["profileContent"]
print("   Done.")

# 7. Push secrets
print("7. Pushing secrets...")
def gh(name, value):
    r = subprocess.run(["gh", "secret", "set", name, "--repo", REPO, "--body", value],
        capture_output=True, text=True)
    ok = r.returncode == 0
    print(f"   {name}: {'ok' if ok else 'FAIL ' + r.stderr.strip()}")
    return ok

ok = all([
    gh("IOS_DIST_P12_BASE64", p12_b64),
    gh("IOS_PROVISION_PROFILE_BASE64", profile_b64),
    gh("IOS_DIST_P12_PASSWORD", P12_PASS),
])

# 8. Clean up
import shutil
shutil.rmtree(TMP)
print("8. Cleaned up temp files.")

if ok:
    print(f"\nAll done. Cert ID: {cert_id}")
    print("Trigger build: gh workflow run ios-build.yml --repo", REPO)
else:
    sys.exit(1)
