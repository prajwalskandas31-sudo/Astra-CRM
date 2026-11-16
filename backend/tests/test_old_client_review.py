import re
from email import message_from_bytes

import pytest
from fastapi import HTTPException

from backend.tests.conftest import bearer

EXEC = "tajayvarma76@gmail.com"
DETAILS = {
    "panNumber": "DIXPS0140B", "clientCategory": "Individual", "clientPrefix": "Mr.", "clientName": "Sree <Kumar>",
    "email": "client@example.com", "phone1": "8095819879", "phone2": "", "clientState": "Karnataka",
    "paymentDate": "2026-11-16", "serviceName": "Stock Cash", "serviceTenure": "3 Months",
    "transactionNumbers": ["TXN1", "TXN2"], "grossSales": "5000", "netSales": "4237.29", "gst": "762.71",
}


@pytest.fixture
def oc(crm, monkeypatch):
    cit, m, ek = crm.client_info_telegram, crm.old_client_review, crm.email_kit
    monkeypatch.setenv("TELEGRAM_CLIENT_INFO_BOT_TOKEN", "123:abc")
    monkeypatch.setenv("TELEGRAM_CLIENT_INFO_CHAT_ID", "-100555")
    monkeypatch.setenv("CRM_PUBLIC_URL", "http://200.234.32.65:8080/")
    calls, mails = [], []

    def fake_telegram(token, method, **payload):
        calls.append((method, payload))
        return {"message_id": 77, "chat": {"id": -100555}}

    monkeypatch.setattr(cit, "_telegram", fake_telegram)
    monkeypatch.setattr(ek, "_smtp_send", lambda settings, msg: mails.append(msg))
    monkeypatch.setattr(ek, "_save_to_sent", lambda settings, msg: {"savedToSent": True})
    crm.store.set_value(ek.SETTINGS, {"senderEmail": "no-reply@example.com", "smtpHost": "smtp.example.com", "smtpPassword": "x"})
    crm.store.put("companyProfile", "companyName", {"id": "companyName", "value": "Unite Tech"})
    crm.store.put("sales", "SL-OC", {"id": "SL-OC", "submittedByUserId": "usr-3", "clientType": "Old Client",
                                     "status": m.STATUS_AWAITING, "stage": m.STAGE_AWAITING})
    crm.store.put("leads", "L-OC", {"id": "L-OC", "assignedToId": "usr-3", "disposition": "Under Review (Old Client)", "history": []})
    return crm, m, calls, mails


def submit(crm, **body):
    payload = {"saleId": "SL-OC", "leadId": "L-OC", "details": DETAILS, "attachmentNames": ["receipt.png"], **body}
    return crm.client.post("/api/client-info/old-client", json=payload, headers=bearer(crm.token(EXEC)))


def link_from(calls):
    text = calls[-1][1]["text"]
    return re.search(r"http://200\.234\.32\.65:8080(/api/client-info/old-client/review/[A-Za-z0-9_-]+)", text).group(1)


def test_submit_posts_every_detail_and_a_review_link_the_submitter_never_gets(oc):
    crm, m, calls, mails = oc
    res = submit(crm)
    assert res.status_code == 200, res.text
    assert "review" not in res.text.lower() and "token" not in res.text.lower()
    method, sent = calls[-1]
    assert method == "sendMessage" and sent["chat_id"] == "-100555"
    for value in ("Old Client", "DIXPS0140B", "Mr. Sree &lt;Kumar&gt;", "client@example.com", "Karnataka", "TXN1, TXN2",
                  "₹5,000.00", "₹762.71", "receipt.png", "Approve / Decline"):
        assert value in sent["text"], value
    path = link_from(calls)
    assert sent["reply_markup"]["inline_keyboard"][0][0]["url"].endswith(path)
    token = path.rsplit("/", 1)[1]
    assert crm.store.get(m.REVIEWS, token) is None  # only the hash is stored
    assert crm.store.get(m.REVIEWS, m._hash(token))["status"] == "pending"


def test_submit_rejects_a_bad_client_email(oc):
    crm, *_ = oc
    assert submit(crm, details={**DETAILS, "email": "not-an-email"}).status_code == 400


