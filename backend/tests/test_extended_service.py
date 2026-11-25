"""Extended Service Block, the Email Delivery Report, the Client MASTER status overview and Sale Approvals > Delete."""
from datetime import date, timedelta

import pytest

from backend.tests.conftest import bearer

SA, ADMIN, EXEC = "superadmin@company.com", "admin@company.com", "tajayvarma76@gmail.com"
PAN = "ABCDE1234F"


def _ago(days):
    return (date.today() - timedelta(days=days)).isoformat()


def _sale(sale_id, net, paid_on, pan=PAN, status="E-Signed & Converted", signed=None, **extra):
    info = {"clientPrefix": "Mr.", "clientName": "Ravi Kumar", "panNumber": pan, "phone1": "9876543210",
            "email": "ravi@example.com", "clientState": "Karnataka", "clientCategory": "Individual",
            "serviceName": "Stock Cash", "serviceTenure": "12 Months", "paymentDate": paid_on, "netSales": str(net)}
    return {"id": sale_id, "status": status, "submittedByUserId": "usr-1", "employeeName": "Srinivas",
            "fullClientInfo": info, "eSignStatus": "Completed" if signed else "Pending",
            "eSignedAt": signed or "", **extra}


@pytest.fixture
def ext(crm, monkeypatch):
    s, ek = crm.store, crm.email_kit
    for coll in ("sales", "paidClients", "services", "extendedServiceAssignments", "extendedServiceInvoiceFiles",
                 "kraRecords", "eSignRecords", "leads"):
        for doc in s.all(coll):
            s.delete(coll, doc["id"])
    for name in (ek.LOG, ek.FAILURES, "extendedServiceSettings", "serviceExpiryLog"):
        s.set_value(name, [] if name != "extendedServiceSettings" else {})
    mails = []
    monkeypatch.setattr(ek, "_smtp_send", lambda settings, msg: mails.append(msg))
    monkeypatch.setattr(ek, "_save_to_sent", lambda settings, msg: {"savedToSent": True})
    s.set_value(ek.SETTINGS, {"senderEmail": "no-reply@example.com", "smtpHost": "smtp.example.com", "smtpPassword": "x"})
    s.put("companyProfile", "companyName", {"id": "companyName", "value": "Unite Tech"})
    s.put("companyProfile", "state", {"id": "state", "value": "Karnataka"})
    s.put("services", "srv-cash", {"id": "srv-cash", "name": "Stock Cash", "value": 11800})
    s.put("services", "srv-free", {"id": "srv-free", "name": "Energy", "value": ""})
    # Two closed payments in the last 12 months (60,000 net) and one older (not counted)
    s.put("sales", "SL-1", _sale("SL-1", 40000, _ago(200), signed=_ago(199) + "T10:00:00Z"))
    s.put("sales", "SL-2", _sale("SL-2", 20000, _ago(20), signed=_ago(18) + "T10:00:00Z"))
    s.put("sales", "SL-OLD", _sale("SL-OLD", 90000, _ago(400), signed=_ago(400)))
    # Not closed: never counted
    s.put("sales", "SL-OPEN", _sale("SL-OPEN", 90000, _ago(5), status="Pending Super Admin Review"))
    # Another client, below any useful limit
    s.put("sales", "SL-X", _sale("SL-X", 5000, _ago(10), pan="ZZZZZ9999Z", signed=_ago(9)))
    s.put("paidClients", "paid-SL-2", {"id": "paid-SL-2", "saleId": "SL-2", "panNumber": PAN, "phone": "9876543210",
                                       "serviceName": "Stock Cash", "serviceTenure": "12 Months", "segments": ["NSE BSE Equity"],
                                       "eSignedAt": _ago(18), "serviceStartDate": _ago(18),
                                       "serviceEndDate": (date.today() + timedelta(days=347)).isoformat(), "status": "Active"})
    return crm, mails


def test_lists_clients_above_the_limit_with_12_month_net_value_and_esign_date(ext):
    crm, _ = ext
    res = crm.client.get("/api/extended-service?limit=50000", headers=bearer(crm.token(SA)))
    assert res.status_code == 200, res.text
    clients = res.json()["clients"]
    assert [c["clientKey"] for c in clients] == [f"pan:{PAN}"]
    c = clients[0]
    assert c["netValue"] == 60000 and len(c["sales"]) == 2
    assert c["eSignDate"] == _ago(18) and c["firstESignDate"] == _ago(199)
    # Equal to the limit is not "crossed"
    assert crm.client.get("/api/extended-service?limit=60000", headers=bearer(crm.token(SA))).json()["clients"] == []
    # The last limit is remembered
    assert crm.client.get("/api/extended-service", headers=bearer(crm.token(SA))).json()["limit"] == 60000


def test_only_super_admin_by_default(ext):
    crm, _ = ext
    for who in (ADMIN, EXEC):
        assert crm.client.get("/api/extended-service?limit=1", headers=bearer(crm.token(who))).status_code == 403


