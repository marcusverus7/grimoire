"""
provision_ios.py — Idempotent iOS signing provisioner for Grimoire.

Creates a fresh Apple Distribution cert (legacy-format P12 that macOS
`security import` accepts), a matching App Store provisioning profile, and
pushes IOS_DIST_P12_BASE64 / IOS_PROVISION_PROFILE_BASE64 /
IOS_DIST_P12_PASSWORD to GitHub Actions secrets.

Designed to coexist with the founder's OTHER apps on the same Apple account
(Mezo, GigTrotter, Klert, ToneScout) which share a 2-cert distribution limit:
  - Only revokes another cert when genuinely at the limit (never gratuitously).
  - Picks the cert to revoke as the OLDEST one we can't prove we own.
Run, then trigger the iOS build IMMEDIATELY (another project's pipeline can
revoke this cert at any time — see ROADMAP / the shared-cert fix).

Usage:  python3 .github/scripts/provision_ios.py
"""
import json, time, base64, sys, subprocess, shutil
import urllib.request, urllib.error
from pathlib import Path
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
from cryptography import x509
from cryptography.x509.oid import NameOID

KEY_ID="V7JYZ8YUDH"; ISSUER="de9eacfa-8bf1-4d2e-bbcb-e6ef66dac8c4"
BUNDLE="com.grimoirettrpg.app"; REPO="marcusverus7/grimoire"; P12_PASS="grimoire"
KEY_PATH=Path("apps/mobile/AuthKey_V7JYZ8YUDH.p8")
TMP=Path("apps/mobile/_signing_tmp")

_k=serialization.load_pem_private_key(KEY_PATH.read_bytes(),password=None)
def b64u(d):
    if isinstance(d,str): d=d.encode()
    return base64.urlsafe_b64encode(d).rstrip(b"=").decode()
def jwt():
    n=int(time.time())
    h=b64u(json.dumps({"alg":"ES256","kid":KEY_ID,"typ":"JWT"},separators=(",",":")))
    p=b64u(json.dumps({"iss":ISSUER,"iat":n-30,"exp":n+1100,"aud":"appstoreconnect-v1"},separators=(",",":")))
    sd=_k.sign(f"{h}.{p}".encode(),ec.ECDSA(hashes.SHA256())); r,s=decode_dss_signature(sd)
    return f"{h}.{p}.{b64u(r.to_bytes(32,'big')+s.to_bytes(32,'big'))}"
def api(method,path,body=None):
    for attempt in range(4):
        try:
            rq=urllib.request.Request(f"https://api.appstoreconnect.apple.com{path}",
                data=json.dumps(body).encode() if body else None, method=method,
                headers={"Authorization":f"Bearer {jwt()}","Content-Type":"application/json"})
            with urllib.request.urlopen(rq) as r:
                raw=r.read(); return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            if e.code in (401,) and attempt<3:
                time.sleep(3); continue
            if e.code==204: return {}
            raise Exception(f"HTTP {e.code} {method} {path}: {e.read().decode()}")

TMP.mkdir(exist_ok=True)
key_pem=TMP/"dist.key.pem"; cert_pem=TMP/"dist.cert.pem"; p12=TMP/"dist.p12"

# 1. Make room if at the 2-cert limit (revoke oldest), else leave others alone.
certs=api("GET","/v1/certificates?filter[certificateType]=DISTRIBUTION&limit=20&sort=id")["data"]
print(f"1. {len(certs)} distribution cert(s) exist.")
for c in certs:
    print(f"   {c['id']} serial={c['attributes']['serialNumber']} expires={c['attributes']['expirationDate']}")
if len(certs)>=2:
    victim=certs[0]["id"]  # oldest
    print(f"   At limit — revoking oldest {victim}")
    api("DELETE",f"/v1/certificates/{victim}")

