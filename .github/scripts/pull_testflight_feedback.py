#!/usr/bin/env python3
"""Pull TestFlight tester feedback (screenshots + comments + crashes) via the
App Store Connect API, download the images, and write a markdown summary.

Reads credentials from eas.json defaults (overridable via env vars):
  ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH, ASC_APP_ID

Usage:
  python pull_testflight_feedback.py [--limit 50] [--out DIR]

Output:
  <out>/SUMMARY.md           human-readable index of every submission
  <out>/screenshots/*.png    downloaded screenshot images
  <out>/raw.json             full API response for debugging
"""
import argparse, base64, json, os, sys, time
from pathlib import Path
import urllib.request, urllib.error

try:
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
    from cryptography.hazmat.primitives.asymmetric import ec
except ImportError as e:
    print(f"ERROR: cryptography package not available: {e}")
    sys.exit(1)

# --- Defaults sourced from apps/mobile/eas.json (overridable via env) ---
HERE = Path(__file__).resolve()
REPO = HERE.parents[2]  # .github/scripts -> repo root
MOBILE = REPO / "apps" / "mobile"

KEY_ID = os.environ.get("ASC_KEY_ID", "V7JYZ8YUDH")
ISSUER = os.environ.get("ASC_ISSUER_ID", "de9eacfa-8bf1-4d2e-bbcb-e6ef66dac8c4")
KEY_PATH = os.environ.get("ASC_KEY_PATH", str(MOBILE / f"AuthKey_{KEY_ID}.p8"))
APP_ID = os.environ.get("ASC_APP_ID", "6781072827")

API = "https://api.appstoreconnect.apple.com/v1"


def b64url(data):
    if isinstance(data, str):
        data = data.encode()
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def make_jwt(private_key):
    now = int(time.time())
    h = b64url(json.dumps({"alg": "ES256", "kid": KEY_ID, "typ": "JWT"}, separators=(",", ":")))
    p = b64url(json.dumps({"iss": ISSUER, "iat": now, "exp": now + 1200, "aud": "appstoreconnect-v1"}, separators=(",", ":")))
    sig_der = private_key.sign(f"{h}.{p}".encode(), ec.ECDSA(hashes.SHA256()))
    r, s = decode_dss_signature(sig_der)
    sig = b64url(r.to_bytes(32, "big") + s.to_bytes(32, "big"))
    return f"{h}.{p}.{sig}"


def api_get(path, token):
    url = path if path.startswith("http") else f"{API}{path}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"ERROR GET {url}: HTTP {e.code}\n{body}")
        return None


def find_image_urls(obj):
    """Recursively collect any http(s) URLs found under 'url' keys."""
    urls = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "url" and isinstance(v, str) and v.startswith("http"):
                urls.append(v)
            else:
                urls.extend(find_image_urls(v))
    elif isinstance(obj, list):
        for item in obj:
            urls.extend(find_image_urls(item))
    return urls


def download(url, dest):
    try:
        with urllib.request.urlopen(url) as resp:
            dest.write_bytes(resp.read())
        return True
    except Exception as e:
        print(f"  ! failed to download {url[:60]}...: {e}")
        return False


