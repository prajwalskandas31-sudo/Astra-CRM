"""Load test: many people using the CRM at once, the way the browser app does.

Each simulated user signs in, downloads their data (/api/sync since=0), then every 5 seconds pulls
what changed, and now and then updates one of their leads (a call outcome). Admin sessions also
download every lead, the heaviest request in the app.

    python deploy/load_test.py http://SERVER:8080 --password-file creds.json --users 300 --admins 10         --create-users 290 --leads 20000 --minutes 3

--password-file is the secrets/credentials.json format ([{"email", "password"}, ...]). The test
leads it creates are tagged and deleted again at the end. Run it before go-live, never during
working hours: it writes to the real database.
"""
import argparse
import asyncio
import json
import random
import statistics
import time
import uuid

import httpx

POLL_SECONDS = 5
UPDATE_EVERY = 6  # polls between lead updates per user (~30 s)
TAG = "loadtest"


class Stats:
    def __init__(self):
        self.latency = {}
        self.errors = {}

    def record(self, kind, seconds, ok):
        self.latency.setdefault(kind, []).append(seconds)
        if not ok:
            self.errors[kind] = self.errors.get(kind, 0) + 1

    def report(self, wall):
        print(f"\n{'request':<16}{'count':>8}{'errors':>8}{'p50 ms':>9}{'p95 ms':>9}{'max ms':>9}")
        total = 0
        for kind, values in sorted(self.latency.items()):
            values = sorted(values)
            total += len(values)
            p95 = values[int(len(values) * 0.95) - 1] if len(values) > 1 else values[0]
            print(f"{kind:<16}{len(values):>8}{self.errors.get(kind, 0):>8}{statistics.median(values) * 1000:>9.0f}"
                  f"{p95 * 1000:>9.0f}{values[-1] * 1000:>9.0f}")
        print(f"\n{total} requests in {wall:.0f} s = {total / wall:.1f} requests/second")


async def timed(stats, kind, coro):
    start = time.perf_counter()
    try:
        res = await coro
        ok = res.status_code < 400
    except httpx.HTTPError:
        res, ok = None, False
    stats.record(kind, time.perf_counter() - start, ok)
    return res if ok else None


