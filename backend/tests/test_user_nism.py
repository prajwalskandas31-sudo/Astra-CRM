"""User Directory -> NISM Exam Details: the six details on the user, and up to 10 documents per user."""
import base64
import secrets

from backend.tests.conftest import bearer

SA, ADMIN, EXEC = "superadmin@company.com", "admin@company.com", "tajayvarma76@gmail.com"
EXEC_ID = "usr-3"
DETAILS = {"name": "Ravi Kumar", "series": "Series XV", "registrationNumber": "NISM-RA-123",
           "enrollmentNumber": "ENR-9", "clearedDate": "2025-06-01", "validUpto": "2028-05-31"}


def _url(user_id, rest=""):
    return f"/api/users/{user_id}/nism-documents{rest}"


def _upload(crm, who, user_id=EXEC_ID, name="cert.pdf", content=b"%PDF-1.4 test"):
    return crm.client.post(_url(user_id), headers=bearer(crm.token(who)),
                           json={"fileName": name, "contentType": "application/pdf",
                                 "dataBase64": base64.b64encode(content).decode()})


def _clear(crm):
    for col in ("userNismDocs", "userNismDocFiles"):
        for d in crm.store.all(col):
            crm.store.delete(col, d["id"])


def test_details_saved_on_create_and_update(crm):
    tag = secrets.token_hex(3)
    body = {"name": f"Nism Person {tag}", "mobile": f"95{secrets.randbelow(10**8):08d}", "password": f"Sp-{secrets.token_hex(8)}",
            "email": f"nism-{tag}@x.com", "reportingTo": "x", "nism": {**DETAILS, "series": "  Series   XV "}}
    res = crm.client.post("/api/users", json=body, headers=bearer(crm.token(SA)))
    assert res.status_code == 200, res.text
    assert res.json()["nism"] == DETAILS  # whitespace tidied

    h = bearer(crm.token(ADMIN))
    assert crm.client.put(f"/api/users/{EXEC_ID}", json={"nism": DETAILS}, headers=h).status_code == 200
    assert crm.store.get("users", EXEC_ID)["nism"] == DETAILS
    bad = crm.client.put(f"/api/users/{EXEC_ID}", json={"nism": {**DETAILS, "validUpto": "31-05-2028"}}, headers=h)
    assert bad.status_code == 400
    earlier = crm.client.put(f"/api/users/{EXEC_ID}", json={"nism": {**DETAILS, "validUpto": "2024-01-01"}}, headers=h)
    assert earlier.status_code == 400
    # An Executive cannot set their own NISM details
    assert crm.client.put(f"/api/users/{EXEC_ID}", json={"nism": {**DETAILS, "series": "X"}},
                          headers=bearer(crm.token(EXEC))).status_code == 403


def test_upload_list_download_delete(crm):
    _clear(crm)
    res = _upload(crm, ADMIN)
    assert res.status_code == 200, res.text
    doc = res.json()
    listed = crm.client.get(_url(EXEC_ID), headers=bearer(crm.token(SA))).json()
    assert [d["id"] for d in listed["documents"]] == [doc["id"]] and listed["max"] == 10 and listed["canManage"]

    # The user can see and download their own documents, but not change them
    own = crm.client.get(_url(EXEC_ID), headers=bearer(crm.token(EXEC))).json()
    assert len(own["documents"]) == 1 and not own["canManage"]
    file = crm.client.get(_url(EXEC_ID, f"/{doc['id']}/file"), headers=bearer(crm.token(EXEC)))
    assert file.status_code == 200 and file.content == b"%PDF-1.4 test"
    assert "cert.pdf" in file.headers["content-disposition"]
    assert _upload(crm, EXEC).status_code == 403
    assert crm.client.delete(_url(EXEC_ID, f"/{doc['id']}"), headers=bearer(crm.token(EXEC))).status_code == 403

    assert crm.client.delete(_url(EXEC_ID, f"/{doc['id']}"), headers=bearer(crm.token(ADMIN))).status_code == 200
    assert crm.client.get(_url(EXEC_ID), headers=bearer(crm.token(SA))).json()["documents"] == []
    assert crm.store.get("userNismDocFiles", doc["id"]) is None


def test_ten_documents_at_most_and_admins_cannot_touch_admins(crm):
    _clear(crm)
    for i in range(10):
        assert _upload(crm, SA, name=f"doc{i}.pdf").status_code == 200
    assert _upload(crm, SA, name="eleven.pdf").status_code == 409

    admin_id = next(u["id"] for u in crm.store.all("users") if u.get("email") == ADMIN)
    sa_id = next(u["id"] for u in crm.store.all("users") if u.get("email") == SA)
    assert _upload(crm, ADMIN, user_id=sa_id).status_code == 403
    # An Executive cannot even see another user's documents
    assert crm.client.get(_url(admin_id), headers=bearer(crm.token(EXEC))).status_code == 404
    assert _upload(crm, SA, content=b"").status_code == 400
    _clear(crm)
