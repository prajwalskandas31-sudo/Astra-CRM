"""The kFWn7uC form fields the CRM fills for workflow KKliSJp: Date 1, the Service Tenure checkbox and both stamped signatures."""
import base64
import copy
import io
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from PIL import Image

import backend.leegality as leegality
from deploy import import_leegality_fields as importer

IST = timezone(timedelta(minutes=330))


def _png_data_url():
    img = Image.new("RGBA", (300, 100), (255, 255, 255, 0))
    for x in range(20, 280):
        img.putpixel((x, 50), (0, 0, 0, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def _tmap_with_ids():
    tmap = copy.deepcopy(leegality._template_map())
    tmap["dateField"]["id"] = "date-id"
    for i, opt in enumerate(tmap["tenureCheckbox"]["options"], 1):
        opt["id"] = f"opt-{i}"
    for i, cfg in enumerate(tmap["signatureImageFields"], 1):
        cfg["id"] = f"img-{i}"
    return tmap


def test_map_targets_the_ra_terms_workflow_and_template():
    tmap = leegality._template_map()
    assert (tmap["profileId"], tmap["templateId"]) == ("KKliSJp", "kFWn7uC")
    assert len(tmap["signatureImageFields"]) == 2


# The template's own order (verified on a live document): Option N = N Months, Option 13 = Demo
@pytest.mark.parametrize("tenure, option", [("1 Month", "Option 1"), ("2 months", "Option 2"), ("3 Months", "Option 3"),
                                            ("6 Months", "Option 6"), ("12 Months", "Option 12"), ("Demo", "Option 13")])
def test_service_tenure_selects_its_checkbox_option(tenure, option):
    tmap = leegality._template_map()
    assert tmap["tenureCheckbox"]["options"][leegality._tenure_option(tmap, tenure)]["name"] == option


def test_unknown_tenure_is_refused():
    with pytest.raises(HTTPException) as err:
        leegality._tenure_option(leegality._template_map(), "18 Months")
    assert err.value.status_code == 400


def test_both_signature_boxes_get_the_stamped_signature(monkeypatch):
    monkeypatch.setattr(leegality, "_now", lambda tmap: datetime(2026, 11, 4, 15, 7, 9, tzinfo=IST))
    fields, stamps = leegality._signature_fields(_tmap_with_ids(), _png_data_url())

    assert [f["id"] for f in fields] == ["img-1", "img-2"]
    # Leegality fills an image only as type "files", a data URL and px dimensions
    assert all(f["type"] == "files" and f["name"] == "Image 1" and (f["width"], f["height"]) == ("300", "60") for f in fields)
    # 24-hour clock: 3 PM is 15, not 03
    assert [s["label"] for s in stamps] == ["Signed: 04-11-2026 15:07:09 IST"] * 2
    for f in fields:
        assert f["value"].startswith("data:image/png;base64,")
        img = Image.open(io.BytesIO(base64.b64decode(f["value"].split(",", 1)[1])))
        assert img.size == (300 * 4, 60 * 4)  # the boxes' 5:1 shape


def test_stamp_font_scales_without_system_fonts(monkeypatch):
    """The server container has no fonts; the stamp must not fall back to a fixed 10 px font."""
    real_truetype = leegality.ImageFont.truetype

    def no_system_fonts(font=None, size=10, *args, **kwargs):
        if isinstance(font, str):
            raise OSError(font)  # a system font by name; Pillow's bundled font arrives as bytes
        return real_truetype(font, size, *args, **kwargs)
    monkeypatch.setattr(leegality.ImageFont, "truetype", no_system_fonts)
    assert leegality._font(48).size == 48


def _fake_leegality(sent, signer=None):
    """Leegality's sign request: echoes the invitee it used (the workflow's saved signer, if one is given)."""
    def fake(method, path, settings, **kwargs):
        sent.setdefault("calls", []).append((method, path, kwargs.get("params")))
        if method == "DELETE":
            return 200, {"status": 1, "messages": [{"code": "document.delete.success"}]}
        sent["payload"] = kwargs["json"]
        used = signer or kwargs["json"]["invitees"][0]
        return 200, {"status": 1, "data": {"documentId": "DOC-1", "invitees": [used]}, "messages": []}
    return fake


def test_dispatch_sends_the_template_fields_as_leegality_downloaded_them(monkeypatch):
    """The real map: every field by its Download Form Fields id, type and value."""
    sent = {}
    fake_leegality = _fake_leegality(sent)

    monkeypatch.setattr(leegality, "_settings", lambda: {"token": "t", "salt": "", "base_url": "https://x"})
    monkeypatch.setattr(leegality, "_leegality", fake_leegality)
    monkeypatch.setattr(leegality, "_wallet", lambda settings: {})
    monkeypatch.setattr(leegality, "_delivery_config", lambda *a: {})
    monkeypatch.setattr(leegality, "_update_record", lambda doc_id, record: record)
    monkeypatch.setattr(leegality, "stored_primary_signature", _png_data_url)
    monkeypatch.setattr(leegality, "_now", lambda tmap: datetime(2026, 11, 4, 21, 30, 0, tzinfo=IST))

    req = leegality.ESignDispatchRequest(saleId="S1", clientName="Test Client", email="c@example.com",
                                         phone="+91 98765 43210", serviceTenure="3 Months")
    leegality.dispatch_esign(req, current_user={"name": "SA"})
    payload = sent["payload"]
    by_id = {f["id"]: f for f in payload["file"]["fields"]}

    assert payload["profileId"] == "KKliSJp"
    assert by_id["1793543330123"] == {"id": "1793543330123", "name": "Date 1", "type": "date", "value": "04/11/2026"}
    checked = [f for f in by_id.values() if f["type"] == "checkbox" and f["checked"]]
    assert [(f["name"], f["value"], f["id"]) for f in checked] == [("Checkbox 1", "Option 3", "1793543359928")]
    assert sum(f["type"] == "checkbox" for f in by_id.values()) == 13
    images = [by_id["1793543538337"], by_id["1793543581913"]]
    assert all(f["name"] == "Image 1" and f["type"] == "files" and f["value"].startswith("data:image/png;base64,") for f in images)
    assert payload["invitees"] == [{"name": "Test Client", "email": "c@example.com", "phone": "9876543210"}]
    assert not [c for c in sent["calls"] if c[0] == "DELETE"]


def test_agreement_sent_to_the_workflows_saved_signer_is_cancelled(monkeypatch):
    """Workflow KKliSJp had a saved signer that Leegality used instead of the client from the CRM."""
    sent = {}
    saved_signer = {"name": "af", "email": "signer@example.com", "phone": "9000000001"}
    monkeypatch.setattr(leegality, "_settings", lambda: {"token": "t", "salt": "", "base_url": "https://x"})
    monkeypatch.setattr(leegality, "_leegality", _fake_leegality(sent, saved_signer))
    monkeypatch.setattr(leegality, "_update_record", lambda doc_id, record: pytest.fail("must not be recorded as sent"))
    monkeypatch.setattr(leegality, "stored_primary_signature", _png_data_url)

    req = leegality.ESignDispatchRequest(saleId="S1", clientName="test_3", email="signer@example.com",
                                         phone="9000000002", serviceTenure="3 Months")
    with pytest.raises(HTTPException) as err:
        leegality.dispatch_esign(req, current_user={"name": "SA"})

    assert err.value.status_code == 409
    assert "saved signer (af" in err.value.detail and "was cancelled" in err.value.detail
    assert ("DELETE", "/v3.0/sign/request", {"documentId": "DOC-1"}) in sent["calls"]


def test_signer_match_ignores_case_spacing_and_country_code():
    assert leegality._contact_key("Ravi  Kumar", "Ravi@X.com ", "+91 98765-43210") == \
        leegality._contact_key("ravi kumar", "ravi@x.com", "9876543210")


def test_signature_boxes_without_ids_are_refused_before_sending():
    with pytest.raises(HTTPException) as err:
        leegality._signature_fields(leegality._template_map() | {"signatureImageFields": [
            {"id": None, "name": "Image 1", "width": "200", "height": "80"},
            {"id": None, "name": "Image 1", "width": "200", "height": "80"}]}, _png_data_url())
    assert err.value.status_code == 409
    assert "import_leegality_fields" in err.value.detail


def test_missing_signature_is_refused():
    with pytest.raises(HTTPException) as err:
        leegality._signature_fields(_tmap_with_ids(), None)
    assert "Digital Signature Storage" in err.value.detail


def test_importer_fills_every_id_from_the_dashboard_download():
    tmap = copy.deepcopy(leegality._template_map())
    # Same shape as Leegality's download for kFWn7uC
    download = [{"id": "d1", "name": "Date 1", "type": "date", "format": "dd/mm/yyyy"}]
    download += [{"id": f"c{i}", "name": "Checkbox 1", "type": "checkbox", "value": f"Option {i}"} for i in range(1, 14)]
    download += [{"id": "i1", "name": "Image 1", "type": "file", "width": "auto", "height": "auto"},
                 {"id": "i2", "name": "Image 1", "type": "file", "width": "auto", "height": "auto"}]

    assert importer.apply_ids(tmap, importer._entries({"templateId": "kFWn7uC", "fields": download})) == []
    assert (tmap["dateField"]["id"], tmap["dateField"]["type"]) == ("d1", "date")
    assert [o["id"] for o in tmap["tenureCheckbox"]["options"]] == [f"c{i}" for i in range(1, 14)]
    # Ids only: the download's type "file" / "auto" size is not what the API fills
    assert [(f["id"], f["type"], f["width"]) for f in tmap["signatureImageFields"]] == [("i1", "files", "300"), ("i2", "files", "300")]


def test_importer_reports_a_download_with_one_image_box():
    tmap = copy.deepcopy(leegality._template_map())
    missing = importer.apply_ids(tmap, [{"id": "d1", "name": "Date 1"}, {"id": "i1", "name": "Image 1", "type": "files"}])
    assert any("signature image fields" in m for m in missing)
