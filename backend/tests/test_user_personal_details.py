"""User Directory -> Add / Edit User: Date of Birth, Date of Joining, Aadhaar, PAN and the two addresses."""
import secrets

from backend.tests.conftest import bearer

SA, ADMIN, EXEC = "superadmin@company.com", "admin@company.com", "tajayvarma76@gmail.com"
EXEC_ID = "usr-3"
DETAILS = {"dateOfBirth": "1995-04-12", "dateOfJoining": "2026-11-01", "aadhaarNumber": "2345 6789 0123",
           "panNumber": "abcde1234f", "currentAddress": " 12, MG Road,\n Bengaluru 560001 ", "correspondenceAddress": ""}


def _body(**extra):
    tag = secrets.token_hex(3)
    return {"name": f"Personal {tag}", "mobile": f"94{secrets.randbelow(10**8):08d}", "password": f"Sp-{secrets.token_hex(8)}",
            "email": f"personal-{tag}@x.com", "reportingTo": "x", **extra}


def test_saved_and_tidied_on_create(crm):
    res = crm.client.post("/api/users", json=_body(**DETAILS), headers=bearer(crm.token(SA)))
    assert res.status_code == 200, res.text
    u = res.json()
    assert u["dateOfBirth"] == "1995-04-12" and u["dateOfJoining"] == "2026-11-01"
    assert u["aadhaarNumber"] == "234567890123" and u["panNumber"] == "ABCDE1234F"
    assert u["currentAddress"] == "12, MG Road, Bengaluru 560001" and u["correspondenceAddress"] == ""


def test_blank_details_are_optional(crm):
    res = crm.client.post("/api/users", json=_body(), headers=bearer(crm.token(SA)))
    assert res.status_code == 200, res.text
    assert res.json()["panNumber"] == "" and res.json()["dateOfBirth"] == ""


def test_invalid_values_rejected(crm):
    h = bearer(crm.token(SA))
    for bad in ({"aadhaarNumber": "12345"}, {"aadhaarNumber": "012345678901"}, {"panNumber": "ABCD1234F"},
                {"dateOfBirth": "12-04-1995"}, {"dateOfBirth": "2999-01-01"}, {"dateOfJoining": "not a date"},
                {"currentAddress": "x" * 501}):
        assert crm.client.post("/api/users", json=_body(**bad), headers=h).status_code == 400, bad


def test_admin_edits_and_privacy(crm):
    h = bearer(crm.token(ADMIN))
    res = crm.client.put(f"/api/users/{EXEC_ID}", json={"panNumber": "PQRSX9876Z", "dateOfJoining": "2025-01-15"}, headers=h)
    assert res.status_code == 200, res.text
    stored = crm.store.get("users", EXEC_ID)
    assert stored["panNumber"] == "PQRSX9876Z" and stored["dateOfJoining"] == "2025-01-15"

    # The executive cannot change these themselves, but resending blanks/unchanged values is fine
    ex = bearer(crm.token(EXEC))
    assert crm.client.put(f"/api/users/{EXEC_ID}", json={"panNumber": "AAAAA1111A"}, headers=ex).status_code == 403
    assert crm.client.put(f"/api/users/{EXEC_ID}", json={"panNumber": "PQRSX9876Z", "currentAddress": ""},
                          headers=ex).status_code == 200

    # Aadhaar / PAN / DOB / addresses are hidden from other non-admin users
    other_id = crm.client.post("/api/users", json=_body(**DETAILS), headers=bearer(crm.token(SA))).json()["id"]
    listed = {u["id"]: u for u in crm.client.get("/api/users", headers=ex).json()}
    assert not {"aadhaarNumber", "panNumber", "dateOfBirth", "currentAddress"} & listed[other_id].keys()
    assert listed[other_id]["dateOfJoining"] == "2026-11-01"
    me = listed[EXEC_ID]
    assert me["panNumber"] == "PQRSX9876Z"
