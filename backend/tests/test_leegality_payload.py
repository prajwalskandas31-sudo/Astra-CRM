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


@pytest.mark.parametrize("tenure, option", [("Demo", "Option 1"), ("1 Month", "Option 2"), ("2 months", "Option 3"),
                                            ("6 Months", "Option 7"), ("11 Months", "Option 12"), ("12 Months", "Option 13")])
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
    assert all(f["type"] == "file" and f["name"] == "Image 1" for f in fields)
    # 24-hour clock: 3 PM is 15, not 03
    assert [s["label"] for s in stamps] == ["Signed: 04-11-2026 15:07:09 IST"] * 2
    for f in fields:
        img = Image.open(io.BytesIO(base64.b64decode(f["value"])))
        assert img.size == (200 * 4, 80 * 4)


def test_dispatch_sends_the_template_fields_as_leegality_downloaded_them(monkeypatch):
    """The real map: every field by its Download Form Fields id, type and value."""
    sent = {}

    def fake_leegality(method, path, settings, **kwargs):
        sent["payload"] = kwargs["json"]
        return 200, {"status": 1, "data": {"documentId": "DOC-1", "invitees": []}, "messages": []}

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
    assert [(f["name"], f["value"], f["id"]) for f in checked] == [("Checkbox 1", "Option 4", "1793543363860")]
    assert sum(f["type"] == "checkbox" for f in by_id.values()) == 13
    images = [by_id["1793543538337"], by_id["1793543581913"]]
    assert all(f["name"] == "Image 1" and f["type"] == "file" and f["value"] for f in images)
    assert payload["invitees"] == [{"name": "Test Client", "email": "c@example.com", "phone": "9876543210"}]


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
    assert [(f["id"], f["type"], f["width"]) for f in tmap["signatureImageFields"]] == [("i1", "file", "auto"), ("i2", "file", "auto")]


def test_importer_reports_a_download_with_one_image_box():
    tmap = copy.deepcopy(leegality._template_map())
    missing = importer.apply_ids(tmap, [{"id": "d1", "name": "Date 1"}, {"id": "i1", "name": "Image 1", "type": "files"}])
    assert any("signature image fields" in m for m in missing)
