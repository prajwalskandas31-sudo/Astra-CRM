import base64

import pytest
from fastapi import HTTPException

from backend.tests.conftest import bearer

SA = "superadmin@company.com"
ADMIN = "admin@company.com"
EXEC = "tajayvarma76@gmail.com"


class FakeSMTP:
    """Stands in for smtplib.SMTP / SMTP_SSL and keeps every message it is asked to send."""
    sent = []
    logins = []

    def __init__(self, host, port, timeout=None, context=None):
        self.host, self.port = host, port

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def starttls(self, context=None):
        pass

    def login(self, user, password):
        FakeSMTP.logins.append((user, password))

    def send_message(self, msg):
        FakeSMTP.sent.append(msg)
        return {}


@pytest.fixture
def smtp(crm, monkeypatch):
    FakeSMTP.sent, FakeSMTP.logins = [], []
    monkeypatch.setattr(crm.email_kit.smtplib, "SMTP_SSL", FakeSMTP)
    monkeypatch.setattr(crm.email_kit.smtplib, "SMTP", FakeSMTP)
    return FakeSMTP


@pytest.fixture
def sa(crm):
    return bearer(crm.token(SA))


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode()


def configure(crm, headers, **extra):
    body = {"senderEmail": "Welcome@Firm.in", "senderName": "Firm Welcome Desk", "smtpHost": "smtp.firm.in",
            "smtpPort": 465, "smtpSecurity": "ssl", "smtpPassword": "app-pass", **extra}
    res = crm.client.put("/api/email/settings", json=body, headers=headers)
    assert res.status_code == 200, res.text
    return res.json()


def upload(crm, headers, slot, name, data=b"hello", ctype="application/pdf"):
    return crm.client.put(f"/api/email/welcome-kit/files/{slot}", headers=headers,
                          json={"fileName": name, "contentType": ctype, "dataBase64": b64(data)})


def clear_slots(crm, headers):
    for n in range(1, 20):
        crm.client.delete(f"/api/email/welcome-kit/files/{n}", headers=headers)


def add_sale(crm, sale_id, email="client@example.com", **extra):
    crm.store.put("sales", sale_id, {"id": sale_id, "clientName": "Ravi Kumar", "email": email, **extra})


def attachments(msg):
    return [(p.get_filename(), p.get_content()) for p in msg.iter_attachments()]


def test_password_is_never_returned_and_only_super_admin_configures(crm, sa):
    saved = configure(crm, sa)
    assert "smtpPassword" not in saved and saved["passwordSet"] is True
    assert saved["senderEmail"] == "welcome@firm.in"

    got = crm.client.get("/api/email/settings", headers=bearer(crm.token(ADMIN))).json()
    assert "smtpPassword" not in got and got["slotCount"] == 19

    # Saving again with a blank password keeps the stored one
    configure(crm, sa, smtpPassword="")
    assert crm.store.get_value("emailSettings")["smtpPassword"] == "app-pass"

    assert crm.client.put("/api/email/settings", json={"senderEmail": "x@y.in"}, headers=bearer(crm.token(ADMIN))).status_code == 403
    assert crm.client.get("/api/email/settings", headers=bearer(crm.token(EXEC))).status_code == 403
    bad = crm.client.put("/api/email/settings", json={"senderEmail": "not-an-email"}, headers=sa)
    assert bad.status_code == 400


def test_slots_are_limited_to_19_and_by_size(crm, sa):
    clear_slots(crm, sa)
    assert upload(crm, sa, 20, "x.pdf").status_code == 404
    assert upload(crm, sa, 0, "x.pdf").status_code == 404
    too_big = b"x" * (crm.email_kit.MAX_FILE_BYTES + 1)
    assert upload(crm, sa, 1, "big.pdf", too_big).status_code == 413

    assert upload(crm, sa, 3, "../../etc/Guide.pdf").status_code == 200
    listing = crm.client.get("/api/email/welcome-kit/files", headers=sa).json()
    assert len(listing["slots"]) == 19
    slot3 = listing["slots"][2]
    assert slot3["filled"] and "/" not in slot3["fileName"]
    assert crm.client.get("/api/email/welcome-kit/files/3", headers=sa).content == b"hello"
    assert upload(crm, bearer(crm.token(ADMIN)), 4, "a.pdf").status_code == 403


