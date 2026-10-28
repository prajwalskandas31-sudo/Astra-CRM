"""End-to-end checks against a running CRM deployment (default: production).

Safe for production: real accounts are only signed in to (never modified); every write uses a temporary
account/record that is removed again; the lockout test uses a non-existent account; Leegality checks are
read-only (no documents are sent, no credits are used).

Usage:  python deploy/e2e_live.py [BASE_URL]
Needs secrets/credentials.json (from deploy/generate_credentials.py) for the account passwords.
"""
import json
import os
import secrets
import sys
import time

import httpx

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://200.234.32.65:8080").rstrip("/")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CREDS = {c["email"]: c["password"] for c in json.load(open(os.path.join(ROOT, "secrets", "credentials.json")))}
SA, ADMIN, MANAGER, EXEC = "superadmin@company.com", "admin@company.com", "vikram.manager@company.com", "tajayvarma76@gmail.com"
AUTH_SPACING = 6.5  # nginx allows ~10 auth requests/minute per IP

client = httpx.Client(base_url=BASE, timeout=60)
results = []
_last_auth = 0.0


def check(section, name, ok, detail=""):
    results.append((section, name, bool(ok), detail))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  ({detail})" if detail else ""))


def auth_post(path, body):
    """Auth endpoints are rate limited by nginx, so space them out."""
    global _last_auth
    wait = AUTH_SPACING - (time.time() - _last_auth)
    if wait > 0:
        time.sleep(wait)
    _last_auth = time.time()
    return client.post(path, json=body)


def h(tok):
    return {"Authorization": f"Bearer {tok}"}


def timed(method, path, **kw):
    start = time.perf_counter()
    res = client.request(method, path, **kw)
    return res, (time.perf_counter() - start) * 1000


def section(title):
    print(f"\n== {title}")
    return title


# ---------------------------------------------------------------- infrastructure
s = section("Infrastructure & hardening")
res, ms = timed("GET", "/")
check(s, "Frontend served", res.status_code == 200 and 'id="root"' in res.text, f"{ms:.0f} ms")
check(s, "Clickjacking protection (X-Frame-Options)", res.headers.get("x-frame-options") == "DENY")
check(s, "MIME sniffing protection", res.headers.get("x-content-type-options") == "nosniff")
check(s, "nginx version hidden", "nginx/" not in res.headers.get("server", ""), res.headers.get("server", ""))
asset = next((part.split('"')[0] for part in res.text.split('src="')[1:] if part.startswith("/assets/")), None)
if asset:
    a = client.get(asset)
    check(s, "Hashed bundle cached long-term", "immutable" in a.headers.get("cache-control", ""), a.headers.get("cache-control", ""))
