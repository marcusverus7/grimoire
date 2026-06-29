"""
ship_ios.py — Self-healing iOS shipper for Grimoire.

The Apple Distribution cert is shared across the founder's apps (Mezo,
GigTrotter, Klert, ToneScout) on account JQS67937W6, so another project's
pipeline can revoke Grimoire's cert between provisioning and the build's
signing step. This script removes the manual whack-a-mole:

  1. provision a fresh cert + profile + secrets (provision_ios.py)
  2. trigger the iOS build
  3. wait for it to finish
  4. if it failed specifically on "Signing certificate is invalid / revoked",
     re-provision and retry (up to MAX_ATTEMPTS)
  5. on success, print the App Store Connect build state

Runs LOCALLY (needs OpenSSL 3 for the legacy P12, gh auth, and the ASC .p8) —
NOT in CI, where the runner ships LibreSSL (no `-legacy`) and minting would fail.

Usage:  python3 .github/scripts/ship_ios.py [--max-attempts 3] [--no-provision]
"""
import subprocess, sys, time, json, argparse, re
from pathlib import Path

REPO = "marcusverus7/grimoire"
WORKFLOW = "ios-build.yml"
MAX_ATTEMPTS = 3
CERT_FAIL_RX = re.compile(r"Signing certificate is invalid|has been revoked|not valid for code signing", re.I)
ROOT = Path(__file__).resolve().parents[2]


def run(cmd, **kw):
    return subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, **kw)


def provision():
    print("→ provisioning fresh cert + profile + secrets…")
    r = run([sys.executable, ".github/scripts/provision_ios.py"])
    print(r.stdout[-800:])
    if r.returncode != 0:
        print(r.stderr[-800:], file=sys.stderr)
        return False
    return True


def latest_run_id():
    r = run(["gh", "run", "list", "--repo", REPO, "--workflow", WORKFLOW,
             "--limit", "1", "--json", "databaseId,status"])
    data = json.loads(r.stdout or "[]")
    return data[0]["databaseId"] if data else None


def trigger():
    print("→ triggering build…")
    run(["gh", "workflow", "run", WORKFLOW, "--repo", REPO])
    time.sleep(12)
    rid = latest_run_id()
    print(f"  run {rid}")
    return rid


def wait(rid, poll=30, timeout=3600):
    waited = 0
    while waited < timeout:
        r = run(["gh", "run", "view", str(rid), "--repo", REPO,
                 "--json", "status,conclusion"])
        try:
            d = json.loads(r.stdout)
        except json.JSONDecodeError:
            d = {}
        if d.get("status") == "completed":
            return d.get("conclusion")
        time.sleep(poll)
        waited += poll
    return "timed_out"


def failed_on_cert(rid):
    r = run(["gh", "run", "view", str(rid), "--repo", REPO, "--log-failed"])
    return bool(CERT_FAIL_RX.search(r.stdout or ""))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-attempts", type=int, default=MAX_ATTEMPTS)
    ap.add_argument("--no-provision", action="store_true",
                    help="skip the first provision (use current secrets as-is)")
    args = ap.parse_args()

    for attempt in range(1, args.max_attempts + 1):
        print(f"\n=== attempt {attempt}/{args.max_attempts} ===")
        if not (attempt == 1 and args.no_provision):
            if not provision():
                print("provision failed — aborting"); return 1
        rid = trigger()
        if not rid:
            print("could not find triggered run — aborting"); return 1
        concl = wait(rid)
        print(f"  build {rid} → {concl}")
        if concl == "success":
            print(f"\n✓ shipped. run {rid} succeeded → TestFlight.")
            return 0
        if concl in (None, "failure") and failed_on_cert(rid):
            print("  cert was revoked again — re-provisioning and retrying…")
            continue
        print(f"  build failed for a non-cert reason ({concl}); see:")
        print(f"  gh run view {rid} --repo {REPO} --log-failed")
        return 1
    print(f"\n✗ still failing after {args.max_attempts} attempts.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
