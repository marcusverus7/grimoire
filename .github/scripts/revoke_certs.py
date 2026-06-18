#!/usr/bin/env python3
"""Revoke all Distribution certificates via ASC API to stay within Apple's 2-cert limit."""
import json, time, base64, os, sys
import urllib.request, urllib.error

try:
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
    from cryptography.hazmat.primitives.asymmetric import ec
except ImportError as e:
    print(f"ERROR: cryptography package not available: {e}")
    sys.exit(1)

KEY_ID = os.environ.get('APP_STORE_CONNECT_KEY_IDENTIFIER', '')
ISSUER = os.environ.get('APP_STORE_CONNECT_ISSUER_ID', '')
KEY_PEM = os.environ.get('APP_STORE_CONNECT_PRIVATE_KEY', '')

if not KEY_ID or not ISSUER or not KEY_PEM:
    print("ERROR: Missing ASC env vars")
    sys.exit(1)

private_key = serialization.load_pem_private_key(KEY_PEM.encode(), password=None)


def b64url(data):
    if isinstance(data, str):
        data = data.encode()
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()


def make_jwt():
    now = int(time.time())
    h = b64url(json.dumps({"alg": "ES256", "kid": KEY_ID, "typ": "JWT"}, separators=(',', ':')))
    p = b64url(json.dumps({"iss": ISSUER, "iat": now, "exp": now + 1200, "aud": "appstoreconnect-v1"}, separators=(',', ':')))
    sig_der = private_key.sign(f"{h}.{p}".encode(), ec.ECDSA(hashes.SHA256()))
    r, s = decode_dss_signature(sig_der)
    sig = b64url(r.to_bytes(32, 'big') + s.to_bytes(32, 'big'))
    return f"{h}.{p}.{sig}"


# List Distribution certs
print("Listing Distribution certificates...")
req = urllib.request.Request(
    "https://api.appstoreconnect.apple.com/v1/certificates?filter[certificateType]=DISTRIBUTION&limit=25",
    headers={"Authorization": f"Bearer {make_jwt()}"}
)
try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
except urllib.error.HTTPError as e:
    print(f"ERROR listing certs: HTTP {e.code} - {e.read().decode()}")
    sys.exit(1)

cert_ids = [c['id'] for c in data.get('data', [])]
print(f"Found {len(cert_ids)} Distribution cert(s): {cert_ids}")

if not cert_ids:
    print("No certs to revoke.")
    sys.exit(0)

# Revoke each cert
failed = 0
for cid in cert_ids:
    req = urllib.request.Request(
        f"https://api.appstoreconnect.apple.com/v1/certificates/{cid}",
        method='DELETE',
        headers={"Authorization": f"Bearer {make_jwt()}"}
    )
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"Revoked {cid}: HTTP {resp.status}")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"FAILED to revoke {cid}: HTTP {e.code} - {body}")
        failed += 1

if failed:
    print(f"WARNING: {failed} cert(s) could not be revoked — fetch-signing-files may still hit the limit")
else:
    print(f"Successfully revoked {len(cert_ids)} cert(s)")