def build_tester_map(payload):
    """Map included betaTester id -> display string."""
    m = {}
    for inc in payload.get("included", []):
        if inc.get("type") == "betaTesters":
            a = inc.get("attributes", {})
            name = " ".join(filter(None, [a.get("firstName"), a.get("lastName")])) or "(unknown)"
            email = a.get("email", "")
            m[inc["id"]] = f"{name} <{email}>" if email else name
        elif inc.get("type") == "builds":
            a = inc.get("attributes", {})
            m[inc["id"]] = f"build {a.get('version', '?')}"
    return m


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=50)
    ap.add_argument("--out", default=str(REPO / "testflight-feedback"))
    args = ap.parse_args()

    if not Path(KEY_PATH).exists():
        print(f"ERROR: key file not found: {KEY_PATH}")
        sys.exit(1)

    private_key = serialization.load_pem_private_key(Path(KEY_PATH).read_bytes(), password=None)
    token = make_jwt(private_key)

    out = Path(args.out)
    shots_dir = out / "screenshots"
    shots_dir.mkdir(parents=True, exist_ok=True)

    print(f"App {APP_ID} — pulling up to {args.limit} feedback items per type...")

    screenshot_payload = api_get(
        f"/apps/{APP_ID}/betaFeedbackScreenshotSubmissions"
        f"?include=tester,build&sort=-createdDate&limit={args.limit}",
        token,
    )
    crash_payload = api_get(
        f"/apps/{APP_ID}/betaFeedbackCrashSubmissions"
        f"?include=tester,build&sort=-createdDate&limit={args.limit}",
        token,
    )

    if screenshot_payload is None and crash_payload is None:
        print("No data returned (check API key role — needs Admin/App Manager, or no feedback yet).")
        sys.exit(1)

    (out / "raw.json").write_text(
        json.dumps({"screenshots": screenshot_payload, "crashes": crash_payload}, indent=2)
    )

    lines = ["# TestFlight Tester Feedback", ""]
    lines.append(f"_Pulled {time.strftime('%Y-%m-%d %H:%M')} — app {APP_ID}, build pipeline V7JYZ8YUDH key._")
    lines.append("")

    # --- Screenshot feedback (has tester comments) ---
    sshots = (screenshot_payload or {}).get("data", [])
    smap = build_tester_map(screenshot_payload or {})
    lines.append(f"## Screenshot feedback ({len(sshots)})")
    lines.append("")
    if not sshots:
        lines.append("_None submitted yet._\n")
    for i, item in enumerate(sshots, 1):
        a = item.get("attributes", {})
        rel = item.get("relationships", {})
        tester_id = (rel.get("tester", {}).get("data") or {}).get("id")
        build_id = (rel.get("build", {}).get("data") or {}).get("id")
        who = smap.get(tester_id, "(unknown tester)")
        build = smap.get(build_id, "?")
        comment = a.get("comment") or "(no comment)"
        lines.append(f"### {i}. {comment[:80]}")
        lines.append(f"- **Comment:** {comment}")
        lines.append(f"- **Tester:** {who}")
        lines.append(f"- **Device:** {a.get('deviceModel','?')} · {a.get('osVersion','?')} · {build}")
        lines.append(f"- **Date:** {a.get('createdDate','?')}")
        urls = find_image_urls(a)
        for j, url in enumerate(urls):
            fn = f"shot_{i:02d}_{j+1}.png"
            if download(url, shots_dir / fn):
                lines.append(f"- **Screenshot:** ![{fn}](screenshots/{fn})")
        lines.append("")

    # --- Crash feedback ---
    crashes = (crash_payload or {}).get("data", [])
    cmap = build_tester_map(crash_payload or {})
    lines.append(f"## Crash feedback ({len(crashes)})")
    lines.append("")
    if not crashes:
        lines.append("_None submitted yet._\n")
    for i, item in enumerate(crashes, 1):
        a = item.get("attributes", {})
        rel = item.get("relationships", {})
        tester_id = (rel.get("tester", {}).get("data") or {}).get("id")
        who = cmap.get(tester_id, "(unknown tester)")
        comment = a.get("comment") or "(no comment)"
        lines.append(f"### {i}. {comment[:80]}")
        lines.append(f"- **Comment:** {comment}")
        lines.append(f"- **Tester:** {who}")
        lines.append(f"- **Device:** {a.get('deviceModel','?')} · {a.get('osVersion','?')}")
        lines.append(f"- **Date:** {a.get('createdDate','?')}")
        for j, url in enumerate(find_image_urls(a)):
            fn = f"crashlog_{i:02d}_{j+1}.txt"
            if download(url, shots_dir / fn):
                lines.append(f"- **Crash log:** [{fn}](screenshots/{fn})")
        lines.append("")

    (out / "SUMMARY.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"\nDone. {len(sshots)} screenshot + {len(crashes)} crash submissions.")
    print(f"Summary: {out / 'SUMMARY.md'}")
    print(f"Images:  {shots_dir}")


if __name__ == "__main__":
    main()
