import pytest

from backend.tests.conftest import bearer

EXEC = "tajayvarma76@gmail.com"
DETAILS = {
    "panNumber": "DIXPS0140B", "clientCategory": "Individual", "clientPrefix": "Mr.", "clientName": "Sree <Kumar>",
    "email": "client@example.com", "phone1": "8095819879", "phone2": "", "clientState": "Arunachal Pradesh",
    "paymentDate": "2026-11-16", "serviceName": "Stock Cash", "serviceTenure": "3 Months",
    "transactionNumbers": ["TXN1", "TXN2"], "grossSales": "178000", "netSales": "150847.46", "gst": "27152.54",
}


@pytest.fixture
def tg(crm, monkeypatch):
    m = crm.client_info_telegram
    monkeypatch.setenv("TELEGRAM_CLIENT_INFO_BOT_TOKEN", "123:abc")
    monkeypatch.delenv("TELEGRAM_CLIENT_INFO_CHAT_ID", raising=False)
    monkeypatch.setenv("CRM_PUBLIC_URL", "http://200.234.32.65:8080/")
    crm.store.set_value(m.CHAT_ID_VALUE, None)
    calls = []
    replies = {}

    def fake(token, method, **payload):
        calls.append((method, payload))
        reply = replies.get(method)
        if callable(reply):
            return reply(payload)
        return reply if reply is not None else {"message_id": 77}

    monkeypatch.setattr(m, "_telegram", fake)
    return crm, m, calls, replies


def post(crm, **body):
    payload = {"saleId": "SL-1", "leadId": "L-9", "crmUrl": "http://200.234.32.65:8080/", "details": DETAILS,
               "attachmentNames": ["receipt.png"], **body}
    return crm.client.post("/api/client-info/telegram", json=payload, headers=bearer(crm.token(EXEC)))


def test_posts_every_detail_and_ends_with_the_ekyc_link(tg):
    crm, m, calls, replies = tg
    replies["getUpdates"] = [{"my_chat_member": {"chat": {"id": -100555, "type": "supergroup", "title": "Client_information_page_updates"}}}]
    res = post(crm)
    assert res.status_code == 200, res.text
    assert res.json()["ekycLink"] == "http://200.234.32.65:8080/?ekyc=SL-1"
    method, sent = calls[-1]
    assert method == "sendMessage" and sent["chat_id"] == "-100555" and sent["parse_mode"] == "HTML"
    text = sent["text"]
    for value in ("DIXPS0140B", "Mr. Sree &lt;Kumar&gt;", "client@example.com", "8095819879", "Arunachal Pradesh",
                  "Stock Cash", "3 Months", "TXN1, TXN2", "₹1,78,000.00", "₹1,50,847.46", "₹27,152.54", "receipt.png"):
        assert value in text, value
    assert "<Kumar>" not in text  # escaped, so Telegram's HTML parser accepts it
    assert text.rstrip().splitlines()[-2] == "http://200.234.32.65:8080/?ekyc=SL-1"
    assert sent["reply_markup"]["inline_keyboard"][0][0]["url"] == "http://200.234.32.65:8080/?ekyc=SL-1"
    # The group is remembered: the next post needs no lookup
    calls.clear()
    assert post(crm).status_code == 200
    assert [c[0] for c in calls] == ["sendMessage"]


def test_unknown_group_asks_for_a_start_message(tg):
    crm, m, calls, replies = tg
    replies["getUpdates"] = []
    res = post(crm)
    assert res.status_code == 503 and "/start@Client_info_page_updates_bot" in res.json()["detail"]


def test_rejected_button_falls_back_to_the_link_in_the_text(tg, monkeypatch):
    crm, m, calls, replies = tg
    monkeypatch.setenv("TELEGRAM_CLIENT_INFO_CHAT_ID", "-42")

    def send(payload):
        if "reply_markup" in payload:
            raise m.TelegramError("Bad Request: BUTTON_URL_INVALID")
        return {"message_id": 5}
    replies["sendMessage"] = send
    res = post(crm)
    assert res.status_code == 200, res.text
    assert "reply_markup" not in calls[-1][1] and "?ekyc=SL-1" in calls[-1][1]["text"]


