import base64

import pytest

from backend.tests.conftest import bearer

SA = "superadmin@company.com"
ADMIN = "admin@company.com"
EXEC = "tajayvarma76@gmail.com"  # usr-3
PAN = "CMSTR1234K"
REVIEW_ID = "a" * 64


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


@pytest.fixture(scope="module")
def tok(crm):
    tokens = {k: crm.token(v) for k, v in {"sa": SA, "admin": ADMIN, "exec": EXEC}.items()}
    info = {"panNumber": PAN, "clientName": "Ravi Kumar", "clientPrefix": "Mr.", "email": "ravi@example.com",
            "phone1": "+91 98765 43210", "serviceName": "Stock Cash", "serviceTenure": "3 Months", "grossSales": "11800",
            "netSales": "10000", "gst": "1800", "submissionDate": "2026-10-01",
            "transactionAttachments": [{"name": "proof.png", "data": "data:image/png;base64,AAAA"}]}
    res = crm.client.post("/api/sync", headers=bearer(tokens["sa"]), json={"collections": {
        "leads": {"upserts": [{"id": "cm-lead-1", "assignedToId": "usr-6", "assigned_user_id": "usr-6", "history": [],
                               "phone": "9876543210", "clientInfo": info}]},
        "sales": {"upserts": [
            {"id": "cm-sale-1", "leadId": "cm-lead-1", "submittedByUserId": "usr-6", "employeeName": "ANITHA",
             "date": "2026-10-01", "panNumber": PAN, "phone1": info["phone1"], "status": "E-Signed & Converted",
             "clientType": "New Client", "eSignDocumentId": "DOC-OLD", "eSignedAt": "2026-10-02T10:00:00",
             "eSignStatus": "Completed", "fullClientInfo": info},
            {"id": "cm-sale-2", "leadId": "cm-lead-1", "submittedByUserId": "usr-6", "employeeName": "ANITHA",
             "date": "2026-11-10", "panNumber": PAN, "status": "Old Client - Approved", "clientType": "Old Client",
             "fullClientInfo": {**info, "serviceTenure": "6 Months", "submissionDate": "2026-11-10"}},
        ]},
        "eSignRecords": {"upserts": [{"id": "esign-1", "saleId": "cm-sale-1", "documentId": "DOC-OLD", "panNumber": PAN,
                                      "confirmedAt": "2026-10-02T10:05:00", "usedSignatureType": "Aadhaar eSign"}]},
    }})
    assert res.status_code == 200 and not any(res.json()["rejected"].values()), res.text
    crm.store.put(crm.old_client_review.REVIEWS, REVIEW_ID, {
        "id": REVIEW_ID, "saleId": "cm-sale-2", "status": "approved", "invoiceNumber": "INV/2026-27/0007",
        "decidedAt": "2026-11-11T06:00:00+00:00", "decidedBy": "Reviewer", "emailedTo": "ravi@example.com",
        "invoiceFile": "Invoice INV-2026-27-0007.pdf", "details": {**info, "serviceTenure": "6 Months"}})
    return tokens


def search(crm, token, q):
    return crm.client.get("/api/client-master/search", params={"q": q}, headers=bearer(token))


def test_search_by_pan_shows_client_info_signing_and_invoice(crm, tok):
    res = search(crm, tok["sa"], PAN.lower())
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["clientKey"] == f"PAN:{PAN}"
    assert body["client"]["clientName"] == "Ravi Kumar" and body["client"]["serviceTenure"] == "6 Months"
    assert "transactionAttachments" not in body["client"]  # attachment data never leaves the server here
    assert [s["saleId"] for s in body["submissions"]] == ["cm-sale-2", "cm-sale-1"]
    assert body["leegality"] == [{"documentId": "DOC-OLD", "signedAt": "2026-10-02T10:05:00", "serviceName": "",
                                  "serviceTenure": "", "signatureType": "Aadhaar eSign", "saleId": "cm-sale-1"}]
    assert [i["invoiceNumber"] for i in body["invoices"]] == ["INV/2026-27/0007"]


