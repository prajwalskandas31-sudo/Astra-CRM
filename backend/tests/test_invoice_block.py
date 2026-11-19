from datetime import date, datetime, timezone

import pytest

from backend.tests.conftest import bearer

SA, ADMIN, EXEC = "superadmin@company.com", "admin@company.com", "tajayvarma76@gmail.com"

INDIVIDUAL = {"clientCategory": "Individual", "clientPrefix": "Mr.", "clientName": "VEMURI MANOHAR",
              "clientState": "Andhra Pradesh", "serviceName": "Equity & Derivative Research & Advisory Services",
              "serviceTenure": "1 Month", "grossSales": "₹25,000", "netSales": "21186.44", "gst": "3813.56"}
FIRM = {"clientCategory": "Non-Individual", "clientPrefix": "Mr.", "clientName": "M Rao", "firmName": "MMR ART CREATIONS",
        "gstin": "36cngpm7476m3z4", "clientState": "Gujarat", "serviceName": "Equity & Derivative Research & Advisory Services",
        "serviceTenure": "3 Months", "grossSales": "50000", "netSales": "42372.88", "gst": "7627.12"}


@pytest.fixture
def ib(crm):
    s = crm.store
    for coll in ("eSignRecords", "sales", "clientInvoices", "clientInvoiceFiles", "invoiceNumbers", "services", "branches"):
        for doc in s.all(coll):
            s.delete(coll, doc["id"])
    s.set_value("invoiceCounters", {})
    s.set_value("invoiceSettings", {})
    for key, value in (("companyName", "InvestEQ"), ("state", "Gujarat"), ("gstin", "24AAIFU6012A1ZQ"),
                       ("sebiRegistrationNumber", "INH000020350")):
        s.put("companyProfile", key, {"id": key, "value": value})
    s.put("services", "srv-1", {"id": "srv-1", "name": "Equity & Derivative Research & Advisory Services", "value": 90000})
    s.put("branches", "br-1", {"id": "br-1", "name": "Bangalore", "branchCode": "BLR"})
    user = s.get("users", "usr-3")
    s.put("users", "usr-3", {**user, "branchId": "br-1"})
    s.put("sales", "SL-1", {"id": "SL-1", "submittedByUserId": "usr-3", "employeeName": "Ajay", "fullClientInfo": INDIVIDUAL,
                            "eSignStatus": "Completed", "eSignDocumentId": "DOC1"})
    s.put("eSignRecords", "esign-1", {"id": "esign-1", "saleId": "SL-1", "documentId": "DOC1", "clientName": "VEMURI MANOHAR",
                                      "confirmedAt": "2026-11-13T10:00:00Z", "status": "Completed on Leegality"})
    # e-signed per the sale only (no E-Sign Block record)
    s.put("sales", "SL-2", {"id": "SL-2", "submittedByUserId": "usr-1", "fullClientInfo": FIRM,
                            "eSignStatus": "Completed", "eSignedAt": "2026-11-09T10:00:00Z"})
    # not e-signed: never listed
    s.put("sales", "SL-3", {"id": "SL-3", "submittedByUserId": "usr-3", "fullClientInfo": INDIVIDUAL, "eSignStatus": "Pending"})
    yield crm
    s.put("users", "usr-3", user)


def get(crm, who=SA):
    return crm.client.get("/api/invoice-block", headers=bearer(crm.token(who)))


def test_lists_only_esigned_clients_with_the_recommended_invoice(ib):
    res = get(ib)
    assert res.status_code == 200, res.text
    rows = {r["saleId"]: r for r in res.json()["rows"]}
    assert set(rows) == {"SL-1", "SL-2"}
    one = rows["SL-1"]
    # paid 25,000 of the 90,000 service: Invoice 2 with the balance
    assert one["recommended"] == 2 and one["balance"] == 65000 and one["serviceValue"] == 90000
    assert one["branch"] == {"code": "BLR", "source": "branch"}
    assert one["taxes"] == [{"name": "IGST", "percent": 18.0, "amount": 3813.56}] and one["total"] == 25000
    firm = rows["SL-2"]
    assert firm["billTo"] == "MMR ART CREATIONS" and firm["gstin"] == "36CNGPM7476M3Z4"
    # same State as the company: CGST + SGST
    assert [t["name"] for t in firm["taxes"]] == ["CGST", "SGST"] and firm["total"] == 50000.0
    assert firm["branch"]["code"] == "HO"  # usr-1 has no branch


def test_paying_the_full_value_recommends_invoice_1(ib):
    ib.store.put("services", "srv-1", {"id": "srv-1", "name": "Equity & Derivative Research & Advisory Services", "value": 25000})
    row = next(r for r in get(ib).json()["rows"] if r["saleId"] == "SL-1")
    assert row["recommended"] == 1 and row["balance"] == 0


