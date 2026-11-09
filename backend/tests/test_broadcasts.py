import json
import time
from datetime import datetime, timedelta

import httpx
import pytest

from backend.tests.conftest import bearer

SA = "superadmin@company.com"
ADMIN = "admin@company.com"
EXEC = "tajayvarma76@gmail.com"
SEGMENT = "NSE DERIVATIVES"
SENDER_PHONE = "8884321002"
SENDER_ID = 5551001


def day(offset):
    return (datetime.now() + timedelta(days=offset)).strftime("%Y-%m-%d")


def client(cid, phone, segments=(SEGMENT,), end=None, status="Active"):
    return {"id": cid, "clientName": f"Client {cid}", "phone": phone, "serviceName": "Index Options",
            "serviceStartDate": day(-10), "serviceEndDate": end or day(30), "status": status,
            "segments": list(segments)}


def set_paid(b, clients):
    """Replace every stored Paid client."""
    for existing in b.store.all(b.PAID_CLIENTS):
        b.store.delete(b.PAID_CLIENTS, existing["id"])
    b.store.put_many(b.PAID_CLIENTS, clients)


def broadcast_log(b):
    return list(reversed(b.store.all(b.BROADCASTS)))


@pytest.fixture
def bc(crm, monkeypatch):
    """The broadcasts module with a test .env, empty data files and the network stubbed out."""
    b = crm.broadcasts
    env = {"TELEGRAM_BOTS": json.dumps({SEGMENT: "123:abc"}), "TELEGRAM_ALLOWED_PHONES": f"+91 {SENDER_PHONE}",
           "SMS_ACCESS_TOKEN": "test-token", "SMS_SENDER": "INVSTQ", "SMS_SERVICE": "SI",
           "SMS_BLOCKED_HOURS": "off"}

    def write_env(**overrides):
        with open(b.ENV_PATH, "w", encoding="utf-8") as f:
            f.write("\n".join(f"{k}={v}" for k, v in {**env, **overrides}.items()))

    write_env()
    set_paid(b, [])
    for record in b.store.all(b.BROADCASTS):
        b.store.delete(b.BROADCASTS, record["id"])
    b.store.set_value(b.DELETED_PAID, [])
    b.store.set_value(b.SENDERS, {})
    b.store.set_value(b.OFFSETS, {})

    sms, replies = [], []

    def fake_get(url, params=None, timeout=None):
        sms.append(params)
        status = 500 if params["to"] == "9000000500" else 200
        return httpx.Response(status, json={"status": "success"}, request=httpx.Request("GET", url))

    monkeypatch.setattr(b.httpx, "get", fake_get)
    monkeypatch.setattr(b, "_telegram", lambda token, method, timeout=15, **payload: replies.append(payload) or {})
    b.sms, b.replies, b.write_env = sms, replies, write_env
    return b


def message(bc, text=None, contact=None, user_id=SENDER_ID, age=0):
    msg = {"chat": {"id": user_id, "type": "private"}, "from": {"id": user_id, "first_name": "Sender"},
           "date": int(time.time()) - age}
    if text is not None:
        msg["text"] = text
    if contact is not None:
        msg["contact"] = contact
    bc.handle_update(SEGMENT, "123:abc", {"update_id": 1, "message": msg})
    return bc.replies[-1]["text"] if bc.replies else ""


def authorize(bc):
    message(bc, contact={"phone_number": "+91" + SENDER_PHONE, "user_id": SENDER_ID})


def test_normalize_phone():
    from backend.broadcasts import normalize_phone
    assert normalize_phone("+91 98765-43210") == "9876543210"
    assert normalize_phone("09876543210") == "9876543210"
    assert normalize_phone("919876543210") == "9876543210"
    assert normalize_phone("12345") is None
    assert normalize_phone("5876543210") is None


def test_paid_client_routes_are_admin_only(crm, bc):
    ex = crm.token(EXEC)
    assert crm.client.get("/api/paid-clients", headers=bearer(ex)).status_code == 403
    assert crm.client.post("/api/paid-clients/sync", json={"clients": []}, headers=bearer(ex)).status_code == 403
    assert crm.client.get("/api/broadcasts", headers=bearer(ex)).status_code == 403


