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


class FakeIMAP:
    """Stands in for imaplib.IMAP4_SSL: a mailbox whose Sent folder is flagged like Hostinger's."""
    appended = []
    folders = [b'(\HasNoChildren) "." "INBOX"', b'(\HasNoChildren \Sent) "." "INBOX.Sent"']
    fail = False

    def __init__(self, host, port, timeout=None, ssl_context=None):
        if FakeIMAP.fail:
            raise OSError("connection refused")
        self.host = host

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def login(self, user, password):
        pass

    def list(self):
        return "OK", list(FakeIMAP.folders)

    def append(self, folder, flags, date, message):
        FakeIMAP.appended.append((self.host, folder, flags, message))
        return "OK", [b"APPEND completed"]


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


def dispatched(crm, sale_id, doc_id, email="client@example.com", status="SENT"):
    """What backend/leegality.py records when the Super Admin dispatches the e-sign."""
    with crm.store.update_value("leegalityDocuments", {}) as box:
        box[0][doc_id] = {"documentId": doc_id, "saleId": sale_id, "documentStatus": status,
                          "dispatchedAt": "2026-11-15T10:00:00", "sentContact": {"email": email, "phone": "9876543210"}}


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
    dispatched(crm, "sale-signed", "DOC-1", status="COMPLETED")
    calls = []

    def fake_fetch(doc_id, kind):
        calls.append((doc_id, kind))
        return "COMPLETED", b"%PDF signed"
    monkeypatch.setattr(crm.leegality, "fetch_completed_pdf", fake_fetch)
    monkeypatch.setattr(crm.leegality, "kyc_documents", lambda doc, name, email: [
        (f"e-KYC Audit Trail - {name}.pdf", "application/pdf", b"%PDF audit"),
        ("KYC - ../PAN Card.jpg", "image/jpeg", b"pan")])

    res = crm.client.post("/api/email/welcome-kit/send", json={"saleId": "sale-signed"}, headers=bearer(crm.token(ADMIN)))
    assert res.status_code == 200, res.text
    assert calls == [("DOC-1", "file")]
    assert res.json()["agreementAttached"] is True
    assert res.json()["kycFiles"] == ["e-KYC Audit Trail - Ravi Kumar.pdf", "KYC - .._PAN Card.jpg"]
    assert attachments(smtp.sent[-1]) == [("Welcome Letter.pdf", b"letter"), ("Signed Agreement - Ravi Kumar.pdf", b"%PDF signed"),
                                          ("e-KYC Audit Trail - Ravi Kumar.pdf", b"%PDF audit"), ("KYC - .._PAN Card.jpg", b"pan")]

    log = crm.client.get("/api/email/welcome-kit/log", headers=sa).json()
    assert log[0]["saleId"] == "sale-signed" and log[0]["agreementAttached"] is True


def test_document_not_yet_signed_sends_files_without_agreement(crm, sa, smtp, monkeypatch):
    configure(crm, sa)
    clear_slots(crm, sa)
    upload(crm, sa, 5, "Kit.pdf", b"kit")
    add_sale(crm, "sale-pending")
    dispatched(crm, "sale-pending", "DOC-2")
    monkeypatch.setattr(crm.leegality, "fetch_completed_pdf", lambda *a: ("SENT", None))

    res = crm.client.post("/api/email/welcome-kit/send", json={"saleId": "sale-pending"}, headers=sa)
    assert res.status_code == 200 and res.json()["agreementStatus"] == "SENT"
    assert attachments(smtp.sent[-1]) == [("Kit.pdf", b"kit")]


def test_nothing_is_sent_when_leegality_cannot_be_asked(crm, sa, smtp, monkeypatch):
    configure(crm, sa)
    upload(crm, sa, 1, "Kit.pdf", b"kit")
    add_sale(crm, "sale-down", eSignStatus="Completed")
    dispatched(crm, "sale-down", "DOC-3", status="COMPLETED")

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