def test_group_upgraded_to_supergroup_is_followed(tg):
    crm, m, calls, replies = tg
    crm.store.set_value(m.CHAT_ID_VALUE, "-1")

    def send(payload):
        if payload["chat_id"] == "-1":
            raise m.TelegramError("group chat was upgraded to a supergroup chat", {"migrate_to_chat_id": -100777})
        return {"message_id": 6}
    replies["sendMessage"] = send
    assert post(crm).status_code == 200
    assert crm.store.get_value(m.CHAT_ID_VALUE) == "-100777"


def test_link_ignores_the_client_address_and_requires_sign_in(tg, monkeypatch):
    crm, m, calls, replies = tg
    monkeypatch.setenv("TELEGRAM_CLIENT_INFO_CHAT_ID", "-42")
    monkeypatch.setenv("CRM_PUBLIC_URL", "https://crm.example.com")
    for bad in ("javascript:alert(1)", "https://evil.example/phish", "http://crm.example.com@evil.example/"):
        assert post(crm, crmUrl=bad).json()["ekycLink"] == "https://crm.example.com/?ekyc=SL-1"
    res = crm.client.post("/api/client-info/telegram", json={"saleId": "SL-1", "details": {}})
    assert res.status_code in (401, 403)


@pytest.mark.parametrize("public_url", ["javascript:alert(1)", "http://user:pw@evil.example/", "ftp://crm.example.com"])
def test_without_a_safe_public_url_nothing_is_sent(tg, monkeypatch, public_url):
    crm, m, calls, replies = tg
    monkeypatch.setenv("TELEGRAM_CLIENT_INFO_CHAT_ID", "-42")
    monkeypatch.setenv("CRM_PUBLIC_URL", public_url)
    res = post(crm, crmUrl="https://evil.example/")
    assert res.status_code == 503 and "CRM_PUBLIC_URL" in res.text
    assert calls == []


def test_missing_token_is_reported(tg, monkeypatch):
    crm, m, calls, replies = tg
    monkeypatch.delenv("TELEGRAM_CLIENT_INFO_BOT_TOKEN")
    assert post(crm).status_code == 503


SHARING = {"present": True, "mode": "percentage", "totalPercent": 15, "totalAmount": 26700, "remaining": 151300,
           "shares": [{"name": "Ajay <A>", "employeeCode": "EMP-7", "value": 10, "amount": 17800},
                      {"name": "Ravi", "employeeCode": "", "value": 5, "amount": 8900}]}


def test_sharing_lists_each_payout_and_the_remaining_balance(crm):
    m = crm.client_info_telegram
    text = "\n".join(m.detail_lines(m.ClientInfoAlert(saleId="SL-1", details={**DETAILS, "employeeSharing": SHARING})))
    assert "<b>Sharing Present:</b> Yes, % of Gross Sales" in text
    assert "<b>• Ajay &lt;A&gt; (EMP-7):</b> 10% = ₹17,800.00" in text
    assert "<b>• Ravi:</b> 5% = ₹8,900.00" in text
    assert "<b>Total Shared:</b> ₹26,700.00 (15%)" in text
    assert "<b>Remaining Balance:</b> ₹1,51,300.00" in text


def test_sharing_absent_or_fixed(crm):
    m = crm.client_info_telegram
    assert m.sharing_rows(None) == [("Sharing Present", "No")]
    rows = m.sharing_rows({"present": True, "mode": "fixed", "totalAmount": 500, "remaining": 4498,
                           "shares": [{"name": "Ajay", "employeeCode": "EMP-7", "value": 500, "amount": 500}]})
    assert rows == [("Sharing Present", "Yes, Fixed Value"), ("• Ajay (EMP-7)", "₹500.00"),
                    ("Total Shared", "₹500.00"), ("Remaining Balance", "₹4,498.00")]
