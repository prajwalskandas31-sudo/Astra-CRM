"""E-Sign Block toggles for Aadhaar / Virtual Sign: each combination goes through its own Leegality workflow,
and a document whose signature types do not match the toggles is cancelled."""
import base64
import io

import pytest
from fastapi import HTTPException
from PIL import Image

from backend.tests.conftest import bearer

CLIENT = {"name": "Test Client", "email": "c@example.com", "phone": "9876543210"}


def _png():
    buf = io.BytesIO()
    Image.new("RGBA", (300, 100), (0, 0, 0, 255)).save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def _dispatch(monkeypatch, leegality, cfg, allowed):
    """Run a dispatch against a fake Leegality whose new document allows `allowed` signature types."""
    sent = {"calls": []}

    def fake(method, path, settings, **kwargs):
        sent["calls"].append((method, path, kwargs.get("params")))
        if method == "DELETE":
            return 200, {"status": 1}
        sent["payload"] = kwargs["json"]
        return 200, {"status": 1, "data": {"documentId": "DOC-1", "invitees": [kwargs["json"]["invitees"][0]]}, "messages": []}

    monkeypatch.setattr(leegality, "_settings", lambda: {"token": "t", "salt": "", "base_url": "https://x"})
    monkeypatch.setattr(leegality, "_sign_types", lambda: cfg)
    monkeypatch.setattr(leegality, "_leegality", fake)
    monkeypatch.setattr(leegality, "_wallet", lambda settings: {})
    monkeypatch.setattr(leegality, "_delivery_config",
                        lambda *a: {"templateMatches": True, "invitees": [{**CLIENT, "allowedSignatures": allowed}]})
    monkeypatch.setattr(leegality, "_update_record", lambda doc_id, record: record)
    monkeypatch.setattr(leegality, "stored_primary_signature", _png)
    req = leegality.ESignDispatchRequest(saleId="S1", clientName=CLIENT["name"], email=CLIENT["email"],
                                         phone=CLIENT["phone"], serviceTenure="3 Months")
    return sent, lambda: leegality.dispatch_esign(req, current_user={"name": "SA"})


def _cfg(aadhaar, virtual):
    return {"aadhaar": aadhaar, "virtualSign": virtual, "workflows": {"aadhaar": "WF_A", "virtualSign": "KKliSJp", "both": "WF_AV"}}


@pytest.mark.parametrize("aadhaar, virtual, workflow, allowed", [
    (False, True, "KKliSJp", ["VIRTUAL_SIGN"]),
    (True, False, "WF_A", ["AADHAAR"]),
    (True, True, "WF_AV", ["Aadhaar eSign", "Virtual Sign"]),
])
def test_each_combination_uses_its_workflow(monkeypatch, crm, aadhaar, virtual, workflow, allowed):
    sent, run = _dispatch(monkeypatch, crm.leegality, _cfg(aadhaar, virtual), allowed)
    record = run()
    assert sent["payload"]["profileId"] == workflow
    assert record["profileId"] == workflow and record["signatureTypes"]["check"] == "matched"
    assert not [c for c in sent["calls"] if c[0] == "DELETE"]


def test_workflow_with_other_signature_types_is_cancelled(monkeypatch, crm):
    # CRM: Aadhaar only; the workflow still allows Virtual Sign too
    sent, run = _dispatch(monkeypatch, crm.leegality, _cfg(True, False), ["AADHAAR", "VIRTUAL_SIGN"])
    with pytest.raises(HTTPException) as err:
        run()
    assert err.value.status_code == 409
    assert "Aadhaar but the workflow allows Aadhaar + Virtual Sign" in err.value.detail and "was cancelled" in err.value.detail
    assert ("DELETE", "/v3.0/sign/request", {"documentId": "DOC-1"}) in sent["calls"]


def test_unreported_types_are_recorded_as_unverified_not_cancelled(monkeypatch, crm):
    sent, run = _dispatch(monkeypatch, crm.leegality, _cfg(False, True), [])
    assert run()["signatureTypes"]["check"] == "unverified"
    assert not [c for c in sent["calls"] if c[0] == "DELETE"]


def test_combination_without_a_workflow_is_refused_before_sending(monkeypatch, crm):
    cfg = _cfg(True, True) | {"workflows": {"aadhaar": "", "virtualSign": "KKliSJp", "both": ""}}
    sent, run = _dispatch(monkeypatch, crm.leegality, cfg, [])
    with pytest.raises(HTTPException) as err:
        run()
    assert err.value.status_code == 400 and "Aadhaar + Virtual Sign" in err.value.detail
    assert sent["calls"] == []


