"""Annexure A for SaaS Reporting: manual reports, validation, conflicts and the Word / PDF downloads."""
import io
import re
import zipfile

import pytest

from backend.tests.conftest import bearer

SA, ADMIN = "superadmin@company.com", "admin@company.com"
URL = "/api/annexure-a-saas"


@pytest.fixture
def api(crm):
    s = crm.store
    s.delete_many("annexureASaas", [d["id"] for d in s.all("annexureASaas")])
    h = bearer(crm.token(SA))

    class Api:
        client = crm.client
        headers = h

        def create(self, label="SaaS Reporting - Nov 2026", **extra):
            res = crm.client.post(URL, json={"label": label, **extra}, headers=h)
            assert res.status_code == 200, res.text
            return res.json()

        def save(self, doc, **changes):
            return crm.client.put(f"{URL}/{doc['id']}", json={**doc, **changes}, headers=h)

    return Api()


def row(**values):
    base = {"enlistmentNumber": "", "iaRaName": "", "usingSaas": "", "serviceName": "", "serviceType": "",
            "criticality": "", "hostingLocation": "", "comments": ""}
    return {**base, **values}


def document_xml(content: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(content)) as z:
        assert z.namelist()[0] == "[Content_Types].xml"
        return z.read("word/document.xml").decode("utf-8")


def texts(xml: str) -> list:
    return re.findall(r"<w:t(?: [^>]*)?>([^<]*)</w:t>", xml)


def test_access(api, crm):
    assert crm.client.get(URL, headers=bearer(crm.token(ADMIN))).status_code == 403
    res = crm.client.get(URL, headers=api.headers)
    assert res.status_code == 200
    schema = res.json()["schema"]
    assert [c["title"] for c in schema["columns"]] == [
        "IA/RA Enlistment Number", "IA/RA Name", "Whether using any SaaS based solutions (Yes / No)",
        "Name of SaaS/ Hosted Service", "Type (SaaS or Hosted Service)", "Critical/ non-critical",
        "Location of hosting of SaaS/ Hosted Service (Within India/ Outside India)", "Comments (if any)"]


def test_new_report_is_the_blank_format(api):
    doc = api.create()
    assert len(doc["rows"]) == 16 and all(not any(r.values()) for r in doc["rows"])
    assert doc["cc"].startswith("BSE Ltd.") and doc["signatoryName"] == ""
    assert api.client.post(URL, json={"label": "  "}, headers=api.headers).status_code == 400


def test_save_cleans_and_validates(api):
    doc = api.create()
    res = api.save(doc, rows=[row(enlistmentNumber=" INH000012345 ", usingSaas="yes", serviceType="hosted service",
                                  criticality="non-critical", hostingLocation="within india", comments="line 1\nline 2"),
                              row()])
    assert res.status_code == 200, res.text
    saved = res.json()
    r = saved["rows"][0]
    assert (r["enlistmentNumber"], r["usingSaas"], r["serviceType"], r["criticality"], r["hostingLocation"]) == (
        "INH000012345", "Yes", "Hosted Service", "Non-critical", "Within India")
    assert r["comments"] == "line 1\nline 2" and len(saved["rows"]) == 2

    bad = api.save(saved, rows=[row(usingSaas="Maybe")])
    assert bad.status_code == 400 and "Row 1" in bad.json()["detail"]
    assert api.save(saved, rows=[]).status_code == 400

    listed = api.client.get(URL, headers=api.headers).json()["reports"]
    assert listed[0]["filledRows"] == 1 and listed[0]["rowCount"] == 2


def test_conflicting_save_is_refused(api):
    doc = api.create()
    first = api.save(doc, rows=[row(iaRaName="A")])
    assert first.status_code == 200
    stale = api.save(doc, rows=[row(iaRaName="B")])  # still holds the old updatedAt
    assert stale.status_code == 409
    assert api.client.get(f"{URL}/{doc['id']}", headers=api.headers).json()["rows"][0]["iaRaName"] == "A"


def test_copy_and_delete(api):
    doc = api.create()
    api.save(doc, rows=[row(serviceName="Zoho CRM")], signatoryName="R. Analyst")
    copy = api.create(label="Copy", copyFrom=doc["id"])
    assert copy["id"] != doc["id"] and copy["rows"][0]["serviceName"] == "Zoho CRM" and copy["signatoryName"] == "R. Analyst"
    assert api.client.delete(f"{URL}/{doc['id']}", headers=api.headers).status_code == 200
    assert api.client.get(f"{URL}/{doc['id']}", headers=api.headers).status_code == 404


def test_word_download_fills_the_template(api):
    doc = api.create()
    rows = [row(enlistmentNumber="INH000012345", iaRaName="Unite <R&A>", usingSaas="Yes", serviceName="AWS",
                serviceType="SaaS", criticality="Critical", hostingLocation="Outside India", comments="a\nb")] + \
           [row() for _ in range(19)]
    saved = api.save(doc, rows=rows, signatoryName="R. Analyst", signatoryDesignation="Proprietor",
                     cc="BSE Ltd.\nMumbai").json()
    res = api.client.get(f"{URL}/{saved['id']}/docx", headers=api.headers)
    assert res.status_code == 200
    assert "Annexure A for SaaS Reporting" in res.headers["content-disposition"]
    xml = document_xml(res.content)
    t = texts(xml)
    assert t[0] == "Annexure A" and "IA/RA Enlistment Number" in t
    assert "Unite &lt;R&amp;A&gt;" in xml and "Outside India" in t and "a" in t and "b" in t
    assert len(re.findall(r"<w:tr\b", xml)) == 1 + 20  # header + every row, numbered 1..20
    assert [x for x in t if x.isdigit()][-1] == "20"
    assert "<w:tblHeader/>" in xml
    assert t.index("With Regards") < t.index("________________") < t.index("R. Analyst") < t.index("Proprietor")
    assert "c.c.:   BSE Ltd." in t and "Mumbai" in t and "25th Floor, P. J. Towers, Fort" not in t
    assert len(set(re.findall(r'w14:paraId="([^"]+)"', xml))) == len(re.findall(r'w14:paraId="', xml))


def test_blank_cc_and_pdf(api):
    doc = api.create()
    saved = api.save(doc, rows=doc["rows"], cc="").json()
    xml = document_xml(api.client.get(f"{URL}/{saved['id']}/docx", headers=api.headers).content)
    assert "c.c." not in xml and "With Regards" in xml
    res = api.client.get(f"{URL}/{saved['id']}/pdf", headers=api.headers)
    assert res.status_code == 200 and res.content.startswith(b"%PDF")