def test_anyone_with_the_link_approves_and_only_the_invoice_is_emailed(oc):
    crm, m, calls, mails = oc
    submit(crm)
    path = link_from(calls)
    page = crm.client.get(path)  # no sign-in
    assert page.status_code == 200 and "Sree &lt;Kumar&gt;" in page.text and "<Kumar>" not in page.text
    assert "Approve &amp; email invoice" in page.text
    assert page.headers["referrer-policy"] == "no-referrer"

    res = crm.client.post(f"{path}/approve", data={"reviewer": "Srinivas"}, follow_redirects=False)
    assert res.status_code == 303 and res.headers["location"] == f"../{path.rsplit('/', 1)[1]}"
    assert len(mails) == 1
    msg = message_from_bytes(mails[0].as_bytes())
    assert msg["To"] == "client@example.com" and "Invoice INV/" in msg["Subject"]
    files = [p for p in msg.walk() if p.get_filename()]
    assert len(files) == 1 and files[0].get_content_type() == "application/pdf"  # no Welcome Kit, no e-KYC
    assert files[0].get_payload(decode=True).startswith(b"%PDF")

    record = crm.store.get(m.REVIEWS, m._hash(path.rsplit("/", 1)[1]))
    assert record["status"] == "approved" and record["decidedBy"] == "Srinivas"
    assert re.fullmatch(r"INV/\d{4}-\d{2}/\d{4}", record["invoiceNumber"])
    sale = crm.store.get("sales", "SL-OC")
    assert sale["status"] == m.STATUS_APPROVED and sale["invoiceNumber"] == record["invoiceNumber"]
    lead = crm.store.get("leads", "L-OC")
    assert lead["disposition"] == "Paid / Converted" and "Srinivas" in lead["history"][-1]["text"]
    assert "Approved" in calls[-1][1]["text"] and calls[-1][1]["reply_parameters"]["message_id"] == 77

    # A second tap changes nothing and sends nothing
    crm.client.post(f"{path}/decline", data={"reviewer": "Someone"})
    crm.client.post(f"{path}/approve", data={"reviewer": "Someone"})
    assert len(mails) == 1 and crm.store.get(m.REVIEWS, record["id"])["status"] == "approved"
    assert "Approved by Srinivas" in crm.client.get(path).text


def test_failed_email_can_be_retried_with_the_same_invoice_number(oc, monkeypatch):
    crm, m, calls, mails = oc
    submit(crm)
    path = link_from(calls)

    def down(settings, msg):
        raise HTTPException(status_code=502, detail="mail server down")
    monkeypatch.setattr(crm.email_kit, "_smtp_send", down)
    res = crm.client.post(f"{path}/approve", data={"reviewer": "Srinivas"})
    assert res.status_code == 502 and "mail server down" in res.text
    record = crm.store.get(m.REVIEWS, m._hash(path.rsplit("/", 1)[1]))
    assert record["status"] == "pending"
    first_number = record["invoiceNumber"]

    monkeypatch.setattr(crm.email_kit, "_smtp_send", lambda settings, msg: mails.append(msg))
    crm.client.post(f"{path}/approve", data={"reviewer": "Srinivas"})
    record = crm.store.get(m.REVIEWS, record["id"])
    assert record["status"] == "approved" and record["invoiceNumber"] == first_number and len(mails) == 1


def test_decline_sends_the_sale_back(oc):
    crm, m, calls, mails = oc
    submit(crm)
    path = link_from(calls)
    crm.client.post(f"{path}/decline", data={"reviewer": "Srinivas", "reason": "Wrong amount"})
    assert not mails
    assert crm.store.get("sales", "SL-OC")["status"] == m.STATUS_DECLINED
    assert "Wrong amount" in calls[-1][1]["text"]
    assert "Declined by Srinivas" in crm.client.get(path).text


def test_unknown_or_malformed_link_is_404(oc):
    crm, *_ = oc
    assert crm.client.get("/api/client-info/old-client/review/" + "a" * 43).status_code == 404
    assert crm.client.post("/api/client-info/old-client/review/x/approve", data={"reviewer": "x"}).status_code == 404


def test_executive_may_create_an_old_client_sale_but_not_move_it(crm):
    from backend.tests.test_sync import push
    tok = crm.token(EXEC)
    sale = {"id": "SL-OC-SYNC", "submittedByUserId": "usr-3", "status": "Old Client - Awaiting Approval",
            "stage": "Awaiting Telegram Approval (Old Client)"}
    assert not push(crm, tok, "sales", [sale])["rejected"]["sales"]
    assert push(crm, tok, "sales", [{**sale, "status": "Old Client - Approved", "stage": "Invoice Emailed"}])["rejected"]["sales"]


def test_invoice_words_and_numbers(crm):
    inv = crm.invoice
    assert inv.in_words(5000) == "Rupees Five Thousand Only"
    assert inv.in_words(150847.46) == "Rupees One Lakh Fifty Thousand Eight Hundred Forty Seven and Forty Six Paise Only"
    assert inv.in_words(12345678) == "Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Only"
    assert inv.rupees(150847.46) == "Rs. 1,50,847.46"
    from datetime import datetime
    assert inv.financial_year(datetime(2027, 3, 31)) == "2026-27" and inv.financial_year(datetime(2027, 4, 1)) == "2027-28"