def test_assign_puts_the_service_live_invoices_and_emails_it(ext):
    crm, mails = ext
    res = crm.client.post("/api/extended-service/assign", headers=bearer(crm.token(SA)),
                          json={"clientKey": f"pan:{PAN}", "serviceId": "srv-cash", "limit": 50000})
    assert res.status_code == 200, res.text
    a = res.json()
    assert a["emailStatus"] == "sent" and a["emailedTo"] == "ravi@example.com" and a["total"] == 11800
    # Same State as the company: invoiced with CGST + SGST on 10,000 net
    assert len(mails) == 1 and mails[0]["To"] == "ravi@example.com"
    assert any(p.get_filename().startswith("Invoice ") for p in mails[0].iter_attachments())
    paid = crm.store.get("paidClients", a["paidId"])
    assert paid["extendedService"] and paid["status"] == "Active" and paid["segments"] == ["NSE BSE Equity"]
    # Runs from today to the end of the client's current e-Sign period
    assert paid["serviceStartDate"] == date.today().isoformat()
    assert paid["serviceEndDate"] == (date.today() + timedelta(days=347)).isoformat()
    listed = crm.client.get("/api/extended-service?limit=50000", headers=bearer(crm.token(SA))).json()["clients"][0]
    assert listed["assignments"][0]["invoiceNumber"] == a["invoiceNumber"]
    pdf = crm.client.get(f"/api/extended-service/assignments/{a['id']}/pdf", headers=bearer(crm.token(SA)))
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")


def test_service_needs_a_value_and_client_must_qualify(ext):
    crm, _ = ext
    tok = bearer(crm.token(SA))
    res = crm.client.post("/api/extended-service/assign", headers=tok,
                          json={"clientKey": f"pan:{PAN}", "serviceId": "srv-free", "limit": 50000})
    assert res.status_code == 400 and "Value" in res.json()["detail"]
    res = crm.client.post("/api/extended-service/assign", headers=tok,
                          json={"clientKey": "pan:ZZZZZ9999Z", "serviceId": "srv-cash", "limit": 50000})
    assert res.status_code == 404


def test_failed_email_is_reported_and_can_be_resent(ext, monkeypatch):
    crm, mails = ext

    def down(settings, msg):
        raise RuntimeError("SMTP down")

    monkeypatch.setattr(crm.email_kit, "_smtp_send", down)
    tok = bearer(crm.token(SA))
    a = crm.client.post("/api/extended-service/assign", headers=tok,
                        json={"clientKey": f"pan:{PAN}", "serviceId": "srv-cash", "limit": 50000}).json()
    assert a["emailStatus"] == "failed" and "SMTP down" in a["emailError"]
    report = crm.client.get("/api/email/failures/delivery-report", headers=tok).json()
    failed = [r for r in report["rows"] if r["status"] == "Failed"]
    assert failed and failed[0]["emailType"] == "Extended Service Invoice" and not failed[0]["resolved"]

    monkeypatch.setattr(crm.email_kit, "_smtp_send", lambda settings, msg: mails.append(msg))
    again = crm.client.post(f"/api/extended-service/assignments/{a['id']}/resend", headers=tok).json()
    assert again["emailStatus"] == "sent"
    report = crm.client.get("/api/email/failures/delivery-report", headers=tok).json()
    assert {r["status"] for r in report["rows"]} == {"Sent", "Failed"}
    assert any(r["status"] == "Failed" and r["resolved"] for r in report["rows"])
    assert report["summary"]["sent"] == 1 and report["summary"]["failed"] == 1


def test_delivery_report_merges_welcome_kits_sent_and_failed(ext):
    crm, _ = ext
    ek = crm.email_kit
    crm.store.set_value(ek.LOG, [{"id": "k1", "saleId": "SL-2", "clientName": "Ravi Kumar", "to": "ravi@example.com",
                                  "from": "no-reply@example.com", "attachments": ["a.pdf", "b.pdf"], "agreementAttached": True,
                                  "kycFiles": ["kyc.pdf"], "sentAt": "2026-11-15T10:00:00Z", "sentBy": "Srinivas"}])
    ek.record_failure("Welcome Kit", "Asha", "asha@bad", "550 no such user", by="Srinivas", saleId="SL-X")
    rows = crm.client.get("/api/email/failures/delivery-report", headers=bearer(crm.token(ADMIN))).json()["rows"]
    assert [(r["clientName"], r["emailType"], r["status"]) for r in rows] == [
        ("Asha", "Welcome Kit", "Failed"), ("Ravi Kumar", "Welcome Kit", "Sent")]
    assert "2 attachment(s)" in rows[1]["detail"] and "1 e-KYC" in rows[1]["detail"]
    assert crm.client.get("/api/email/failures/delivery-report", headers=bearer(crm.token(EXEC))).status_code == 403