def test_search_by_mobile_finds_the_same_client(crm, tok):
    for q in ("9876543210", "+91 98765-43210", "09876543210"):
        body = search(crm, tok["admin"], q).json()
        assert body["clientKey"] == f"PAN:{PAN}", q
        # the E-Sign record has no phone, but belongs to one of the client's sales
        assert body["leegality"][0]["signedAt"] == "2026-10-02T10:05:00", q


def test_unknown_and_invalid_queries(crm, tok):
    assert search(crm, tok["sa"], "ZZZZZ9999Z").status_code == 404
    assert search(crm, tok["sa"], "9000000000").status_code == 404
    assert search(crm, tok["sa"], "12345").status_code == 400
    assert search(crm, tok["sa"], "ABC123").status_code == 400


def test_executive_needs_feature_access(crm, tok):
    assert search(crm, tok["exec"], PAN).status_code == 403
    res = crm.client.post("/api/sync", headers=bearer(tok["sa"]), json={"collections": {
        "userPermissions": {"upserts": [{"id": "usr-3", "value": {"client-master": True}}]}}})
    assert res.status_code == 200, res.text
    assert search(crm, tok["exec"], PAN).status_code == 200
    crm.client.post("/api/sync", headers=bearer(tok["sa"]), json={"collections": {
        "userPermissions": {"upserts": [{"id": "usr-3", "value": {"client-master": False}}]}}})
    assert search(crm, tok["exec"], PAN).status_code == 403


def test_invoice_download_rebuilds_then_uses_saved_copy(crm, tok):
    url = f"/api/client-master/invoices/{REVIEW_ID}/pdf"
    res = crm.client.get(url, headers=bearer(tok["sa"]))
    assert res.status_code == 200 and res.content.startswith(b"%PDF")
    assert "Invoice INV-2026-27-0007.pdf" in res.headers["content-disposition"]
    crm.store.put(crm.old_client_review.INVOICE_PDFS, REVIEW_ID, {"id": REVIEW_ID, "data": b64(b"%PDF-saved")})
    assert crm.client.get(url, headers=bearer(tok["sa"])).content == b"%PDF-saved"
    assert crm.client.get("/api/client-master/invoices/nope/pdf", headers=bearer(tok["sa"])).status_code == 404
    assert crm.client.get(url, headers=bearer(tok["exec"])).status_code == 403


def test_grievance_upload_rename_download_and_daily_limit(crm, tok):
    key = f"PAN:{PAN}"
    up = lambda name, data=b"hello": crm.client.post("/api/client-master/grievances", headers=bearer(tok["sa"]), json={
        "clientKey": key, "fileName": name, "contentType": "text/plain", "dataBase64": b64(data)})
    first = up("complaint.txt")
    assert first.status_code == 200, first.text
    fid = first.json()["id"]
    for i in range(9):
        assert up(f"f{i}.txt").status_code == 200
    eleventh = up("one-too-many.txt")
    assert eleventh.status_code == 429 and "10" in eleventh.json()["detail"]

    renamed = crm.client.patch(f"/api/client-master/grievances/{fid}", headers=bearer(tok["admin"]), json={"fileName": "Refund request ₹"})
    assert renamed.status_code == 200 and renamed.json()["fileName"] == "Refund request ₹.txt"  # extension kept
    dl = crm.client.get(f"/api/client-master/grievances/{fid}/file", headers=bearer(tok["sa"]))
    assert dl.status_code == 200 and dl.content == b"hello" and "filename*=UTF-8''Refund" in dl.headers["content-disposition"]

    listing = crm.client.get("/api/client-master/grievances", params={"clientKey": key}, headers=bearer(tok["sa"])).json()
    assert listing["total"] == 10 and listing["uploadedToday"] == 10 and listing["maxPerDay"] == 10
    today = listing["today"]
    in_range = crm.client.get("/api/client-master/grievances", params={"clientKey": key, "from": today, "to": today},
                              headers=bearer(tok["sa"])).json()
    assert len(in_range["files"]) == 10
    before = crm.client.get("/api/client-master/grievances", params={"clientKey": key, "to": "2026-01-01"},
                            headers=bearer(tok["sa"])).json()
    assert before["files"] == [] and before["total"] == 10
    bad = crm.client.get("/api/client-master/grievances", params={"clientKey": key, "from": "2026-12-01", "to": "2026-01-01"},
                         headers=bearer(tok["sa"]))
    assert bad.status_code == 400