def test_a_document_id_on_the_sale_itself_is_never_trusted(crm, sa, smtp, monkeypatch):
    """A submitter can edit their open sale; pointing it at another client's agreement must not leak that PDF."""
    configure(crm, sa)
    clear_slots(crm, sa)
    upload(crm, sa, 1, "Kit.pdf", b"kit")
    dispatched(crm, "victim-sale", "DOC-VICTIM", email="victim@example.com", status="COMPLETED")
    add_sale(crm, "forged-sale", email="attacker@example.com", eSignStatus="Completed", eSignDocumentId="DOC-VICTIM",
             eSignDetails={"documentId": "DOC-VICTIM"})
    monkeypatch.setattr(crm.leegality, "fetch_completed_pdf", lambda *a: pytest.fail("the victim's agreement must not be fetched"))

    preview = crm.client.get("/api/email/welcome-kit/preview/forged-sale", headers=sa).json()
    assert preview["agreement"]["documentId"] is None and preview["agreement"]["signed"] is False

    res = crm.client.post("/api/email/welcome-kit/send", json={"saleId": "forged-sale"}, headers=sa)
    assert res.status_code == 200 and res.json()["agreementAttached"] is False
    assert attachments(smtp.sent[-1]) == [("Kit.pdf", b"kit")]


def test_agreement_only_goes_to_the_address_it_was_sent_to_for_signing(crm, sa, smtp, monkeypatch):
    configure(crm, sa)
    upload(crm, sa, 1, "Kit.pdf", b"kit")
    dispatched(crm, "sale-moved", "DOC-MOVED", email="signer@example.com", status="COMPLETED")
    add_sale(crm, "sale-moved", email="someone-else@example.com", eSignStatus="Completed")
    monkeypatch.setattr(crm.leegality, "fetch_completed_pdf", lambda *a: pytest.fail("must refuse before fetching"))
    before = len(smtp.sent)
    res = crm.client.post("/api/email/welcome-kit/send", json={"saleId": "sale-moved"}, headers=sa)
    assert res.status_code == 409 and "signer@example.com" in res.json()["detail"]
    assert len(smtp.sent) == before


def test_a_copy_of_every_sent_kit_is_saved_to_the_sent_folder(crm, sa, smtp):
    configure(crm, sa)
    clear_slots(crm, sa)
    upload(crm, sa, 1, "Kit.pdf", b"kit")
    add_sale(crm, "sale-sentcopy")
    res = crm.client.post("/api/email/welcome-kit/send", json={"saleId": "sale-sentcopy"}, headers=sa)
    assert res.status_code == 200, res.text
    assert res.json()["savedToSent"] is True and res.json()["sentFolder"] == "INBOX.Sent"
    host, folder, flags, raw = FakeIMAP.appended[-1]
    assert host == "imap.firm.in" and "Seen" in flags
    assert raw == smtp.sent[-1].as_bytes()


def test_a_failed_sent_copy_does_not_fail_the_send(crm, sa, smtp):
    configure(crm, sa)
    upload(crm, sa, 1, "Kit.pdf", b"kit")
    add_sale(crm, "sale-imapdown")
    FakeIMAP.fail = True
    res = crm.client.post("/api/email/welcome-kit/send", json={"saleId": "sale-imapdown"}, headers=sa)
    assert res.status_code == 200 and len(smtp.sent) == 1
    assert res.json()["savedToSent"] is False and "connection refused" in res.json()["sentCopyError"]


# ---------- e-KYC documents from Leegality ----------
class FakeResponse:
    def __init__(self, content, ctype="application/pdf", status=200):
        self.content, self.status_code, self.headers = content, status, {"content-type": ctype}


@pytest.fixture
def fake_leegality(crm, monkeypatch):
    """A Leegality whose COMPLETED document returns `state['invitation']` and serves files from `state['cdn']`."""
    lg = crm.leegality
    state = {"invitation": {"inviteeType": "SIGNER", "email": "ravi@example.com", "invitationUrl": "https://sign/abc"}, "cdn": {}, "fetch": {}, "fetch_calls": []}
    monkeypatch.setattr(lg, "_settings", lambda: {"token": "t", "salt": "", "base_url": "https://lg"})
    monkeypatch.setattr(lg, "fetch_completed_pdf", lambda doc, kind: ("COMPLETED", b"%PDF audit") if kind == "auditTrail" else ("COMPLETED", b"x"))

    def fake_api(method, path, settings, **kw):
        if path == "/v3.3/document/details":
            return 200, {"status": 1, "data": {"invitations": [state["invitation"]]}}
        if path == "/v3.3/document/fetchDocument":
            state["fetch_calls"].append(kw["params"]["index"])
            url = state["fetch"].get(kw["params"]["index"])
            return 200, ({"status": 1, "data": {"file": url}} if url else {"status": 0, "messages": [{"message": "no file"}]})
        raise AssertionError(path)
    monkeypatch.setattr(lg, "_leegality", fake_api)
    monkeypatch.setattr(lg.httpx, "get", lambda url, timeout=None: state["cdn"][url])
    return state