check(s, "Deep links fall back to the app", client.get("/some/unknown/route").status_code == 200)
res, ms = timed("GET", "/api/health")
check(s, "Backend healthy", res.status_code == 200, f"{ms:.0f} ms")
check(s, "API docs not exposed", '"openapi"' not in client.get("/openapi.json").text and '"openapi"' not in client.get("/api/openapi.json").text)
cors = client.options("/api/users", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"})
check(s, "Foreign origins get no CORS access", "access-control-allow-origin" not in cors.headers)
host = BASE.split("//")[1].split(":")[0]
for port in (8000, 5432):
    try:
        httpx.get(f"http://{host}:{port}/", timeout=4)
        reachable = True
    except httpx.HTTPError:
        reachable = False
    check(s, f"Port {port} not publicly reachable", not reachable)

# ---------------------------------------------------------------- authentication
s = section("Authentication (all accounts)")
tokens = {}
for email, pw in CREDS.items():
    res = auth_post("/api/auth/login", {"email": email, "password": pw})
    ok = res.status_code == 200
    if ok:
        tokens[email] = res.json()["access_token"]
        role = res.json()["user"]["role"]
    check(s, f"Login {email}", ok, role if ok else f"HTTP {res.status_code}")
res = auth_post("/api/auth/login", {"email": "EMP-001", "password": CREDS[SA]})
check(s, "Login by employee ID", res.status_code == 200)
res = auth_post("/api/auth/login", {"email": SA, "password": "admin123"})
check(s, "Old default password rejected", res.status_code == 401)
ghost = f"e2e-ghost-{secrets.token_hex(4)}@invalid.example"
codes = [auth_post("/api/auth/login", {"email": ghost, "password": "wrong"}).status_code for _ in range(6)]
check(s, "Lockout after 5 failures (throwaway account)", codes[:5] == [401] * 5 and codes[5] == 429, str(codes))
check(s, "Forged token rejected", client.get("/api/auth/me", headers=h("forged.token.value")).status_code == 401)

# ---------------------------------------------------------------- authorization
s = section("Role-based access (live sessions)")
sa, ad, mg, ex = tokens.get(SA), tokens.get(ADMIN), tokens.get(MANAGER), tokens.get(EXEC)
users_ex = client.get("/api/users", headers=h(ex)).json()
check(s, "No password hashes returned", all("passwordHash" not in u for u in users_ex))
check(s, "Executive can't see others' bank details", all("bankAccountNumber" not in u for u in users_ex if u["email"] != EXEC))
users_ad = client.get("/api/users", headers=h(ad)).json()
check(s, "Admin can see staff bank details", any("bankAccountNumber" in u for u in users_ad))
me_ex = client.get("/api/auth/me", headers=h(ex)).json()
denied = {
    "Executive -> self-promote to Super Admin": client.put(f"/api/users/{me_ex['id']}", json={"role": "Super Admin"}, headers=h(ex)),
    "Executive -> create user": client.post("/api/users", json={"name": "x", "mobile": "1", "password": "x" * 12, "email": "x@x.x"}, headers=h(ex)),
    "Executive -> approve sale": client.post("/api/sales/none/approve", headers=h(ex)),
    "Manager -> change a password": client.put("/api/users/usr-1/password", json={"newPassword": "x" * 12}, headers=h(mg)),
    "Admin -> edit Super Admin": client.put("/api/users/usr-1", json={"mobile": "9000000000"}, headers=h(ad)),
    "Admin -> disable Super Admin": client.put("/api/users/usr-1/toggle-status", headers=h(ad)),
    "Admin -> Leegality wallet": client.get("/api/leegality/wallet", headers=h(ad)),
    "Executive -> read Super Admin's documents": client.get("/api/users/usr-1/documents", headers=h(ex)),
    "Executive -> read stored signatures": client.get("/api/signatures", headers=h(ex)),
    "Admin -> overwrite signatures with a wrong password": client.put("/api/signatures", json={"signatures": {}, "password": "wrong-password"}, headers=h(ad)),
}
for name, r in denied.items():
    check(s, f"Blocked: {name}", r.status_code in (401, 403, 404), f"HTTP {r.status_code}")
check(s, "Anonymous API access rejected", client.get("/api/leads").status_code in (401, 403))

# ---------------------------------------------------------------- workflows
s = section("Workflows (temporary data, cleaned up)")
tag = secrets.token_hex(3)
temp_pw = f"E2e-{secrets.token_hex(8)}"
temp = client.post("/api/users", headers=h(sa), json={
    "name": f"E2E Test {tag}", "mobile": f"90{secrets.randbelow(10**8):08d}", "password": temp_pw,
    "email": f"e2e-{tag}@invalid.example", "role": "Executive", "reportingTo": "Priya Nair"})
check(s, "Super Admin creates a user", temp.status_code == 200, f"HTTP {temp.status_code}")
if temp.status_code == 200:
    uid, temail = temp.json()["id"], temp.json()["email"]
    r = auth_post("/api/auth/login", {"email": temail, "password": temp_pw})
    check(s, "New user can sign in", r.status_code == 200)
    ttok = r.json().get("access_token", "")
    lr = client.post("/api/lead-requests", json={"language": "Telugu", "quantity": 5, "note": "E2E test"}, headers=h(ttok))
    check(s, "New user raises a lead request", lr.status_code == 200)
    if lr.status_code == 200:
        visible = [x["id"] for x in client.get("/api/lead-requests", headers=h(sa)).json()]
        check(s, "Super Admin sees the request", lr.json()["id"] in visible)
        check(s, "Super Admin fulfils it", client.post(f"/api/lead-requests/{lr.json()['id']}/fulfill", headers=h(sa)).status_code == 200)
    new_pw = f"E2e-{secrets.token_hex(8)}"
    check(s, "Super Admin resets the password", client.put(f"/api/users/{uid}/password", json={"newPassword": new_pw}, headers=h(sa)).status_code == 200)
    check(s, "Old session revoked after reset", client.get("/api/auth/me", headers=h(ttok)).status_code == 401)
    check(s, "Deactivate the user", client.put(f"/api/users/{uid}/toggle-status", headers=h(sa)).status_code == 200)
    check(s, "Deactivated user can't sign in", auth_post("/api/auth/login", {"email": temail, "password": new_pw}).status_code == 403)
    check(s, "Delete the user (cleanup)", client.delete(f"/api/users/{uid}", headers=h(sa)).status_code == 200)
disp = client.post("/api/dispositions", json={"name": f"E2E {tag}", "description": "temp"}, headers=h(sa))
check(s, "Create a disposition", disp.status_code == 200)
if disp.status_code == 200:
    did = disp.json()["id"]
    check(s, "Edit the disposition", client.put(f"/api/dispositions/{did}", json={"name": f"E2E {tag} edited"}, headers=h(sa)).status_code == 200)
    check(s, "Delete the disposition (cleanup)", client.delete(f"/api/dispositions/{did}", headers=h(sa)).status_code == 200)
for path in ("/api/leads", "/api/sales", "/api/dispositions", "/api/custom-roles", "/api/document-types", "/api/assignment-instances"):
    r, ms = timed("GET", path, headers=h(sa))
    check(s, f"GET {path}", r.status_code == 200, f"{ms:.0f} ms")

# ---------------------------------------------------------------- Leegality
s = section("Leegality integration (read-only)")
r, ms = timed("GET", "/api/leegality/status", headers=h(sa))
check(s, "Status endpoint responds", r.status_code == 200, f"{ms:.0f} ms")
if r.status_code == 200:
    st = r.json()
    check(s, "API token accepted by Leegality (server IP allow-listed)", st.get("tokenAccepted"), f"Leegality said: {st.get('leegalityResponse')}")
    check(s, "Server outbound IP detected (ipify)", bool(st.get("outboundIp")), st.get("outboundIp") or "")
    check(s, "Workflow profile & template configured", bool(st.get("profileId") and st.get("templateId")), f"{st.get('profileId')} / {st.get('templateId')}")
    check(s, "All template fields mapped", not st.get("fieldsWithoutIds"), str(st.get("fieldsWithoutIds") or ""))
    check(s, "Webhook signing salt configured", st.get("webhookSaltConfigured"))
r, ms = timed("GET", "/api/leegality/wallet", headers=h(sa))
wallet = r.json() if r.status_code == 200 else {}
check(s, "Wallet balance readable", r.status_code == 200 and not wallet.get("error"), json.dumps(wallet)[:160])
wh = client.post("/api/leegality/webhook", json={"documentId": "E2E-FAKE", "mac": "0" * 40})
check(s, "Webhook rejects unsigned payloads", wh.status_code == 401, f"HTTP {wh.status_code}")

# ---------------------------------------------------------------- summary
failed = [r for r in results if not r[2]]
print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
for sec, name, _, detail in failed:
    print(f"  FAILED [{sec}] {name}  {detail}")
sys.exit(1 if failed else 0)