def test_grievance_needs_a_client_on_file_and_a_sane_file(crm, tok):
    post = lambda body: crm.client.post("/api/client-master/grievances", headers=bearer(tok["sa"]), json=body)
    assert post({"clientKey": "PAN:ZZZZZ9999Z", "fileName": "a.txt", "dataBase64": b64(b"x")}).status_code == 404
    assert post({"clientKey": "anything", "fileName": "a.txt", "dataBase64": b64(b"x")}).status_code == 400
    assert post({"clientKey": "MOBILE:9876543210", "fileName": "a.txt", "dataBase64": "not base64!"}).status_code == 400
    too_big = b64(b"x" * (crm.client_master.MAX_FILE_BYTES + 1))
    assert post({"clientKey": "MOBILE:9876543210", "fileName": "a.txt", "dataBase64": too_big}).status_code == 413


# ==========================================
# Editing (password protected)
# ==========================================
EDIT_PAN = "EDTCL4321M"


@pytest.fixture(scope="module")
def edit_client(crm, tok):
    info = {"panNumber": EDIT_PAN, "clientName": "Old Name", "clientPrefix": "Mr.", "email": "old@example.com",
            "phone1": "9123456780", "clientCategory": "Individual", "clientState": "Karnataka", "paymentDate": "2026-11-10",
            "serviceName": "Energy", "serviceTenure": "1 Month", "transactionNumbers": ["123456"], "grossSales": "2000",
            "netSales": "1694.92", "gst": "305.08", "paymentModes": [{"mode": "NEFT", "amount": "2000"}],
            "employeeSharing": {"present": True, "mode": "fixed", "shares": [{"userId": "usr-3", "name": "Ajay", "value": "500"}]},
            "submissionDate": "2026-11-10"}
    res = crm.client.post("/api/sync", headers=bearer(tok["sa"]), json={"collections": {
        "leads": {"upserts": [{"id": "ed-lead", "assignedToId": "usr-6", "assigned_user_id": "usr-6", "history": [],
                               "phone": info["phone1"], "clientName": "Old Name", "clientInfo": info}]},
        "sales": {"upserts": [{"id": "ed-sale", "leadId": "ed-lead", "submittedByUserId": "usr-6", "employeeName": "ANITHA",
                               "date": "2026-11-10", "panNumber": EDIT_PAN, "phone1": info["phone1"], "clientName": "Old Name",
                               "status": "E-Signed & Converted", "clientType": "New Client", "grossSales": "2000",
                               "amount": "₹2,000", "serviceOpted": "Energy", "fullClientInfo": info}]},
        "paidClients": {"upserts": [{"id": "paid-ed-sale", "saleId": "ed-sale", "clientName": "Old Name", "phone": info["phone1"],
                                     "panNumber": EDIT_PAN, "serviceName": "Energy", "serviceEndDate": "2026-12-10"}]},
    }})
    assert res.status_code == 200 and not any(res.json()["rejected"].values()), res.text
    return info


def edit(crm, token, body):
    return crm.client.put("/api/client-master/details", headers=bearer(token), json=body)


def test_unlock_needs_the_users_own_password(crm, tok, edit_client):
    url = "/api/client-master/unlock"
    assert crm.client.post(url, headers=bearer(tok["sa"]), json={"password": "wrong"}).status_code == 401
    # Another user's password does not unlock it
    assert crm.client.post(url, headers=bearer(tok["sa"]), json={"password": crm.creds[ADMIN]}).status_code == 401
    assert crm.client.post(url, headers=bearer(tok["sa"]), json={"password": crm.creds[SA]}).status_code == 200
    assert crm.client.post(url, headers=bearer(tok["exec"]), json={"password": crm.creds[EXEC]}).status_code == 403


def test_edit_rejects_a_wrong_password_and_changes_nothing(crm, tok, edit_client):
    res = edit(crm, tok["sa"], {"saleId": "ed-sale", "password": "nope", "changes": {"clientName": "Hacked"}})
    assert res.status_code == 401
    assert crm.store.get("sales", "ed-sale")["fullClientInfo"]["clientName"] == "Old Name"