def test_generate_numbers_by_branch_and_month_and_reissue_keeps_the_number(ib):
    tok = ib.token(SA)
    ib.client.put("/api/invoice-block/counters", json={"branchCode": "BLR", "nextNumber": 253}, headers=bearer(tok))
    res = ib.client.post("/api/invoice-block/SL-1/generate", json={"kind": 1}, headers=bearer(tok))
    assert res.status_code == 200, res.text
    now = datetime.now(ib.invoice.IST)
    number = f"BLR{now.month:02d}{now.year % 100:02d}253"
    assert res.json()["number"] == number and res.json()["kind"] == 1
    pdf = ib.client.get("/api/invoice-block/SL-1/pdf", headers=bearer(tok))
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF") and number in pdf.headers["content-disposition"]

    again = ib.client.post("/api/invoice-block/SL-1/generate", json={"kind": 2}, headers=bearer(tok)).json()
    assert again["number"] == number and again["kind"] == 2 and again["reissuedAt"] and again["balance"] == 65000
    # the next branch invoice moves on; HO has its own series
    branches = {b["code"]: b for b in get(ib).json()["branches"]}
    assert branches["BLR"]["nextNumber"] == 254 and branches["HO"]["nextNumber"] == 1
    # a number already issued cannot be handed out again
    assert ib.client.put("/api/invoice-block/counters", json={"branchCode": "BLR", "nextNumber": 253},
                         headers=bearer(tok)).status_code == 409


def test_not_esigned_or_unknown_is_404_and_invoice_2_needs_a_service_value(ib):
    tok = ib.token(SA)
    assert ib.client.post("/api/invoice-block/SL-3/generate", json={"kind": 1}, headers=bearer(tok)).status_code == 404
    assert ib.client.get("/api/invoice-block/SL-2/pdf", headers=bearer(tok)).status_code == 404
    ib.store.delete("services", "srv-1")
    res = ib.client.post("/api/invoice-block/SL-2/generate", json={"kind": 2}, headers=bearer(tok))
    assert res.status_code == 400 and "Service Master" in res.text


def test_super_admin_only_unless_feature_access_grants_it(ib):
    assert get(ib, ADMIN).status_code == 403 and get(ib, EXEC).status_code == 403
    admin = next(u for u in ib.store.all("users") if u.get("email") == ADMIN)
    ib.store.put("userPermissions", admin["id"], {"id": admin["id"], "value": {"invoice-block": True}})
    try:
        assert get(ib, ADMIN).status_code == 200
    finally:
        ib.store.delete("userPermissions", admin["id"])


def test_controls_change_rates_notes_and_default_branch(ib):
    tok = ib.token(SA)
    body = {"gstPercent": 18, "igstPercent": 12, "cgstPercent": 6, "sgstPercent": 6, "notes": " * Thanks ",
            "terms": "* Risky", "defaultBranchCode": "hyd"}
    res = ib.client.put("/api/invoice-block/settings", json=body, headers=bearer(tok))
    assert res.status_code == 200 and res.json()["defaultBranchCode"] == "HYD" and res.json()["notes"] == "* Thanks"
    rows = {r["saleId"]: r for r in get(ib).json()["rows"]}
    assert rows["SL-1"]["taxes"][0]["percent"] == 12.0 and rows["SL-2"]["branch"] == {"code": "HYD", "source": "default"}
    assert ib.client.put("/api/invoice-block/settings", json={**body, "igstPercent": 120},
                         headers=bearer(tok)).status_code == 422


def test_claude_drafts_notes(ib, monkeypatch):
    seen = {}

    def fake(cfg, system, prompt, schema, effort):
        seen.update(prompt=prompt, effort=effort)
        return schema(text="* One.\n\n* Two.")
    monkeypatch.setattr(ib.reports, "ask_claude", fake)
    monkeypatch.setattr(ib.reports, "settings", lambda: {"anthropic_key": "k", "model": "m"})
    res = ib.client.post("/api/invoice-block/draft-text", json={"field": "notes", "instruction": "Add a thanks line",
                                                               "current": "* Old"}, headers=bearer(ib.token(SA)))
    assert res.status_code == 200 and res.json()["text"] == "* One.\n* Two."
    assert "Add a thanks line" in seen["prompt"] and "* Old" in seen["prompt"] and seen["effort"] == "low"

    def held(*a):
        raise ib.reports.ReportHeld("ANTHROPIC_API_KEY is not set in backend/.env.")
    monkeypatch.setattr(ib.reports, "ask_claude", held)
    res = ib.client.post("/api/invoice-block/draft-text", json={"field": "terms"}, headers=bearer(ib.token(SA)))
    assert res.status_code == 503 and "ANTHROPIC_API_KEY" in res.text


def test_due_date_and_words(crm):
    inv = crm.invoice
    assert inv.due_date(date(2026, 11, 13), "1 Month") == date(2026, 12, 12)
    assert inv.due_date(date(2026, 11, 9), "1 Month") == date(2026, 12, 8)
    assert inv.due_date(date(2026, 1, 31), "1 Month") == date(2026, 2, 27)
    assert inv.due_date(date(2026, 11, 13), "12 Months") == date(2027, 11, 12)
    assert inv.due_date(date(2026, 11, 13), "Demo") == date(2026, 11, 19)
    assert inv.due_date(date(2026, 11, 13), "") is None
    assert inv.in_words(90000) == "Indian Rupee Ninety Thousand Only"
    assert inv.format_number("BLR", datetime(2026, 11, 13, tzinfo=timezone.utc), 253) == "BLR1126253"