def test_sync_upserts_without_dropping_other_browsers_clients(crm, bc):
    sa, admin = bearer(crm.token(SA)), bearer(crm.token(ADMIN))
    crm.client.post("/api/paid-clients/sync", json={"clients": [client("p1", "9876500001")]}, headers=sa)
    crm.client.post("/api/paid-clients/sync", json={"clients": [client("p2", "9876500002"), client("p1", "9876500009")]}, headers=admin)
    stored = {c["id"]: c for c in crm.client.get("/api/paid-clients", headers=sa).json()["clients"]}
    assert set(stored) == {"p1", "p2"}
    assert stored["p1"]["phone"] == "9876500009"

    crm.client.delete("/api/paid-clients/p1", headers=sa)
    # A browser that still has p1 cached cannot bring it back
    crm.client.post("/api/paid-clients/sync", json={"clients": [client("p1", "9876500001")]}, headers=admin)
    body = crm.client.get("/api/paid-clients", headers=sa).json()
    assert [c["id"] for c in body["clients"]] == ["p2"]
    assert body["deletedIds"] == ["p1"]


def test_only_active_clients_with_the_segment_ticked_receive_the_call(bc):
    set_paid(bc, [
        client("a", "9876500001"),
        client("dup", "+91 98765 00001"),                       # same phone: one SMS
        client("other", "9876500002", segments=["MCX DERIVATIVES"]),
        client("none", "9876500006", segments=[]),
        client("expired", "9876500003", status="Service Expired"),
        client("ended", "9876500004", end=day(0)),              # tenure ends today
        client("bad", "12345"),
        client("b", "9876500005", segments=["MCX DERIVATIVES", " nse  derivatives "]),
        {**client("old", "9876500007"), "segments": None},      # never ticked anything
    ])
    assert sorted(r["phone"] for r in bc.active_recipients(SEGMENT)) == ["9876500001", "9876500005"]
    assert sorted(r["phone"] for r in bc.active_recipients("MCX DERIVATIVES")) == ["9876500002", "9876500005"]
    assert bc.active_recipients("NSE BSE EQUITY") == []
    # The CRM labels the equity box "NSE BSE Equity"; case does not matter
    set_paid(bc, [client("e", "9876500008", segments=["NSE BSE Equity"])])
    assert [r["phone"] for r in bc.active_recipients("NSE BSE EQUITY")] == ["9876500008"]


def test_unverified_sender_is_refused_and_nothing_is_sent(bc):
    set_paid(bc, [client("a", "9876500001")])
    reply = message(bc, text="BUY NIFTY 24500 CE @ 120")
    assert "authorized" in reply
    assert bc.replies[-1]["reply_markup"]["keyboard"][0][0]["request_contact"] is True
    assert bc.sms == []


def test_forwarded_or_unlisted_contacts_are_rejected(bc):
    message(bc, contact={"phone_number": SENDER_PHONE, "user_id": 999})  # someone else's contact card
    message(bc, contact={"phone_number": "9123456789", "user_id": SENDER_ID})  # number not allowed
    assert bc.store.get_value(bc.SENDERS, {}) == {}
    message(bc, text="BUY NIFTY")
    assert bc.sms == []


def test_verified_sender_broadcasts_to_active_clients(bc):
    set_paid(bc, [client("a", "9876500001"), client("b", "9000000500"), client("x", "9876500003", status="Service Expired"),
                  client("y", "9876500004", segments=["BSE DERIVATIVES"])])
    authorize(bc)
    reply = message(bc, text="BUY NIFTY 24500 CE @ 120 SL 100 TGT 150")

    assert sorted(p["to"] for p in bc.sms if p["to"] != "9000000500") == ["9876500001"]
    first = bc.sms[0]
    assert first["access_token"] == "test-token" and first["sender"] == "INVSTQ" and first["service"] == "SI"
    assert first["country_code"] == "+91" and first["message"] == "BUY NIFTY 24500 CE @ 120 SL 100 TGT 150"
    assert "Partly sent: 1 of 2" in reply and "Client b" in reply

    log = broadcast_log(bc)
    assert log[0]["sent"] == 1 and log[0]["failed"] == 1 and log[0]["activeClients"] == 2
    assert log[0]["segment"] == SEGMENT
    assert all("xxxxx" in r["phone"] for r in log[0]["results"])


def test_message_format_and_length_limit(bc):
    set_paid(bc, [client("a", "9876500001")])
    bc.write_env(SMS_MESSAGE_FORMAT="{segment} call: {call} -INVESTEQ", SMS_MAX_CHARS="60")
    authorize(bc)
    message(bc, text="SELL GOLD")
    assert bc.sms[-1]["message"] == f"{SEGMENT} call: SELL GOLD -INVESTEQ"

    count = len(bc.sms)
    reply = message(bc, text="X" * 80)
    assert "NOT SENT" in reply and len(bc.sms) == count