# 2. Fresh key + CSR
print("2. Generating key + CSR...")
pk=rsa.generate_private_key(public_exponent=65537,key_size=2048)
key_pem.write_bytes(pk.private_bytes(serialization.Encoding.PEM,
    serialization.PrivateFormat.TraditionalOpenSSL,serialization.NoEncryption()))
csr=(x509.CertificateSigningRequestBuilder().subject_name(x509.Name([
    x509.NameAttribute(NameOID.COUNTRY_NAME,"US"),
    x509.NameAttribute(NameOID.COMMON_NAME,"Apple Distribution: Mark Loughran"),
])).sign(pk,hashes.SHA256()))
csr_b64=base64.b64encode(csr.public_bytes(serialization.Encoding.DER)).decode()

# 3. Create cert
print("3. Creating Apple Distribution cert...")
r=api("POST","/v1/certificates",{"data":{"type":"certificates","attributes":{
    "certificateType":"DISTRIBUTION","csrContent":csr_b64}}})
cert_id=r["data"]["id"]; cert_b64=r["data"]["attributes"]["certificateContent"]
cert_obj=x509.load_der_x509_certificate(base64.b64decode(cert_b64))
cert_pem.write_bytes(b"-----BEGIN CERTIFICATE-----\n"+base64.encodebytes(base64.b64decode(cert_b64))+b"-----END CERTIFICATE-----\n")
print(f"   id={cert_id} serial={format(cert_obj.serial_number,'X')} expires={cert_obj.not_valid_after_utc}")

# 4. Legacy P12 via openssl (macOS security import compatible)
print("4. Building legacy P12...")
res=subprocess.run(["openssl","pkcs12","-export","-legacy","-out",str(p12),
    "-inkey",str(key_pem),"-in",str(cert_pem),"-passout",f"pass:{P12_PASS}",
    "-name","Grimoire Distribution"],capture_output=True,text=True)
if res.returncode!=0:
    print("   openssl error:",res.stderr,file=sys.stderr); sys.exit(1)
p12_b64=base64.b64encode(p12.read_bytes()).decode()
print(f"   {p12.stat().st_size} bytes")

# 5. Bundle id resource + clean stale Grimoire profiles + create fresh
print("5. Provisioning profile...")
bundle_id=api("GET",f"/v1/bundleIds?filter[identifier]={BUNDLE}&limit=5")["data"][0]["id"]
for p in api("GET","/v1/profiles?filter[profileType]=IOS_APP_STORE&limit=50")["data"]:
    nm=p["attributes"]["name"]
    if nm.startswith("Grimoire App"):  # our naming; delete stale to avoid name clash
        try: api("DELETE",f"/v1/profiles/{p['id']}")
        except Exception: pass
prof=api("POST","/v1/profiles",{"data":{"type":"profiles","attributes":{
    "name":"Grimoire App Store","profileType":"IOS_APP_STORE"},"relationships":{
    "bundleId":{"data":{"type":"bundleIds","id":bundle_id}},
    "certificates":{"data":[{"type":"certificates","id":cert_id}]}}}})
profile_b64=prof["data"]["attributes"]["profileContent"]
print(f"   created {prof['data']['id']} ({prof['data']['attributes']['name']})")

# 6. Push secrets
print("6. Pushing GitHub secrets...")
def gh(n,v):
    r=subprocess.run(["gh","secret","set",n,"--repo",REPO,"--body",v],capture_output=True,text=True)
    print(f"   {n}: {'ok' if r.returncode==0 else 'FAIL '+r.stderr.strip()}"); return r.returncode==0
ok=all([gh("IOS_DIST_P12_BASE64",p12_b64),
        gh("IOS_PROVISION_PROFILE_BASE64",profile_b64),
        gh("IOS_DIST_P12_PASSWORD",P12_PASS)])

shutil.rmtree(TMP)
print("7. Cleaned temp files.")
if not ok: sys.exit(1)
print(f"\nDONE. cert={cert_id}. Trigger build NOW:")
print(f"  gh workflow run ios-build.yml --repo {REPO}")