def test_send_attaches_only_uploaded_files_from_the_configured_sender(crm, sa, smtp, monkeypatch):
    configure(crm, sa)
    clear_slots(crm, sa)
    upload(crm, sa, 2, "Welcome Letter.pdf", b"letter")
    upload(crm, sa, 7, "Risk Disclosure.pdf", b"risk")
    upload(crm, sa, 19, "Brochure.png", b"png", "image/png")
    add_sale(crm, "sale-unsigned")
    monkeypatch.setattr(crm.leegality, "fetch_completed_pdf", lambda *a: pytest.fail("no document, so Leegality is not asked"))

    res = crm.client.post("/api/email/welcome-kit/send", json={"saleId": "sale-unsigned"}, headers=sa)
    assert res.status_code == 200, res.text
    assert res.json()["agreementAttached"] is False

    msg = smtp.sent[-1]
    assert msg["To"] == "client@example.com"
    assert "welcome@firm.in" in msg["From"] and "Firm Welcome Desk" in msg["From"]
    assert smtp.logins[-1] == ("welcome@firm.in", "app-pass")
    assert attachments(msg) == [("Welcome Letter.pdf", b"letter"), ("Risk Disclosure.pdf", b"risk"), ("Brochure.png", b"png")]
    assert "Ravi Kumar" in msg.get_body(("plain",)).get_content()


def test_signed_agreement_is_attached_once_esign_is_completed(crm, sa, smtp, monkeypatch):
    configure(crm, sa)
    clear_slots(crm, sa)
    upload(crm, sa, 1, "Welcome Letter.pdf", b"letter")
    add_sale(crm, "sale-signed", eSignStatus="Completed", eSignDocumentId="DOC-1")
    calls = []

    def fake_fetch(doc_id, kind):
        calls.append((doc_id, kind))
        return "COMPLETED", b"%PDF signed"
    monkeypatch.setattr(crm.leegality, "fetch_completed_pdf", fake_fetch)

    res = crm.client.post("/api/email/welcome-kit/send", json={"saleId": "sale-signed"}, headers=bearer(crm.token(ADMIN)))
    assert res.status_code == 200, res.text
    assert calls == [("DOC-1", "file")]
    assert res.json()["agreementAttached"] is True
    assert attachments(smtp.sent[-1]) == [("Welcome Letter.pdf", b"letter"), ("Signed Agreement - Ravi Kumar.pdf", b"%PDF signed")]

    log = crm.client.get("/api/email/welcome-kit/log", headers=sa).json()
    assert log[0]["saleId"] == "sale-signed" and log[0]["agreementAttached"] is True


def test_document_not_yet_signed_sends_files_without_agreement(crm, sa, smtp, monkeypatch):
    configure(crm, sa)
    clear_slots(crm, sa)
    upload(crm, sa, 5, "Kit.pdf", b"kit")
    add_sale(crm, "sale-pending", eSignDocumentId="DOC-2")
    monkeypatch.setattr(crm.leegality, "fetch_completed_pdf", lambda *a: ("SENT", None))

    res = crm.client.post("/api/email/welcome-kit/send", json={"saleId": "sale-pending"}, headers=sa)
    assert res.status_code == 200 and res.json()["agreementStatus"] == "SENT"
    assert attachments(smtp.sent[-1]) == [("Kit.pdf", b"kit")]


def test_nothing_is_sent_when_leegality_cannot_be_asked(crm, sa, smtp, monkeypatch):
    configure(crm, sa)
    upload(crm, sa, 1, "Kit.pdf", b"kit")
    add_sale(crm, "sale-down", eSignStatus="Completed", eSignDocumentId="DOC-3")

    def down(*a):
        raise HTTPException(status_code=502, detail="Could not reach Leegality")
    monkeypatch.setattr(crm.leegality, "fetch_completed_pdf", down)
    before = len(smtp.sent)
    res = crm.client.post("/api/email/welcome-kit/send", json={"saleId": "sale-down"}, headers=sa)
    assert res.status_code == 502
    assert len(smtp.sent) == before


def test_send_refuses_without_recipient_or_sender_or_files(crm, sa, smtp):
    configure(crm, sa)
    clear_slots(crm, sa)
    add_sale(crm, "sale-noemail", email="")
    res = crm.client.post("/api/email/welcome-kit/send", json={"saleId": "sale-noemail"}, headers=sa)
    assert res.status_code == 400 and "Email ID" in res.json()["detail"]

    add_sale(crm, "sale-empty")
    res = crm.client.post("/api/email/welcome-kit/send", json={"saleId": "sale-empty"}, headers=sa)
    assert res.status_code == 400 and "Nothing to send" in res.json()["detail"]

    assert crm.client.post("/api/email/welcome-kit/send", json={"saleId": "sale-empty"},
                           headers=bearer(crm.token(EXEC))).status_code == 403

    crm.client.delete("/api/email/settings/password", headers=sa)
    upload(crm, sa, 1, "Kit.pdf")
    res = crm.client.post("/api/email/welcome-kit/send", json={"saleId": "sale-empty"}, headers=sa)
    assert res.status_code == 400 and "SMTP Password" in res.json()["detail"]
    assert smtp.sent == []