def test_virtual_sign_gives_only_the_audit_trail(crm, fake_leegality):
    # What Leegality really returns for a Virtual Sign signer: the typed name, nothing verified
    fake_leegality["invitation"].update(usedSignatureType="Virtual Sign", certificateData={"name": "Ravi", "yob": None},
                                        verificationResponse={"nameVerification": None})
    files = crm.leegality.kyc_documents("DOC", "Ravi Kumar", "Ravi@Example.com")
    assert [(n, t) for n, t, _ in files] == [("e-KYC Audit Trail - Ravi Kumar.pdf", "application/pdf")]


def test_aadhaar_esign_adds_an_ekyc_certificate_built_from_leegality_values(crm, fake_leegality):
    fake_leegality["invitation"]["usedSignatureType"] = "Aadhaar eSign"
    fake_leegality["invitation"]["certificateData"] = {"name": "RAVI KUMAR", "yob": "1990", "gender": "M", "title": "XXXXXXXX1234",
                                                       "state": "Karnataka", "uid": None, "photoHash": "abc"}
    fake_leegality["invitation"]["verificationResponse"] = {"nameVerification": True}
    files = crm.leegality.kyc_documents("DOC", "Ravi Kumar", "Ravi@Example.com")
    assert [n for n, _, _ in files] == ["e-KYC Audit Trail - Ravi Kumar.pdf", "Aadhaar e-KYC Certificate - Ravi Kumar.pdf"]
    assert files[1][2].startswith(b"%PDF")


def test_client_kyc_uploads_are_downloaded_from_leegality(crm, fake_leegality):
    fake_leegality["invitation"]["supportingDocuments"] = [{"name": "PAN.jpg"}, {"name": "Aadhaar.pdf", "file": "https://cdn/direct"}]
    fake_leegality["fetch"] = {1: "https://cdn/pan"}  # index starts at 1 on this Leegality
    fake_leegality["cdn"] = {"https://cdn/pan": FakeResponse(b"pan", "image/jpeg"), "https://cdn/direct": FakeResponse(b"aad")}
    files = crm.leegality.kyc_documents("DOC", "Ravi Kumar", "Ravi@Example.com")
    assert [(n, t, c) for n, t, c in files[1:]] == [("KYC - PAN.jpg", "image/jpeg", b"pan"), ("KYC - Aadhaar.pdf", "application/pdf", b"aad")]
    assert fake_leegality["fetch_calls"] == [0, 1]


def test_a_listed_kyc_upload_that_cannot_be_fetched_stops_the_send(crm, fake_leegality):
    fake_leegality["invitation"]["supportingDocuments"] = [{"name": "PAN.jpg"}]
    with pytest.raises(HTTPException) as err:
        crm.leegality.kyc_documents("DOC", "Ravi Kumar", "Ravi@Example.com")
    assert err.value.status_code == 502 and "PAN.jpg" in err.value.detail


def test_ekyc_files_only_come_from_the_recipients_own_signer_entry(crm, fake_leegality):
    fake_leegality["invitation"].update(email="other@example.com", usedSignatureType="Aadhaar eSign",
                                        certificateData={"name": "SOMEONE ELSE", "yob": "1980"},
                                        supportingDocuments=[{"name": "Their PAN.jpg"}])
    files = crm.leegality.kyc_documents("DOC", "Ravi Kumar", "ravi@example.com")
    assert [n for n, _, _ in files] == ["e-KYC Audit Trail - Ravi Kumar.pdf"]


def test_certificate_text_is_escaped(crm):
    pdf = crm.leegality._certificate_pdf('<img src="/etc/passwd" width="9" height="9"/>Ravi', "DOC<b>", {"name": "R<i>"}, {}, None)
    assert pdf.startswith(b"%PDF")