def test_test_mode_sends_only_to_the_test_number(bc):
    set_paid(bc, [client("a", "9876500001"), client("b", "9876500002")])
    bc.write_env(SMS_TEST_RECIPIENT="9811122233, +91 98111 22234")
    authorize(bc)
    reply = message(bc, text="BUY NIFTY")
    assert sorted(p["to"] for p in bc.sms) == ["9811122233", "9811122234"]
    assert "TEST MODE" in reply and "2 active" in reply


def test_stale_calls_and_missing_config_are_not_sent(bc):
    set_paid(bc, [client("a", "9876500001")])
    authorize(bc)
    assert "NOT sent" in message(bc, text="BUY NIFTY", age=600)
    bc.write_env(SMS_SENDER="")
    assert "SMS_SENDER" in message(bc, text="BUY NIFTY")
    assert bc.sms == []


def test_revoking_a_phone_blocks_an_already_verified_sender(bc):
    set_paid(bc, [client("a", "9876500001")])
    authorize(bc)
    bc.write_env(TELEGRAM_ALLOWED_PHONES="9123456789")
    assert "authorized" in message(bc, text="BUY NIFTY")
    assert bc.sms == []


def test_broadcast_status_endpoint(crm, bc):
    set_paid(bc, [client("a", "9876500001")])
    body = crm.client.get("/api/broadcasts", headers=bearer(crm.token(SA))).json()
    assert body["config"]["smsReady"] is True
    assert body["segments"][0]["segment"] == SEGMENT and body["segments"][0]["activeClients"] == 1
    assert "test-token" not in json.dumps(body)


def test_crm_test_send_is_super_admin_only_and_reaches_only_test_numbers(crm, bc):
    set_paid(bc, [client("a", "9876500001")])
    body = {"segment": SEGMENT, "call": "BUY NIFTY"}
    assert crm.client.post("/api/broadcasts/test", json=body, headers=bearer(crm.token(ADMIN))).status_code == 403

    sa = bearer(crm.token(SA))
    res = crm.client.post("/api/broadcasts/test", json=body, headers=sa).json()
    assert res["status"] == "Not sent" and "SMS_TEST_RECIPIENT" in res["error"] and bc.sms == []

    bc.write_env(SMS_TEST_RECIPIENT="9811122233")
    res = crm.client.post("/api/broadcasts/test", json=body, headers=sa).json()
    assert res["status"] == "Sent" and res["testMode"] is True
    assert [p["to"] for p in bc.sms] == ["9811122233"]


DLT_FORMAT = ("FNO ALERT: {{1}} Buy {{2}} SL {{3}} Tgt {{4}} Unite Technologies Financial Service "
              "(SEBI Reg: INH000020350) - https://investeq.in/")
# The template as registered on DLT (1777179206957321210, read from the wappie dashboard), written in
# .env with \n for line breaks. Operators reject anything else, e.g. an "InvestEQ" prefix or other breaks.
INVESTEQ_ENV = ("FNO ALERT: {{1}} Buy {{2}} SL {{3}} Tgt {{4}}\\n\\nUnite Technologies Financial Service "
                "(SEBI Reg: INH000020350) - https://investeq.in/")
INVESTEQ_SMS = ("FNO ALERT: NIFTY 24500 CE Buy 120 SL 100 Tgt 150\n\nUnite Technologies Financial Service "
                "(SEBI Reg: INH000020350) - https://investeq.in/")


def test_calls_fill_the_dlt_template_slots(bc):
    set_paid(bc, [client("a", "9876500001")])
    bc.write_env(SMS_MESSAGE_FORMAT=DLT_FORMAT)
    authorize(bc)

    message(bc, text="fno alert: BANKNIFTY 52000 PE\nbuy 300\nsl 250\ntgt 350/400")
    assert bc.sms[-1]["message"] == ("FNO ALERT: BANKNIFTY 52000 PE Buy 300 SL 250 Tgt 350/400 Unite Technologies "
                                     "Financial Service (SEBI Reg: INH000020350) - https://investeq.in/")

    count = len(bc.sms)
    reply = message(bc, text="BUY NIFTY 120")
    assert "NOT SENT" in reply and "Post it as: NIFTY 24500 CE Buy 120 SL 100 Tgt 150" in reply
    assert "too long" in message(bc, text="N" * 31 + " Buy 1 SL 2 Tgt 3")
    assert len(bc.sms) == count


