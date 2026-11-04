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
    assert all(f["type"] == "files" and f["name"] == "Image 1" for f in fields)
    # 24-hour clock: 3 PM is 15, not 03
    assert [s["label"] for s in stamps] == ["Signed: 04-11-2026 15:07:09 IST"] * 2
    for f in fields:
        img = Image.open(io.BytesIO(base64.b64decode(f["value"])))
        assert img.size == (int(f["width"]) * 4, int(f["height"]) * 4)


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
    download = [{"id": "d1", "name": "Date 1", "type": "text"}]
    download += [{"id": f"c{i}", "name": "Checkbox 1", "type": "checkbox", "value": f"Option {i}"} for i in range(1, 14)]
    download += [{"id": "i1", "name": "Image 1", "type": "files", "width": "180", "height": "70"},
                 {"id": "i2", "name": "Image 1", "type": "files", "width": "180", "height": "70"}]

    assert importer.apply_ids(tmap, importer._entries({"fields": download})) == []
    assert tmap["dateField"]["id"] == "d1"
    assert [o["id"] for o in tmap["tenureCheckbox"]["options"]] == [f"c{i}" for i in range(1, 14)]
    assert [(f["id"], f["width"]) for f in tmap["signatureImageFields"]] == [("i1", "180"), ("i2", "180")]


def test_importer_reports_a_download_with_one_image_box():
    tmap = copy.deepcopy(leegality._template_map())
    missing = importer.apply_ids(tmap, [{"id": "d1", "name": "Date 1"}, {"id": "i1", "name": "Image 1", "type": "files"}])
    assert any("signature image fields" in m for m in missing)
