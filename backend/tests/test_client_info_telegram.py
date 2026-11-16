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
    monkeypatch.delenv("CRM_PUBLIC_URL", raising=False)
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


def test_public_url_overrides_and_requires_sign_in(tg, monkeypatch):
    crm, m, calls, replies = tg
    monkeypatch.setenv("TELEGRAM_CLIENT_INFO_CHAT_ID", "-42")
    monkeypatch.setenv("CRM_PUBLIC_URL", "https://crm.example.com")
    assert post(crm, crmUrl="javascript:alert(1)").json()["ekycLink"] == "https://crm.example.com/?ekyc=SL-1"
    res = crm.client.post("/api/client-info/telegram", json={"saleId": "SL-1", "details": {}})
    assert res.status_code in (401, 403)


def test_missing_token_is_reported(tg, monkeypatch):
    crm, m, calls, replies = tg
    monkeypatch.delenv("TELEGRAM_CLIENT_INFO_BOT_TOKEN")
    assert post(crm).status_code == 503