def test_se_route_is_not_sent_in_the_carrier_blocked_hours(bc, monkeypatch):
    from datetime import datetime as real_datetime
    set_paid(bc, [client("a", "9876500001")])
    bc.write_env(SMS_SERVICE="SE", SMS_BLOCKED_HOURS="")
    cfg = bc.settings()
    assert cfg["blocked_hours"] == (21, 10)
    assert bc.in_blocked_hours(cfg, real_datetime(2026, 10, 30, 23, 41))
    assert bc.in_blocked_hours(cfg, real_datetime(2026, 10, 31, 9, 59))
    assert not bc.in_blocked_hours(cfg, real_datetime(2026, 10, 31, 10, 0))
    assert not bc.in_blocked_hours(cfg, real_datetime(2026, 10, 31, 20, 59))
    bc.write_env(SMS_SERVICE="SI", SMS_BLOCKED_HOURS="")
    assert bc.settings()["blocked_hours"] is None

    bc.write_env(SMS_SERVICE="SE", SMS_BLOCKED_HOURS="21-10")
    monkeypatch.setattr(bc, "in_blocked_hours", lambda cfg, now=None: True)
    authorize(bc)
    reply = message(bc, text="BUY NIFTY")
    assert "NOT SENT" in reply and "after 10:00" in reply and bc.sms == []


def test_investeq_template_accepts_the_values_or_the_full_text(bc):
    set_paid(bc, [client("a", "9876500001")])
    bc.write_env(SMS_MESSAGE_FORMAT=INVESTEQ_ENV)
    authorize(bc)
    message(bc, text="NIFTY 24500 CE Buy 120 SL 100 Tgt 150")
    assert bc.sms[-1]["message"] == INVESTEQ_SMS
    message(bc, text="FNO ALERT: NIFTY 24500 CE Buy 120 SL 100 Tgt 150")
    assert bc.sms[-1]["message"] == INVESTEQ_SMS
    # The handover told senders to start with "InvestEQ FNO ALERT:"; the SMS still uses the registered text
    message(bc, text="InvestEQ FNO ALERT: NIFTY 24500 CE Buy 120 SL 100 Tgt 150")
    assert bc.sms[-1]["message"] == INVESTEQ_SMS
    # The whole approved text pasted in, footer and all, sends the same SMS (footer not doubled)
    message(bc, text=INVESTEQ_SMS)
    assert bc.sms[-1]["message"] == INVESTEQ_SMS
    message(bc, text=INVESTEQ_SMS.replace("\n", " "))
    assert bc.sms[-1]["message"] == INVESTEQ_SMS
    assert len(bc.sms) == 5

    reply = message(bc, text="Buy NIFTY now")
    assert "NOT SENT" in reply and len(bc.sms) == 5


def test_help_shows_the_segment_and_format(bc):
    bc.write_env(SMS_MESSAGE_FORMAT=INVESTEQ_ENV)
    authorize(bc)
    reply = message(bc, text="/start")
    assert SEGMENT in reply and "NIFTY 24500 CE Buy 120 SL 100 Tgt 150" in reply
    set_paid(bc, [client("a", "9876500001"), client("b", "9876500002", segments=[])])
    assert message(bc, text="/status").startswith(f"{SEGMENT}: 1 active client")


def test_sync_keeps_segment_ticks_when_a_browser_omits_them(crm, bc):
    sa = bearer(crm.token(SA))
    crm.client.post("/api/paid-clients/sync", json={"clients": [client("p1", "9876500001")]}, headers=sa)
    stale = {k: v for k, v in client("p1", "9876500001").items() if k != "segments"}
    crm.client.post("/api/paid-clients/sync", json={"clients": [stale]}, headers=sa)
    stored = crm.client.get("/api/paid-clients", headers=sa).json()["clients"]
    assert stored[0]["segments"] == [SEGMENT]
    # Unticking everything is still saved
    crm.client.post("/api/paid-clients/sync", json={"clients": [client("p1", "9876500001", segments=[])]}, headers=sa)
    assert crm.client.get("/api/paid-clients", headers=sa).json()["clients"][0]["segments"] == []


def test_bot_status_is_shared_with_workers_that_do_not_poll(crm, bc):
    sa = bearer(crm.token(SA))
    assert crm.client.get("/api/broadcasts", headers=sa).json()["segments"][0]["running"] is False
    bc._pollers[SEGMENT] = {"username": "Srin_vas_1_bot", "error": None}
    try:
        bc._publish_status(SEGMENT)
    finally:
        del bc._pollers[SEGMENT]
    seg = crm.client.get("/api/broadcasts", headers=sa).json()["segments"][0]
    assert seg["running"] is True and seg["botUsername"] == "Srin_vas_1_bot"
    # A stale heartbeat (bot worker gone) is not shown as running
    with bc.store.update_value(bc.POLLER_STATUS, {}) as status:
        status[0][SEGMENT]["at"] -= 1000
    seg = crm.client.get("/api/broadcasts", headers=sa).json()["segments"][0]
    assert seg["running"] is False and "No status" in seg["error"]
