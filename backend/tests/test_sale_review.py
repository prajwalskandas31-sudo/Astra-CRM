import base64

import pytest

from backend.tests.conftest import bearer

SA = "superadmin@company.com"
EXEC = "tajayvarma76@gmail.com"      # usr-3
EXEC_ID = "usr-3"
GROUP = -1001234567890
AWAITING = "Awaiting Telegram Approval"
PNG = "data:image/png;base64," + base64.b64encode(b"\x89PNG fake").decode()


class Calls(list):
    pass


@pytest.fixture
def bot(crm, monkeypatch):
    """Review bot on, Telegram stubbed: every call is recorded and answers like Telegram would."""
    monkeypatch.setenv("SALE_REVIEW_BOT_TOKEN", "999:test")
    monkeypatch.delenv("SALE_REVIEW_CHAT_ID", raising=False)
    global sr
    from backend import sale_review as sr
    for key in (sr.OUTBOX, sr.MIGRATED, "saleReviewAttempts"):
        crm.store.delete("kv", key)
    calls = Calls()

    def fake(method, timeout=20, files=None, **payload):
        calls.append((method, payload, files))
        return {"message_id": 77} if method in ("sendMessage", "sendDocument") else True

    monkeypatch.setattr(sr, "_telegram", fake)
    calls.link = lambda chat_id=GROUP: monkeypatch.setenv("SALE_REVIEW_CHAT_ID", str(chat_id))
    return calls


def push(crm, token, upserts=(), deletes=()):
    res = crm.client.post("/api/sync", json={"collections": {"sales": {"upserts": list(upserts), "deletes": list(deletes)}}},
                          headers=bearer(token))
    assert res.status_code == 200, res.text
    return res.json()


def sale(sale_id, status=AWAITING, stage=AWAITING):
    info = {"panNumber": "ABCDE1234F", "clientCategory": "Individual", "clientPrefix": "Mr.", "clientName": "Ravi <Kumar>",
            "email": "ravi@example.com", "phone1": "9876543210", "phone2": "", "clientState": "Karnataka",
            "paymentDate": "2026-11-16", "serviceName": "Index Options", "serviceTenure": "3 Months",
            "transactionNumbers": ["UTR123"], "grossSales": "118000", "netSales": "100000.00", "gst": "18000.00"}
    return {"id": sale_id, "date": "2026-11-16", "clientName": "Ravi <Kumar>", "contactPerson": "Ravi <Kumar>",
            "amount": "₹1,18,000", "grossSales": "118000", "employeeName": "AJAY", "submittedByUserId": EXEC_ID,
            "leadId": "lead-sr-1", "status": status, "stage": stage, "fullClientInfo": info,
            "transactionAttachments": [{"name": "proof.png", "type": "image/png", "dataUrl": PNG}]}


def callback(action, sale_id, chat_id=GROUP):
    sr.handle_update({"update_id": 1, "callback_query": {
        "id": "cb1", "data": f"{action}:{sale_id}", "from": {"first_name": "Meena", "username": "meena_ops"},
        "message": {"message_id": 77, "chat": {"id": chat_id}, "text": "old"}}})


def command(chat_id, text="/bind@Client_info_page_updates_bot"):
    sr.handle_update({"update_id": 2, "message": {"chat": {"id": chat_id, "type": "supergroup", "title": "Some group"},
                                                  "text": text}})


def test_status_reports_enabled(crm, bot):
    res = crm.client.get("/api/sale-review/status", headers=bearer(crm.token(EXEC)))
    assert res.json() == {"enabled": True}
    assert "linked" in crm.client.get("/api/sale-review/status", headers=bearer(crm.token(SA))).json()


def test_new_sales_must_go_through_the_group(crm, bot):
    body = push(crm, crm.token(EXEC), [sale("SL-direct", "Pending Super Admin Review", "Under Review by Super Admin")])
    assert body["rejected"]["sales"] and "Telegram" in body["rejected"]["sales"][0]["reason"]
    body = push(crm, crm.token(EXEC), [sale("SL-tg1")])
    assert body["saved"]["sales"] == ["SL-tg1"]
    assert crm.store.get_value(sr.OUTBOX) == ["SL-tg1"]


def test_posts_full_details_with_buttons_once_bound(crm, bot):
    push(crm, crm.token(EXEC), [sale("SL-tg2")])
    sr.flush_outbox()
    assert not [c for c in bot if c[0] == "sendMessage"]  # no group configured yet: stays queued
    assert "SL-tg2" in crm.store.get_value(sr.OUTBOX)

    bot.link()
    sr.flush_outbox()
    msg = [c for c in bot if c[0] == "sendMessage" and c[1].get("reply_markup")][-1][1]
    assert msg["chat_id"] == GROUP and msg["parse_mode"] == "HTML"
    for text in ("ABCDE1234F", "Mr. Ravi &lt;Kumar&gt;", "ravi@example.com", "9876543210", "Karnataka",
                 "Index Options", "3 Months", "UTR123", "₹1,18,000.00", "₹1,00,000.00", "proof.png"):
        assert text in msg["text"], text
    assert "?ekyc=SL-tg2" not in msg["text"]  # no CRM_PUBLIC_URL in tests: no link
    buttons = msg["reply_markup"]["inline_keyboard"][0]
    assert [b["callback_data"] for b in buttons] == ["sra:SL-tg2", "srr:SL-tg2"]
    doc = [c for c in bot if c[0] == "sendDocument"][-1]
    assert doc[2]["document"][1] == b"\x89PNG fake"
    assert crm.store.get_value(sr.OUTBOX) == []


