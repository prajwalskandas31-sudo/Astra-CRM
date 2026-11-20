import smtplib


from backend.tests.conftest import bearer
from backend.tests.test_email_kit import FakeSMTP, FakeIMAP, configure, upload, add_sale, SA, EXEC  # noqa: F401
from backend.tests.test_email_kit import smtp, sa  # noqa: F401  (fixtures)

DSN_BOUNCE = b"""From: Mail Delivery System <MAILER-DAEMON@smtp.firm.in>
To: welcome@firm.in
Subject: Undelivered Mail Returned to Sender
Date: Wed, 18 Nov 2026 10:15:00 +0530
Message-ID: <bounce-1@smtp.firm.in>
MIME-Version: 1.0
Content-Type: multipart/report; report-type=delivery-status; boundary="BB"

--BB
Content-Type: text/plain

Your message could not be delivered.

--BB
Content-Type: message/delivery-status

Reporting-MTA: dns; smtp.firm.in

Final-Recipient: rfc822; dead.client@example.com
Action: failed
Status: 5.1.1
Diagnostic-Code: smtp; 550 5.1.1 <dead.client@example.com>: Recipient address rejected: User unknown

--BB
Content-Type: text/rfc822-headers

From: welcome@firm.in
To: dead.client@example.com
Subject: Welcome to Firm
Message-ID: <orig-1@firm.in>

--BB--
"""

EXIM_BOUNCE = b"""From: Mail Delivery System <Mailer-Daemon@hostinger.com>
To: welcome@firm.in
Subject: Mail delivery failed: returning message to sender
Date: Thu, 19 Nov 2026 09:00:00 +0000
Message-ID: <bounce-2@hostinger.com>
Content-Type: text/plain; charset=utf-8

This message was created automatically by mail delivery software.

A message that you sent could not be delivered to one or more of its
recipients. This is a permanent error. The following address(es) failed:

  full.box@example.org
    host mx.example.org [1.2.3.4]
    SMTP error from remote mail server after RCPT TO:<full.box@example.org>:
    552 5.2.2 Mailbox full

------ This is a copy of the message, including all the headers. ------
From: welcome@firm.in
To: full.box@example.org
Subject: Invoice BLR1126001 from Firm
"""


def test_parse_bounce_reads_dsn_and_plain_text_bounces(crm):
    [dsn] = crm.email_failures.parse_bounce(DSN_BOUNCE, ["welcome@firm.in"])
    assert dsn["to"] == "dead.client@example.com" and dsn["status"] == "5.1.1"
    assert "User unknown" in dsn["diagnostic"] and dsn["originalSubject"] == "Welcome to Firm"
    assert dsn["at"].startswith("2026-11-18T04:45")

    [exim] = crm.email_failures.parse_bounce(EXIM_BOUNCE, ["welcome@firm.in"])
    assert exim["to"] == "full.box@example.org" and exim["action"] == "failed"
    assert "Mailbox full" in exim["diagnostic"]


def test_failed_welcome_kit_is_reported_until_a_later_send_succeeds(crm, sa, smtp, monkeypatch):
    configure(crm, sa)
    upload(crm, sa, 1, "Kit.pdf", b"kit")
    add_sale(crm, "sale-fail", email="ravi@example.com")

    def refuse(self, msg):
        raise smtplib.SMTPRecipientsRefused({"ravi@example.com": (550, b"no such user")})
    monkeypatch.setattr(FakeSMTP, "send_message", refuse)
    res = crm.client.post("/api/email/welcome-kit/send", json={"saleId": "sale-fail"}, headers=sa)
    assert res.status_code == 502

    add_sale(crm, "sale-noemail", email="")
    assert crm.client.post("/api/email/welcome-kit/send", json={"saleId": "sale-noemail"}, headers=sa).status_code == 400

    report = crm.client.get("/api/email/failures", headers=sa).json()
    rows = {r["saleId"]: r for r in report["rows"] if r["source"] == "Welcome Kit"}
    assert "refused the client's email address" in rows["sale-fail"]["error"]
    assert rows["sale-fail"]["to"] == "ravi@example.com" and rows["sale-fail"]["clientName"] == "Ravi Kumar"
    assert "no Email ID" in rows["sale-noemail"]["error"]
    assert not rows["sale-fail"]["resolved"] and report["summary"]["open"] >= 2

    monkeypatch.undo()
    monkeypatch.setattr(crm.email_kit.smtplib, "SMTP_SSL", FakeSMTP)
    monkeypatch.setattr(crm.email_kit.imaplib, "IMAP4_SSL", FakeIMAP)
    assert crm.client.post("/api/email/welcome-kit/send", json={"saleId": "sale-fail"}, headers=sa).status_code == 200
    rows = {r["saleId"]: r for r in crm.client.get("/api/email/failures", headers=sa).json()["rows"] if r["source"] == "Welcome Kit"}
    assert rows["sale-fail"]["resolved"].startswith("Welcome Kit sent to ravi@example.com")


class BounceIMAP(FakeIMAP):
    messages = {b"7": DSN_BOUNCE, b"9": EXIM_BOUNCE}

    def select(self, folder, readonly=False):
        assert readonly is True
        return "OK", [b"2"]

    def search(self, charset, criteria):
        return "OK", [b"7 9"]

    def fetch(self, num, parts):
        assert "PEEK" in parts
        return "OK", [(b"%s (BODY[] {1})" % num, BounceIMAP.messages[num]), b")"]


def test_mailbox_scan_lists_bounced_clients_and_rows_can_be_marked_reviewed(crm, sa, smtp, monkeypatch):
    configure(crm, sa)
    add_sale(crm, "sale-dead", email="Dead.Client@example.com")
    monkeypatch.setattr(crm.email_failures.imaplib, "IMAP4_SSL", BounceIMAP)

    res = crm.client.post("/api/email/failures/scan", headers=sa)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["scan"]["checked"] == 2 and not body["scan"]["error"]
    bounces = {r["to"]: r for r in body["rows"] if r["source"] == "Bounced (mailbox)"}
    assert bounces["dead.client@example.com"]["clientName"] == "Ravi Kumar"
    assert bounces["dead.client@example.com"]["saleId"] == "sale-dead"
    assert bounces["full.box@example.org"]["matched"] is False

    # Scanning again does not duplicate
    again = crm.client.post("/api/email/failures/scan", headers=sa).json()
    assert sum(r["source"] == "Bounced (mailbox)" for r in again["rows"]) == 2

    row_id = bounces["dead.client@example.com"]["id"]
    open_before = again["summary"]["open"]
    marked = crm.client.put(f"/api/email/failures/{row_id}/review", json={"note": "Called client, new email"}, headers=sa)
    assert marked.status_code == 200 and marked.json()["note"] == "Called client, new email"
    after = crm.client.get("/api/email/failures", headers=sa).json()
    assert after["summary"]["open"] == open_before - 1
    crm.client.delete(f"/api/email/failures/{row_id}/review", headers=sa)
    assert crm.client.get("/api/email/failures", headers=sa).json()["summary"]["open"] == open_before

    assert crm.client.put("/api/email/failures/nope/review", json={}, headers=sa).status_code == 404


def test_only_admins_see_the_report(crm):
    assert crm.client.get("/api/email/failures", headers=bearer(crm.token(EXEC))).status_code == 403