async def session(client, stats, token, user_id, is_admin, deadline):
    headers = {"Authorization": f"Bearer {token}"}
    collections = "leads,sales,assignmentInstances,leadRequests,notifications,services,financialSettings"
    res = await timed(stats, "full_pull_admin" if is_admin else "full_pull", client.get(
        "/api/sync", params={"collections": collections, "since": 0}, headers=headers))
    if res is None:
        return
    body = res.json()
    cursor = body["cursor"]
    mine = [l for l in body["collections"]["leads"]["items"] if l.get("assignedToId") == user_id]
    await asyncio.sleep(random.uniform(0, POLL_SECONDS))
    polls = 0
    while time.monotonic() < deadline:
        res = await timed(stats, "poll", client.get("/api/sync", params={"collections": collections, "since": cursor}, headers=headers))
        if res is not None:
            cursor = res.json()["cursor"]
        polls += 1
        if mine and polls % UPDATE_EVERY == 0:
            lead = random.choice(mine)
            lead = {**lead, "disposition": random.choice(["Interested", "Call Back Later", "Follow Up"]),
                    "history": [*lead.get("history", [])[-5:], {"date": time.strftime("%Y-%m-%d"), "text": "load test call"}]}
            await timed(stats, "push_update", client.post("/api/sync", headers=headers,
                                                          json={"collections": {"leads": {"upserts": [lead]}}}))
        await asyncio.sleep(POLL_SECONDS)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base_url")
    ap.add_argument("--password-file", required=True)
    ap.add_argument("--users", type=int, default=300)
    ap.add_argument("--leads", type=int, default=20000)
    ap.add_argument("--minutes", type=float, default=3)
    ap.add_argument("--admins", type=int, default=10, help="how many of the simulated people are Admins (they download every lead)")
    ap.add_argument("--ramp-seconds", type=float, default=60, help="people arrive over this long (a morning log-in rush)")
    ap.add_argument("--create-users", type=int, default=0,
                    help="create this many temporary Executive accounts (deleted at the end) so leads spread like in real use")
    args = ap.parse_args()

    creds = json.load(open(args.password_file, encoding="utf-8"))
    stats = Stats()
    limits = httpx.Limits(max_connections=args.users + 20, max_keepalive_connections=args.users + 20)
    async with httpx.AsyncClient(base_url=args.base_url.rstrip("/") + "", timeout=60, limits=limits) as client:
        accounts = []
        for c in creds:
            res = await client.post("/api/auth/login", json={"email": c["email"], "password": c["password"]})
            if res.status_code == 200:
                body = res.json()
                accounts.append((body["access_token"], body["user"]))
        admin = next((a for a in accounts if a[1]["role"] == "Super Admin"), None)
        if not admin:
            raise SystemExit("The password file needs a working Super Admin account.")
        print(f"Signed in {len(accounts)} accounts; simulating {args.users} people.")

        sa_headers = {"Authorization": f"Bearer {admin[0]}"}
        temp_users = []
        for n in range(args.create_users):
            password = f"Lt-{uuid.uuid4().hex}"
            res = await client.post("/api/users", headers=sa_headers, json={
                "name": f"{TAG} user {n} {uuid.uuid4().hex[:6]}", "mobile": f"6{random.randint(100000000, 999999999)}",
                "email": f"{TAG}-{uuid.uuid4().hex[:10]}@example.invalid", "password": password, "role": "Executive",
                "reportingTo": admin[1]["name"]})
            if res.status_code != 200:
                raise SystemExit(f"Could not create a test user: {res.status_code} {res.text[:200]}")
            temp_users.append((res.json(), password))
        for user, password in temp_users:
            for _ in range(10):  # sign-ins are rate limited per IP; wait and retry
                res = await client.post("/api/auth/login", json={"email": user["email"], "password": password})
                if res.status_code != 429:
                    break
                await asyncio.sleep(2)
            if res.status_code == 200:
                accounts.append((res.json()["access_token"], res.json()["user"]))
        if temp_users:
            print(f"Created and signed in {len(temp_users)} temporary users.")

        owners = [u["id"] for _, u in accounts if u["role"] not in ("Super Admin", "Admin")] or [admin[1]["id"]]
        lead_ids = []
        start = time.perf_counter()
        for i in range(0, args.leads, 2000):
            batch = []
            for _ in range(min(2000, args.leads - i)):
                owner = random.choice(owners)
                lead_id = f"{TAG}-{uuid.uuid4().hex[:12]}"
                lead_ids.append(lead_id)
                batch.append({"id": lead_id, "clientName": f"Load Test {len(lead_ids)}", "phone": f"9{random.randint(100000000, 999999999)}",
                              "language": random.choice(["English", "Hindi", "Kannada"]), "assignedToId": owner,
                              "assigned_user_id": owner, "disposition": "New Lead", "sourceFileName": f"{TAG}.csv",
                              "history": [{"date": time.strftime("%Y-%m-%d"), "text": "load test upload"}]})
            await timed(stats, "bulk_upload", client.post("/api/sync", headers={"Authorization": f"Bearer {admin[0]}"},
                                                         json={"collections": {"leads": {"upserts": batch}}}))
        print(f"Uploaded {len(lead_ids)} leads in {time.perf_counter() - start:.1f} s")

        deadline = time.monotonic() + args.ramp_seconds + args.minutes * 60
        t0 = time.perf_counter()
        tasks = []
        admins = [a for a in accounts if a[1]["role"] in ("Super Admin", "Admin")]
        staff = [a for a in accounts if a not in admins] or admins
        for n in range(args.users):
            token, user = admins[n % len(admins)] if n < args.admins else staff[n % len(staff)]
            tasks.append(session(client, stats, token, user["id"], n < args.admins, deadline))
            await asyncio.sleep(args.ramp_seconds / args.users)  # people do not all sign in at the same moment
        await asyncio.gather(*tasks)
        wall = time.perf_counter() - t0
        stats.report(wall)

        for i in range(0, len(lead_ids), 2000):
            await client.post("/api/sync", headers={"Authorization": f"Bearer {admin[0]}"},
                              json={"collections": {"leads": {"deletes": lead_ids[i:i + 2000]}}})
        print(f"Removed the {len(lead_ids)} test leads.")
        for user, _ in temp_users:
            await client.delete(f"/api/users/{user['id']}", headers=sa_headers)
        if temp_users:
            print(f"Removed the {len(temp_users)} temporary users.")


if __name__ == "__main__":
    asyncio.run(main())