def test_client_master_status_overview(ext):
    crm, _ = ext
    s = crm.store
    s.put("kraRecords", "kra-1", {"id": "kra-1", "pan": PAN, "saleId": "SL-1", "kycStatus": "KYC Registered",
                                  "fetchedAt": "2026-11-01T10:00:00Z"})
    s.set_value(crm.email_kit.LOG, [{"id": "k1", "saleId": "SL-2", "to": "ravi@example.com", "sentAt": "2026-11-15T10:00:00Z"}])
    st = crm.client.get(f"/api/client-master/search?q={PAN}", headers=bearer(crm.token(SA))).json()["status"]
    assert st["kra"]["completed"] and st["kra"]["kycStatus"] == "KYC Registered"
    # The latest sale (SL-OPEN, paid 5 days ago) is not e-signed and no link has gone out yet
    assert st["ekyc"] == {**st["ekyc"], "completed": False, "linkSent": False, "saleId": "SL-OPEN"}
    assert st["welcomeKit"]["sent"]
    assert st["service"]["enabled"] and st["service"]["services"][0]["segments"] == ["NSE BSE Equity"]
    assert st["expired"] == {**st["expired"], "expired": False, "hasService": True}

    # Expired service, segments cleared
    paid = s.get("paidClients", "paid-SL-2")
    s.put("paidClients", "paid-SL-2", {**paid, "status": "Service Expired", "segments": [], "serviceEndDate": _ago(1)})
    st = crm.client.get(f"/api/client-master/search?q={PAN}", headers=bearer(crm.token(SA))).json()["status"]
    assert not st["service"]["enabled"] and st["expired"]["expired"]


def test_delete_esign_link(crm, monkeypatch):
    lg = crm.leegality
    calls = []
    state = {"status": "SENT"}

    def fake(method, path, settings, **kwargs):
        calls.append((method, path))
        if method == "GET":
            return 200, {"status": 1, "data": {"document": {"status": state["status"]}}}
        return 200, {"status": 1, "messages": [{"message": "Deleted"}]}

    monkeypatch.setattr(lg, "_settings", lambda: {"token": "t", "salt": "", "base_url": "https://x"})
    monkeypatch.setattr(lg, "_leegality", fake)
    lg._update_record("DOC123", {"documentId": "DOC123", "saleId": "SL-9", "documentStatus": "SENT"})

    assert crm.client.delete("/api/leegality/esign/DOC123", headers=bearer(crm.token(ADMIN))).status_code == 403
    res = crm.client.delete("/api/leegality/esign/DOC123", headers=bearer(crm.token(SA)))
    assert res.status_code == 200 and res.json()["deleted"]
    assert ("DELETE", "/v3.0/sign/request") in calls
    assert lg._read_records()["DOC123"]["documentStatus"] == "DELETED"

    state["status"] = "COMPLETED"
    assert crm.client.delete("/api/leegality/esign/DOC123", headers=bearer(crm.token(SA))).status_code == 409


def test_send_welcome_kit_granted_to_a_non_admin_is_scoped_to_their_team(ext):
    crm, _ = ext
    s = crm.store
    exec_id = next(u["id"] for u in s.all("users") if u.get("email") == EXEC)
    tok = bearer(crm.token(EXEC))
    s.put("sales", "SL-MINE", _sale("SL-MINE", 1000, _ago(3), submittedByUserId=exec_id))
    # Not granted: Super Admin / Admin only, as before
    assert crm.client.get("/api/email/welcome-kit/preview/SL-MINE", headers=tok).status_code == 403
    s.put("userPermissions", exec_id, {"id": exec_id, "value": {"send-welcome-kit": True}})
    assert crm.client.get("/api/email/welcome-kit/preview/SL-MINE", headers=tok).status_code == 200
    # Someone else's client stays out of reach
    assert crm.client.get("/api/email/welcome-kit/preview/SL-2", headers=tok).status_code == 404
    res = crm.client.post("/api/email/welcome-kit/send", headers=tok, json={"saleId": "SL-2"})
    assert res.status_code == 404
    s.delete("userPermissions", exec_id)


def test_client_status_old_client_only_when_every_sale_is_a_renewal(ext):
    crm, _ = ext
    s = crm.store
    other = "QWERT1234Y"
    # A new client whose only sale was rejected is not an Old Client: eKYC is simply not done
    s.put("sales", "SL-REJ", _sale("SL-REJ", 10000, _ago(3), pan=other, status="Rejected by Super Admin"))
    st = crm.client.get(f"/api/client-master/search?q={other}", headers=bearer(crm.token(SA))).json()["status"]
    assert not st["ekyc"]["oldClientOnly"] and not st["ekyc"]["completed"] and st["ekyc"]["saleId"] is None
    # Only Old Client renewals: eKYC is not required
    s.put("sales", "SL-REJ", _sale("SL-REJ", 10000, _ago(3), pan=other, clientType="Old Client"))
    st = crm.client.get(f"/api/client-master/search?q={other}", headers=bearer(crm.token(SA))).json()["status"]
    assert st["ekyc"]["oldClientOnly"]