def test_approve_moves_sale_to_the_queue(crm, bot):
    push(crm, crm.token(EXEC), [sale("SL-tg3")])
    bot.link()
    callback("sra", "SL-tg3")
    stored = crm.store.get("sales", "SL-tg3")
    assert stored["status"] == "Pending Super Admin Review" and stored["stage"] == "Under Review by Super Admin"
    assert stored["telegramReview"]["decision"] == "Approved" and "meena_ops" in stored["telegramReview"]["by"]
    notes = [n for n in crm.store.all("notifications") if (n.get("actionPayload") or {}).get("saleId") == "SL-tg3"]
    assert {n.get("targetRole") or n.get("targetUserId") for n in notes} == {"Super Admin", EXEC_ID}
    edited = [c for c in bot if c[0] == "editMessageText"][-1][1]
    assert "APPROVED" in edited["text"] and "reply_markup" not in edited

    # A second tap (or the other button) changes nothing
    callback("srr", "SL-tg3")
    assert crm.store.get("sales", "SL-tg3")["status"] == "Pending Super Admin Review"
    assert "Already decided" in [c for c in bot if c[0] == "answerCallbackQuery"][-1][1]["text"]


def test_reject_sends_it_back_and_it_can_be_resubmitted(crm, bot):
    tok = crm.token(EXEC)
    push(crm, tok, [sale("SL-tg4")])
    bot.link()
    callback("srr", "SL-tg4")
    assert crm.store.get("sales", "SL-tg4")["status"] == sr.REJECTED_STATUS
    # The executive corrects it: the rejected sale is replaced by a new submission
    body = push(crm, tok, [sale("SL-tg5")], deletes=["SL-tg4"])
    assert body["saved"]["sales"] == ["SL-tg5", "SL-tg4"]
    callback("sra", "SL-tg4")
    assert "no longer exists" in [c for c in bot if c[0] == "answerCallbackQuery"][-1][1]["text"]


def test_buttons_from_another_chat_do_nothing(crm, bot):
    push(crm, crm.token(EXEC), [sale("SL-tg6")])
    bot.link()
    callback("sra", "SL-tg6", chat_id=-100999)
    assert crm.store.get("sales", "SL-tg6")["status"] == sr.AWAITING_STATUS


def test_a_group_cannot_link_itself_from_telegram(crm, bot):
    """/bind or /chatid only reports the id: a stranger's group never receives client data."""
    push(crm, crm.token(EXEC), [sale("SL-tg8")])
    command(-100999)
    command(-100999, "/chatid")
    assert sr.chat() is None
    replies = [c[1] for c in bot if c[0] == "sendMessage"]
    assert all(r["chat_id"] == -100999 and "SALE_REVIEW_CHAT_ID=-100999" in r["text"] for r in replies)
    sr.flush_outbox()
    assert len([c for c in bot if c[0] == "sendMessage"]) == 2  # still nothing posted
    assert "SL-tg8" in crm.store.get_value(sr.OUTBOX)


def test_follows_the_configured_group_to_its_supergroup(crm, bot):
    bot.link(-4001)
    sr.handle_update({"update_id": 3, "message": {"chat": {"id": -4001, "type": "group"}, "migrate_to_chat_id": -1004001}})
    assert sr.chat()["id"] == -1004001
    sr.handle_update({"update_id": 4, "message": {"chat": {"id": -555, "type": "group"}, "migrate_to_chat_id": -1009}})
    assert sr.chat()["id"] == -1004001


def test_executive_cannot_approve_through_sync(crm, bot):
    tok = crm.token(EXEC)
    push(crm, tok, [sale("SL-tg7")])
    body = push(crm, tok, [{**sale("SL-tg7"), "status": "Pending Super Admin Review", "stage": "Under Review by Super Admin"}])
    assert body["rejected"]["sales"]
    assert crm.store.get("sales", "SL-tg7")["status"] == sr.AWAITING_STATUS


def test_without_a_token_sales_go_straight_to_the_queue(crm, bot, monkeypatch):
    monkeypatch.delenv("SALE_REVIEW_BOT_TOKEN", raising=False)
    body = push(crm, crm.token(EXEC), [sale("SL-plain", "Pending Super Admin Review", "Under Review by Super Admin")])
    assert body["saved"]["sales"] == ["SL-plain"]


def test_includes_the_ekyc_link_when_the_crm_address_is_set(crm, bot, monkeypatch):
    monkeypatch.setenv("CRM_PUBLIC_URL", "http://200.234.32.65:8080")
    assert 'href="http://200.234.32.65:8080/?ekyc=SL-x"' in sr.render(sale("SL-x"))


def test_review_message_shows_the_employee_sharing(crm, bot):
    s = sale("SL-share")
    s["fullClientInfo"]["employeeSharing"] = {
        "present": True, "mode": "fixed", "totalAmount": 18000, "remaining": 100000,
        "shares": [{"name": "Ajay <A>", "employeeCode": "EMP-7", "value": 18000, "amount": 18000}]}
    text = sr.render(s)
    assert "Sharing Present: Yes, Fixed Value" in text
    assert "• Ajay &lt;A&gt; (EMP-7): ₹1,18,000.00" not in text
    assert "• Ajay &lt;A&gt; (EMP-7): ₹18,000.00" in text
    assert "Remaining Balance: ₹1,00,000.00" in text
    assert "Sharing Present: No" in sr.render(sale("SL-none"))


def test_review_message_shows_the_modes_of_payment(crm, bot):
    s = sale("SL-modes")
    s["fullClientInfo"]["paymentModes"] = [{"mode": "NEFT", "amount": 100000}, {"mode": "UPI", "amount": 18000}]
    text = sr.render(s)
    assert "Mode of Payment: 2 mode(s)" in text
    assert "• NEFT: ₹1,00,000.00" in text
    assert "Total Paid: ₹1,18,000.00" in text
    assert "Mode of Payment: —" in sr.render(sale("SL-nomodes"))
