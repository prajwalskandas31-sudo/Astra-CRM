import json
import time
from datetime import datetime, timedelta

import httpx
import pytest

from backend.tests.conftest import bearer

SA = "superadmin@company.com"
ADMIN = "admin@company.com"
EXEC = "tajayvarma76@gmail.com"
SERVICE = "Equity Cash & Intraday Pro"
SENDER_PHONE = "8884321002"
SENDER_ID = 5551001


def day(offset):
    return (datetime.now() + timedelta(days=offset)).strftime("%Y-%m-%d")


def client(cid, phone, service=SERVICE, end=None, status="Active"):
    return {"id": cid, "clientName": f"Client {cid}", "phone": phone, "serviceName": service,
            "serviceStartDate": day(-10), "serviceEndDate": end or day(30), "status": status}


@pytest.fixture
def bc(crm, monkeypatch):
    """The broadcasts module with a test .env, empty data files and the network stubbed out."""
    b = crm.broadcasts
    env = {"TELEGRAM_BOTS": json.dumps({SERVICE: "123:abc"}), "TELEGRAM_ALLOWED_PHONES": f"+91 {SENDER_PHONE}",
           "SMS_ACCESS_TOKEN": "test-token", "SMS_SENDER": "INVSTQ", "SMS_SERVICE": "SI"}

    def write_env(**overrides):
        with open(b.ENV_PATH, "w", encoding="utf-8") as f:
            f.write("\n".join(f"{k}={v}" for k, v in {**env, **overrides}.items()))

    write_env()
    for path in (b.PAID_CLIENTS_PATH, b.DELETED_PAID_PATH, b.BROADCASTS_PATH, b.SENDERS_PATH, b.OFFSETS_PATH):
        b._write(path, {} if path in (b.SENDERS_PATH, b.OFFSETS_PATH) else [])

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
    bc.handle_update(SERVICE, "123:abc", {"update_id": 1, "message": msg})
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


def test_only_active_clients_on_the_service_receive_the_call(bc):
    bc._write(bc.PAID_CLIENTS_PATH, [
        client("a", "9876500001"),
        client("dup", "+91 98765 00001"),                       # same phone: one SMS
        client("other", "9876500002", service="Commodity Gold & Silver Super"),
        client("expired", "9876500003", status="Service Expired"),
        client("ended", "9876500004", end=day(0)),              # tenure ends today
        client("bad", "12345"),
        client("b", "9876500005", service=" equity cash & intraday pro "),
    ])
    assert sorted(r["phone"] for r in bc.active_recipients(SERVICE)) == ["9876500001", "9876500005"]


def test_unverified_sender_is_refused_and_nothing_is_sent(bc):
    bc._write(bc.PAID_CLIENTS_PATH, [client("a", "9876500001")])
    reply = message(bc, text="BUY NIFTY 24500 CE @ 120")
    assert "authorized" in reply
    assert bc.replies[-1]["reply_markup"]["keyboard"][0][0]["request_contact"] is True
    assert bc.sms == []


def test_forwarded_or_unlisted_contacts_are_rejected(bc):
    message(bc, contact={"phone_number": SENDER_PHONE, "user_id": 999})  # someone else's contact card
    message(bc, contact={"phone_number": "9123456789", "user_id": SENDER_ID})  # number not allowed
    assert bc._read(bc.SENDERS_PATH, {}) == {}
    message(bc, text="BUY NIFTY")
    assert bc.sms == []


def test_verified_sender_broadcasts_to_active_clients(bc):
    bc._write(bc.PAID_CLIENTS_PATH, [client("a", "9876500001"), client("b", "9000000500"), client("x", "9876500003", status="Service Expired")])
    authorize(bc)
    reply = message(bc, text="BUY NIFTY 24500 CE @ 120 SL 100 TGT 150")

    assert sorted(p["to"] for p in bc.sms if p["to"] != "9000000500") == ["9876500001"]
    first = bc.sms[0]
    assert first["access_token"] == "test-token" and first["sender"] == "INVSTQ" and first["service"] == "SI"
    assert first["country_code"] == "+91" and first["message"] == "BUY NIFTY 24500 CE @ 120 SL 100 TGT 150"
    assert "Partly sent: 1 of 2" in reply and "Client b" in reply

    log = bc._read(bc.BROADCASTS_PATH, [])
    assert log[0]["sent"] == 1 and log[0]["failed"] == 1 and log[0]["activeClients"] == 2
    assert all("xxxxx" in r["phone"] for r in log[0]["results"])


def test_message_format_and_length_limit(bc):
    bc._write(bc.PAID_CLIENTS_PATH, [client("a", "9876500001")])
    bc.write_env(SMS_MESSAGE_FORMAT="{service} call: {call} -INVESTEQ", SMS_MAX_CHARS="60")
    authorize(bc)
    message(bc, text="SELL GOLD")
    assert bc.sms[-1]["message"] == f"{SERVICE} call: SELL GOLD -INVESTEQ"

    count = len(bc.sms)
    reply = message(bc, text="X" * 80)
    assert "NOT SENT" in reply and len(bc.sms) == count


def test_test_mode_sends_only_to_the_test_number(bc):
    bc._write(bc.PAID_CLIENTS_PATH, [client("a", "9876500001"), client("b", "9876500002")])
    bc.write_env(SMS_TEST_RECIPIENT="9811122233, +91 98111 22234")
    authorize(bc)
    reply = message(bc, text="BUY NIFTY")
    assert sorted(p["to"] for p in bc.sms) == ["9811122233", "9811122234"]
    assert "TEST MODE" in reply and "2 active" in reply


def test_stale_calls_and_missing_config_are_not_sent(bc):
    bc._write(bc.PAID_CLIENTS_PATH, [client("a", "9876500001")])
    authorize(bc)
    assert "NOT sent" in message(bc, text="BUY NIFTY", age=600)
    bc.write_env(SMS_SENDER="")
    assert "SMS_SENDER" in message(bc, text="BUY NIFTY")
    assert bc.sms == []


def test_revoking_a_phone_blocks_an_already_verified_sender(bc):
    bc._write(bc.PAID_CLIENTS_PATH, [client("a", "9876500001")])
    authorize(bc)
    bc.write_env(TELEGRAM_ALLOWED_PHONES="9123456789")
    assert "authorized" in message(bc, text="BUY NIFTY")
    assert bc.sms == []


def test_broadcast_status_endpoint(crm, bc):
    bc._write(bc.PAID_CLIENTS_PATH, [client("a", "9876500001")])
    body = crm.client.get("/api/broadcasts", headers=bearer(crm.token(SA))).json()
    assert body["config"]["smsReady"] is True
    assert body["services"][0]["service"] == SERVICE and body["services"][0]["activeClients"] == 1
    assert "test-token" not in json.dumps(body)


def test_crm_test_send_is_super_admin_only_and_reaches_only_test_numbers(crm, bc):
    bc._write(bc.PAID_CLIENTS_PATH, [client("a", "9876500001")])
    body = {"service": SERVICE, "call": "BUY NIFTY"}
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


def test_calls_fill_the_dlt_template_slots(bc):
    bc._write(bc.PAID_CLIENTS_PATH, [client("a", "9876500001")])
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
