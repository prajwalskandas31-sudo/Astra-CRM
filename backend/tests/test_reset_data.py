from backend.tests.conftest import bearer

SA = "superadmin@company.com"


def pull(crm, token, collections, since=0):
    res = crm.client.get(f"/api/sync?collections={collections}&since={since}", headers=bearer(token))
    assert res.status_code == 200, res.text
    return res.json()


def test_reset_deletes_business_data_keeps_config_and_publishes_an_epoch(crm):
    from backend import reset_data
    store, sa = crm.store, crm.token(SA)
    store.put("leads", "lead-1", {"id": "lead-1", "name": "Old lead"})
    store.put("paidClients", "paid-1", {"id": "paid-1", "clientName": "Old client", "segments": ["NSE DERIVATIVES"]})
    store.put("services", "svc-1", {"id": "svc-1", "name": "Index Options"})
    store.set_value("leegalityDocuments", {"doc": {"documentId": "doc"}})
    store.set_value("telegramSenders", {"5551001": {"phone": "8884321002"}})
    users_before = store.count("users")

    before = pull(crm, sa, "leads,paidClients,services")
    assert before["epoch"] is None
    cursor = before["cursor"]

    result = reset_data.reset()
    assert result["deleted"]["leads"] == 1 and result["deleted"]["paidClients"] == 1

    # Open tabs receive the deletes and the new epoch on their next incremental pull
    changes = pull(crm, sa, "leads,paidClients,services", since=cursor)
    assert changes["epoch"] == result["epoch"]
    assert changes["collections"]["leads"]["deleted"] == ["lead-1"]
    assert changes["collections"]["paidClients"]["deleted"] == ["paid-1"]

    full = pull(crm, sa, "leads,paidClients,services")
    assert full["collections"]["leads"]["items"] == [] and full["collections"]["paidClients"]["items"] == []
    assert [s["id"] for s in full["collections"]["services"]["items"]] == ["svc-1"]
    assert store.get_value("leegalityDocuments") == {}
    assert store.get_value("telegramSenders") == {"5551001": {"phone": "8884321002"}}
    assert store.count("users") == users_before