def test_edit_updates_sale_lead_paid_client_and_keeps_an_audit(crm, tok, edit_client):
    res = edit(crm, tok["admin"], {"saleId": "ed-sale", "password": crm.creds[ADMIN], "changes": {
        "clientName": "  New   Name ", "phone1": "+91 99887 76655", "email": "new@example.com", "grossSales": "118000",
        "netSales": "100000", "gst": "18000", "serviceName": "Stock Cash", "transactionNumbers": "TX1, TX2",
        "paymentModes": [{"mode": "UPI", "amount": "118000"}], "clientState": "Kerala",
        "employeeSharing": {"mode": "percentage", "values": ["25"]},
        "serviceTenure": "1 Month"}})  # unchanged: not recorded
    assert res.status_code == 200, res.text
    assert "serviceTenure" not in res.json()["saved"] and "clientName" in res.json()["saved"]

    sale = crm.store.get("sales", "ed-sale")
    info = sale["fullClientInfo"]
    assert info["clientName"] == "New Name" and info["phone1"] == "9988776655" and info["transactionNumbers"] == ["TX1", "TX2"]
    assert sale["clientName"] == "New Name" and sale["contactPerson"] == "New Name" and sale["phone1"] == "9988776655"
    assert sale["amount"] == "₹1,18,000" and sale["serviceOpted"] == "Stock Cash" and sale["clientState"] == "Kerala"
    assert info["employeeSharing"]["mode"] == "percentage" and info["employeeSharing"]["shares"][0] == {"userId": "usr-3", "name": "Ajay", "value": "25"}
    audit = sale["clientMasterEdits"][-1]
    assert audit["changes"]["clientName"] == {"from": "Old Name", "to": "New Name"} and audit["byId"] == "usr-11"

    lead = crm.store.get("leads", "ed-lead")
    assert lead["clientInfo"]["clientName"] == "New Name" and lead["phone"] == "9988776655" and lead["email"] == "new@example.com"
    assert "Client MASTER" in lead["history"][-1]["text"]
    paid = crm.store.get("paidClients", "paid-ed-sale")
    assert paid["clientName"] == "New Name" and paid["phone"] == "9988776655" and paid["serviceEndDate"] == "2026-12-10"

    # The search shows the new details, found by the new mobile number, with the last edit
    body = search(crm, tok["sa"], "9988776655").json()
    assert body["client"]["clientName"] == "New Name"
    assert body["submissions"][0]["lastEdit"]["by"] and "clientName" in body["submissions"][0]["lastEdit"]["fields"]


def test_edit_validates_fields(crm, tok, edit_client):
    pw = crm.creds[SA]
    for changes, needle in (({"panNumber": "BAD"}, "PAN"), ({"phone1": "123"}, "Phone 1"), ({"email": "x"}, "Email"),
                            ({"grossSales": "abc"}, "Gross Sales"), ({"clientState": "Atlantis"}, "State"),
                            ({"paymentDate": "2026-02-30"}, "Payment Date"), ({"clientName": " "}, "Client Name"),
                            ({"clientType": "Old Client"}, "cannot be edited"),
                            ({"paymentModes": [{"mode": "UPI", "amount": "1"}, {"mode": "upi", "amount": "2"}]}, "twice"),
                            ({"employeeSharing": {"mode": "percentage", "values": ["150"]}}, "100")):
        res = edit(crm, tok["sa"], {"saleId": "ed-sale", "password": pw, "changes": changes})
        assert res.status_code == 400 and needle in res.json()["detail"], (changes, res.text)
    same = edit(crm, tok["sa"], {"saleId": "ed-sale", "password": pw, "changes": {"serviceTenure": "1 Month"}})
    assert same.status_code == 400 and "Nothing" in same.json()["detail"]
    assert edit(crm, tok["sa"], {"saleId": "nope", "password": pw, "changes": {"clientName": "X"}}).status_code == 404
    assert edit(crm, tok["exec"], {"saleId": "ed-sale", "password": crm.creds[EXEC], "changes": {"clientName": "X"}}).status_code == 403
