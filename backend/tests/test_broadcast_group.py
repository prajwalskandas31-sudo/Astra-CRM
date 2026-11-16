import pytest

from backend.tests.conftest import bearer

EXEC = "tajayvarma76@gmail.com"
GROUP = {"id": -100123, "type": "supergroup", "title": "Broadcast_group"}


@pytest.fixture
def bg(crm, monkeypatch):
    m = crm.broadcast_group
    for key in m.ENV_KEYS:
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("TELEGRAM_BROADCAST_GROUP_BOT_TOKEN", "123:abc")
    for name in (m.CHAT_ID_VALUE, m.OFFSET_VALUE):
        crm.store.set_value(name, None)
    return crm, m


def msg(text="Market opens flat today", chat=GROUP, message_id=5, **extra):
    return {"message_id": message_id, "date": 1_763_280_000, "chat": chat,
            "from": {"id": 9, "first_name": "Srinivas", "last_name": "R"}, "text": text, **extra}


def notes(crm, token):
    res = crm.client.get("/api/sync", params={"collections": "notifications", "since": 0}, headers=bearer(token))
    assert res.status_code == 200, res.text
    return {n["id"]: n for n in res.json()["collections"]["notifications"]["items"]}


def test_group_message_reaches_every_crm_user(bg):
    crm, m = bg
    note = m.handle_update(m.settings(), {"update_id": 1, "message": msg()})
    assert note["id"] == "tg-broadcast--100123-5"
    seen = notes(crm, crm.token(EXEC))[note["id"]]  # an ordinary executive receives it
    assert seen["message"] == "Market opens flat today"
    assert seen["title"] == "Broadcast_group: Srinivas R"
    assert seen["type"] == "broadcast" and seen["targetUserId"] is None and seen["targetRole"] is None
    assert seen["timestamp"].endswith(("AM", "PM"))
    # The group id is remembered, so a later rename of the group keeps working
    assert crm.store.get_value(m.CHAT_ID_VALUE) == "-100123"
    renamed = {**GROUP, "title": "Broadcasts 2027"}
    assert m.handle_update(m.settings(), {"update_id": 2, "message": msg("Second", chat=renamed, message_id=6)})


def test_edits_update_the_same_notification_and_captions_count(bg):
    crm, m = bg
    m.handle_update(m.settings(), {"update_id": 1, "message": msg("First draft")})
    m.handle_update(m.settings(), {"update_id": 2, "edited_message": msg("Corrected")})
    photo = msg(message_id=7, caption="Chart attached")
    del photo["text"]
    m.handle_update(m.settings(), {"update_id": 3, "message": photo})
    seen = notes(crm, crm.token(EXEC))
    assert seen["tg-broadcast--100123-5"]["message"] == "Corrected"
    assert seen["tg-broadcast--100123-7"]["message"] == "Chart attached"


@pytest.mark.parametrize("update", [
    {"update_id": 1, "message": msg(chat={"id": -555, "type": "supergroup", "title": "Some other group"})},
    {"update_id": 1, "message": msg(chat={"id": 42, "type": "private", "first_name": "Broadcast_group"})},
    {"update_id": 1, "message": {**msg(), "text": None}},  # a sticker or a join message
])
def test_other_chats_and_empty_messages_are_ignored(bg, update):
    crm, m = bg
    token = crm.token(EXEC)
    before = set(notes(crm, token))
    assert m.handle_update(m.settings(), update) is None
    assert set(notes(crm, token)) == before


def test_configured_chat_id_wins_over_the_title(bg, monkeypatch):
    crm, m = bg
    monkeypatch.setenv("TELEGRAM_BROADCAST_GROUP_CHAT_ID", "-777")
    assert m.handle_update(m.settings(), {"update_id": 1, "message": msg()}) is None  # right title, wrong id
    assert m.handle_update(m.settings(), {"update_id": 2, "message": msg(chat={"id": -777, "type": "group", "title": "x"})})


def test_bot_added_to_the_group_learns_its_id(bg):
    crm, m = bg
    m.handle_update(m.settings(), {"update_id": 1, "my_chat_member": {"chat": GROUP}})
    assert crm.store.get_value(m.CHAT_ID_VALUE) == "-100123"


def test_status_is_admin_only(bg):
    crm, m = bg
    assert crm.client.get("/api/broadcast-group/status", headers=bearer(crm.token(EXEC))).status_code == 403