def test_settings_endpoint_defaults_saves_and_validates(crm):
    tok = bearer(crm.token("superadmin@company.com"))
    res = crm.client.get("/api/leegality/signature-types", headers=tok)
    assert res.status_code == 200, res.text
    assert (res.json()["aadhaar"], res.json()["virtualSign"], res.json()["activeWorkflow"]) == (False, True, "KKliSJp")

    # Turning Aadhaar on needs the both-types workflow
    bad = crm.client.put("/api/leegality/signature-types", headers=tok, json={"aadhaar": True, "virtualSign": True, "workflows": {}})
    assert bad.status_code == 400
    assert crm.client.put("/api/leegality/signature-types", headers=tok,
                          json={"aadhaar": False, "virtualSign": False, "workflows": {}}).status_code == 400
    assert crm.client.put("/api/leegality/signature-types", headers=tok,
                          json={"aadhaar": True, "virtualSign": False, "workflows": {"aadhaar": "bad id!"}}).status_code == 400

    ok = crm.client.put("/api/leegality/signature-types", headers=tok,
                        json={"aadhaar": True, "virtualSign": True, "workflows": {"both": " WF_AV "}})
    assert ok.status_code == 200, ok.text
    assert (ok.json()["activeCombo"], ok.json()["activeWorkflow"]) == ("both", "WF_AV")
    assert crm.client.get("/api/leegality/signature-types", headers=tok).json()["workflows"]["virtualSign"] == "KKliSJp"

    # Restore the default for other tests sharing the database
    crm.client.put("/api/leegality/signature-types", headers=tok, json={"aadhaar": False, "virtualSign": True, "workflows": {}})


def test_only_super_admin_can_change_signature_types(crm):
    from backend import database
    other = next(u["email"] for u in database.USERS_DB if u.get("role") != "Super Admin")
    res = crm.client.put("/api/leegality/signature-types", headers=bearer(crm.token(other)),
                         json={"aadhaar": True, "virtualSign": True, "workflows": {}})
    assert res.status_code == 403


# ─── Per-client choice from the Sale Approval queue (exactly one type, never both) ───
def _dispatch_for_sale(monkeypatch, leegality, cfg, allowed, signature_type):
    sent, _ = _dispatch(monkeypatch, leegality, cfg, allowed)
    req = leegality.ESignDispatchRequest(saleId="S1", clientName=CLIENT["name"], email=CLIENT["email"],
                                         phone=CLIENT["phone"], serviceTenure="3 Months", signatureType=signature_type)
    return sent, lambda: leegality.dispatch_esign(req, current_user={"name": "SA"})


@pytest.mark.parametrize("signature_type, workflow, allowed", [
    ("aadhaar", "WF_A", ["AADHAAR"]),
    ("virtualSign", "KKliSJp", ["VIRTUAL_SIGN"]),
])
def test_sale_choice_overrides_the_block_default(monkeypatch, crm, signature_type, workflow, allowed):
    # The E-Sign Block default is "both"; the sale's own choice wins and is only ever one type
    sent, run = _dispatch_for_sale(monkeypatch, crm.leegality, _cfg(True, True), allowed, signature_type)
    record = run()
    assert sent["payload"]["profileId"] == workflow
    assert record["signatureTypes"]["combo"] == signature_type
    assert record["signatureTypes"]["source"] == "sale"
    assert record["signatureTypes"]["check"] == "matched"


def test_sale_choice_without_its_workflow_is_refused(monkeypatch, crm):
    cfg = {"aadhaar": False, "virtualSign": True, "workflows": {"aadhaar": "", "virtualSign": "KKliSJp", "both": ""}}
    sent, run = _dispatch_for_sale(monkeypatch, crm.leegality, cfg, ["AADHAAR"], "aadhaar")
    with pytest.raises(HTTPException) as exc:
        run()
    assert exc.value.status_code == 400 and "Aadhaar only" in exc.value.detail
    assert "payload" not in sent


def test_unknown_sale_choice_is_refused(monkeypatch, crm):
    sent, run = _dispatch_for_sale(monkeypatch, crm.leegality, _cfg(False, True), ["VIRTUAL_SIGN"], "both")
    with pytest.raises(HTTPException) as exc:
        run()
    assert exc.value.status_code == 400
    assert "payload" not in sent
