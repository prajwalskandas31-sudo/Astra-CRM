import base64

from backend.tests.conftest import bearer

SA = "superadmin@company.com"
ADMIN = "admin@company.com"
EXEC = "tajayvarma76@gmail.com"
PNG = "data:image/png;base64," + base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"0" * 64).decode()


def master(image=PNG):
    return {"master_officer": {"signerName": "Nishant Narottam Agarwal", "signatureDataUrl": image, "isCustomUploaded": True}}


def save(crm, token, body):
    return crm.client.put("/api/signatures", json=body, headers=bearer(token))


def test_only_admins_can_read_or_write(crm):
    ex = crm.token(EXEC)
    assert crm.client.get("/api/signatures", headers=bearer(ex)).status_code == 403
    assert save(crm, ex, {"signatures": master(), "password": crm.creds[EXEC]}).status_code == 403
    assert crm.client.get("/api/signatures").status_code in (401, 403)


def test_save_requires_a_correct_password(crm):
    sa = crm.token(SA)
    assert save(crm, sa, {"signatures": master(), "password": "wrong-password"}).status_code == 401
    assert save(crm, sa, {"signatures": master()}).status_code == 422


def test_saved_signature_is_shared_and_used_for_dispatch(crm):
    sa, admin = crm.token(SA), crm.token(ADMIN)
    res = save(crm, sa, {"signatures": master(), "password": crm.creds[SA]})
    assert res.status_code == 200
    assert res.json()["master_officer"]["serverSavedBy"] == "Sreenivasulu"

    # Another admin (another browser) reads the same copy
    shared = crm.client.get("/api/signatures", headers=bearer(admin)).json()
    assert shared["master_officer"]["signatureDataUrl"] == PNG
    assert crm.signatures.stored_primary_signature() == PNG


def test_admin_may_save_with_own_password(crm):
    admin = crm.token(ADMIN)
    assert save(crm, admin, {"signatures": master(), "password": crm.creds[ADMIN]}).status_code == 200


def test_rejects_non_images_and_bad_keys(crm):
    sa = crm.token(SA)
    pw = crm.creds[SA]
    assert save(crm, sa, {"signatures": master("data:text/html;base64,PHNjcmlwdD4="), "password": pw}).status_code == 400
    assert save(crm, sa, {"signatures": {"../etc/passwd": {}}, "password": pw}).status_code == 400
    too_big = "data:image/png;base64," + "A" * 3_100_000
    assert save(crm, sa, {"signatures": master(too_big), "password": pw}).status_code == 400
