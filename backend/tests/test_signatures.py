import base64
import io

from PIL import Image

from backend.tests.conftest import bearer

SA = "superadmin@company.com"
ADMIN = "admin@company.com"
EXEC = "tajayvarma76@gmail.com"


def png(color=(20, 40, 160, 255)):
    buf = io.BytesIO()
    Image.new("RGBA", (40, 16), color).save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


PNG = png()


def master(image=PNG, name="Nishant Narottam Agarwal"):
    return {"master_officer": {"signerName": name, "signatureDataUrl": image, "isCustomUploaded": True}}


def save(crm, token, body):
    return crm.client.put("/api/signatures", json=body, headers=bearer(token))


def test_only_admins_can_read_or_write(crm):
    ex = crm.token(EXEC)
    assert crm.client.get("/api/signatures", headers=bearer(ex)).status_code == 403
    assert save(crm, ex, {"signatures": master(), "password": crm.creds[EXEC]}).status_code == 403
    assert crm.client.get("/api/signatures").status_code in (401, 403)


def test_save_requires_the_callers_own_password(crm):
    sa = crm.token(SA)
    assert save(crm, sa, {"signatures": master(), "password": "wrong-password"}).status_code == 401
    assert save(crm, sa, {"signatures": master()}).status_code == 422
    # Another admin's password is not accepted (no password-guessing through this endpoint)
    assert save(crm, sa, {"signatures": master(), "password": crm.creds[ADMIN]}).status_code == 401


def test_saved_signature_is_shared_and_used_for_dispatch(crm):
    sa, admin = crm.token(SA), crm.token(ADMIN)
    res = save(crm, sa, {"signatures": master(), "password": crm.creds[SA]})
    assert res.status_code == 200
    assert res.json()["master_officer"]["serverSavedBy"] == "Sreenivasulu"

    # Another admin (another browser) reads the same copy
    shared = crm.client.get("/api/signatures", headers=bearer(admin)).json()
    assert shared["master_officer"]["signatureDataUrl"] == PNG
    assert crm.signatures.stored_primary_signature() == PNG


def test_admin_cannot_replace_primary_signatory(crm):
    sa, admin = crm.token(SA), crm.token(ADMIN)
    assert save(crm, sa, {"signatures": master(), "password": crm.creds[SA]}).status_code == 200
    stored = crm.client.get("/api/signatures", headers=bearer(admin)).json()

    forged = master(png((200, 0, 0, 255)), name="Someone Else")
    assert save(crm, admin, {"signatures": forged, "password": crm.creds[ADMIN]}).status_code == 403

    # An admin may add their own signature while leaving the Primary Signatory untouched
    own = {**stored, "usr-11": {"signerName": "Ramesh Chandra", "signatureDataUrl": png((0, 120, 0, 255))}}
    res = save(crm, admin, {"signatures": own, "password": crm.creds[ADMIN]})
    assert res.status_code == 200
    assert crm.signatures.stored_primary_signature() == PNG
    assert res.json()["master_officer"]["serverSavedBy"] == "Sreenivasulu"


def test_rejects_non_images_and_bad_keys(crm):
    sa = crm.token(SA)
    pw = crm.creds[SA]
    assert save(crm, sa, {"signatures": master("data:text/html;base64,PHNjcmlwdD4="), "password": pw}).status_code == 400
    svg = "data:image/svg+xml;base64," + base64.b64encode(b"<svg onload='alert(1)'/>").decode()
    assert save(crm, sa, {"signatures": master(svg), "password": pw}).status_code == 400
    fake_png = "data:image/png;base64," + base64.b64encode(b"not really a png").decode()
    assert save(crm, sa, {"signatures": master(fake_png), "password": pw}).status_code == 400
    assert save(crm, sa, {"signatures": {"../etc/passwd": {}}, "password": pw}).status_code == 400
    too_big = "data:image/png;base64," + "A" * 3_100_000
    assert save(crm, sa, {"signatures": master(too_big), "password": pw}).status_code == 400
