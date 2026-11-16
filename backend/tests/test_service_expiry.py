import pytest

from backend.tests.conftest import bearer
from backend.tests.test_email_kit import FakeSMTP, FakeIMAP, configure, SA, ADMIN, EXEC  # noqa: F401

TODAY = "2026-11-16"


@pytest.fixture
def smtp(crm, monkeypatch):
    FakeSMTP.sent, FakeSMTP.logins = [], []
    FakeIMAP.appended, FakeIMAP.fail = [], False
    monkeypatch.setattr(crm.email_kit.smtplib, "SMTP_SSL", FakeSMTP)
    monkeypatch.setattr(crm.email_kit.smtplib, "SMTP", FakeSMTP)
    monkeypatch.setattr(crm.email_kit.imaplib, "IMAP4_SSL", FakeIMAP)
    return FakeSMTP


@pytest.fixture
def sa(crm):
    return bearer(crm.token(SA))


@pytest.fixture(autouse=True)
def clean(crm):
    for name in ("serviceExpirySent", "serviceExpiryLog", "serviceExpiryEmail"):
        crm.store.set_value(name, None)
    crm.store.delete_many("paidClients", [c["id"] for c in crm.store.all("paidClients")])


def paid(crm, pid, end, email="client@example.com", segments=("NSE DERIVATIVES", "MCX DERIVATIVES"), **extra):
    doc = {"id": pid, "saleId": "sale-" + pid, "clientName": "Ravi Kumar", "phone": "9876543210", "email": email,
           "serviceName": "Bullions", "serviceTenure": "12 Months", "serviceStartDate": "2025-11-10",
           "serviceEndDate": end, "status": "Active", "segments": list(segments), **extra}
    crm.store.put("paidClients", pid, doc)
    return doc


def enable(crm, sa, **extra):
    res = crm.client.put("/api/email/service-expiry", json={"enabled": True, **extra}, headers=sa)
    assert res.status_code == 200, res.text
    return res.json()


def test_expired_client_is_disabled_in_telegram_and_emailed_once(crm, sa, smtp):
    configure(crm, sa)
    enable(crm, sa, subject="{serviceName} ended for {clientName}",
           body="Hi {clientName}, your {serviceName} ({serviceTenure}) ended on {endDate}.")
    paid(crm, "p-due", "2026-11-16")
    paid(crm, "p-running", "2026-11-17", phone="9123456780")

    result = crm.service_expiry.run_check(TODAY)
    assert result["disabled"] == ["p-due"]

    due = crm.store.get("paidClients", "p-due")
    assert due["status"] == "Service Expired" and due["segments"] == []
    assert due["segmentsBeforeExpiry"] == ["NSE DERIVATIVES", "MCX DERIVATIVES"]
    # Trade calls now reach only the client whose service is still running
    assert [r["phone"] for r in crm.broadcasts.active_recipients("NSE DERIVATIVES")] == ["9123456780"]
    running = crm.store.get("paidClients", "p-running")
    assert running["status"] == "Active" and running["segments"]

    assert len(smtp.sent) == 1
    msg = smtp.sent[0]
    assert msg["To"] == "client@example.com" and msg["Subject"] == "Bullions ended for Ravi Kumar"
    assert "ended on 16 Nov 2026" in msg.get_body(("plain",)).get_content()

    # The next check sends nothing more
    crm.service_expiry.run_check(TODAY)
    assert len(smtp.sent) == 1


def test_a_stale_browser_reenabling_segments_is_disabled_again(crm, sa, smtp):
    paid(crm, "p1", "2026-11-10")
    crm.service_expiry.run_check(TODAY)
    # A browser with an old copy syncs the client back with ticked segments
    crm.store.put("paidClients", "p1", {**crm.store.get("paidClients", "p1"), "status": "Active", "segments": ["NSE DERIVATIVES"]})
    assert crm.service_expiry.run_check(TODAY)["disabled"] == ["p1"]
    assert crm.store.get("paidClients", "p1")["segments"] == []


def test_no_email_while_switched_off_or_for_long_expired_clients(crm, sa, smtp):
    configure(crm, sa)
    paid(crm, "p-off", "2026-11-15")
    crm.service_expiry.run_check(TODAY)
    assert smtp.sent == []  # off by default
    assert crm.store.get("paidClients", "p-off")["segments"] == []  # Telegram is disabled regardless

    enable(crm, sa)
    paid(crm, "p-old", "2026-10-01")  # ended before the catch-up window
    crm.service_expiry.run_check(TODAY)
    assert [m["To"] for m in smtp.sent] == ["client@example.com"]  # only p-off, now that it is on


def test_missing_email_is_logged_and_failures_retry_a_few_times(crm, sa, smtp, monkeypatch):
    configure(crm, sa)
    enable(crm, sa)
    paid(crm, "p-noemail", "2026-11-16", email="")
    crm.service_expiry.run_check(TODAY)
    crm.service_expiry.run_check(TODAY)
    log = crm.client.get("/api/email/service-expiry", headers=sa).json()["log"]
    assert [e["status"] for e in log] == ["skipped"]  # logged once, not every check

    crm.store.delete("paidClients", "p-noemail")
    paid(crm, "p-fail", "2026-11-16")

    def refuse(*a, **k):
        raise OSError("connection refused")
    monkeypatch.setattr(crm.email_kit.smtplib, "SMTP_SSL", refuse)
    for _ in range(5):
        crm.service_expiry.run_check(TODAY)
    log = crm.client.get("/api/email/service-expiry", headers=sa).json()["log"]
    assert [e["status"] for e in log].count("failed") == crm.service_expiry.MAX_ATTEMPTS


def test_settings_test_send_and_manual_resend(crm, sa, smtp):
    configure(crm, sa)
    admin = bearer(crm.token(ADMIN))
    assert crm.client.get("/api/email/service-expiry", headers=admin).status_code == 200
    assert crm.client.put("/api/email/service-expiry", json={"enabled": True}, headers=admin).status_code == 403
    assert crm.client.get("/api/email/service-expiry", headers=bearer(crm.token(EXEC))).status_code == 403
    assert crm.client.put("/api/email/service-expiry", json={"body": "  "}, headers=sa).status_code == 400

    overview = crm.client.get("/api/email/service-expiry", headers=sa).json()
    assert overview["enabled"] is False and "{clientName}" in overview["body"]

    res = crm.client.post("/api/email/service-expiry/test", json={}, headers=sa)
    assert res.status_code == 200, res.text
    assert smtp.sent[-1]["Subject"].startswith("[TEST] ") and smtp.sent[-1]["To"] == "welcome@firm.in"

    paid(crm, "p-live", "2027-01-01")
    assert crm.client.post("/api/email/service-expiry/send/p-live", headers=sa).status_code == 400
    paid(crm, "p-done", "2026-11-01", status="Service Expired")
    res = crm.client.post("/api/email/service-expiry/send/p-done", headers=sa)
    assert res.status_code == 200, res.text
    assert smtp.sent[-1]["To"] == "client@example.com"
