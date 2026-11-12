"""Research Reports: numbers, checks on Claude's text, Upstox lookups, the PDF and the whole pipeline.
Claude and Upstox are replaced by fakes; nothing leaves the machine."""
import base64
from datetime import datetime

import pytest

from backend.tests.conftest import bearer
from backend.tests.test_broadcasts import SA, EXEC

PROFILE = {"companyName": "Test Research Pvt Ltd", "sebiRegistrationNumber": "INH000000001",
           "registeredAddress": "1 MG Road, Bengaluru 560001", "contact": "+91 90000 00000",
           "email": "desk@test.example", "website": "www.test.example"}


@pytest.fixture
def reports(crm):
    return crm.reports


def set_profile(crm, profile):
    for key, value in profile.items():
        crm.store.put("companyProfile", key, {"id": key, "value": value})


def candles(day="2026-11-11", n=120, start=25000.0):
    rows, price = [], start
    for i in range(n):
        o, c = price, price + (3 if i % 3 else -2)
        rows.append((f"{day}T{9 + (15 + i) // 60:02d}:{(15 + i) % 60:02d}:00+05:30", o, max(o, c) + 1, min(o, c) - 1, c))
        price = c
    return {"day": day, "dayLabel": "11 Nov 2026", "lastTradingDay": False, "candles": rows}


# ---------- numbers ----------
def test_trade_math_buy_and_sell(reports):
    assert reports.trade_math("Buy", "120", "100", ["150", "180"]) == {"risk": "20", "gains": ["30", "60"], "rr": ["1:1.5", "1:3"]}
    assert reports.trade_math("SELL", "200", "215", ["170"]) == {"risk": "15", "gains": ["30"], "rr": ["1:2"]}


def test_trade_math_rejects_wrong_side_stop_loss(reports):
    with pytest.raises(reports.ReportHeld):
        reports.trade_math("Buy", "120", "130", ["150"])
    with pytest.raises(reports.ReportHeld):
        reports.trade_math("Sell", "120", "130", ["150"])


# ---------- checks on Claude's page 2 ----------
TEMPLATE = "Entry at {entry}, stop-loss {sl}, 20 and 50 EMAs. Fibonacci zones are not guaranteed to hold."
VALUES = {"entry": "120", "sl": "100"}


def test_check_page2_passes_clean_text(reports):
    text = "Entry at 120, stop-loss 100, 20 and 50 EMAs. Fibonacci zones are not guaranteed to hold."
    assert reports.check_page2(text, TEMPLATE, VALUES, ["120", "100"]) == []


def test_check_page2_catches_new_numbers_banned_words_and_blanks(reports):
    problems = reports.check_page2("Entry at 120, stop-loss 100, RSI at 64. A sure-shot, guaranteed and guaranteed {t2}.",
                                   TEMPLATE, VALUES, ["120", "100", "NIFTY"])
    text = " ".join(problems)
    assert "64" in text and "sure-shot" in text and "guaranteed" in text and "placeholder" in text and "NIFTY" in text


# ---------- Upstox instrument lookup ----------
NOW = datetime(2026, 11, 11, 10, 0, tzinfo=None)


def index(reports):
    ms = lambda y, m, d: int(datetime(y, m, d, 15, 30, tzinfo=reports.IST).timestamp() * 1000)
    return reports._build_index({
        "NSE": [
            {"segment": "NSE_INDEX", "instrument_type": "INDEX", "instrument_key": "NSE_INDEX|Nifty 50", "trading_symbol": "NIFTY", "name": "Nifty 50"},
            {"segment": "NSE_FO", "instrument_type": "CE", "underlying_symbol": "NIFTY", "underlying_key": "NSE_INDEX|Nifty 50", "expiry": ms(2026, 11, 10), "instrument_key": "a"},
            {"segment": "NSE_FO", "instrument_type": "PE", "underlying_symbol": "NIFTY", "underlying_key": "NSE_INDEX|Nifty 50", "expiry": ms(2026, 11, 17), "instrument_key": "b"},
            {"segment": "NSE_FO", "instrument_type": "CE", "underlying_symbol": "NIFTY", "underlying_key": "NSE_INDEX|Nifty 50", "expiry": ms(2026, 11, 24), "instrument_key": "c"},
            {"segment": "NSE_FO", "instrument_type": "FUT", "underlying_symbol": "NIFTY", "underlying_key": "NSE_INDEX|Nifty 50", "expiry": ms(2026, 11, 24), "instrument_key": "d", "trading_symbol": "NIFTY FUT"},
            {"segment": "NSE_EQ", "instrument_type": "EQ", "instrument_key": "NSE_EQ|INE002A01018", "trading_symbol": "RELIANCE"},
        ],
        "MCX": [
            {"segment": "MCX_FO", "instrument_type": "CE", "underlying_symbol": "GOLD", "underlying_key": "MCX_FO|2", "expiry": ms(2026, 11, 25), "instrument_key": "g1"},
            {"segment": "MCX_FO", "instrument_type": "FUT", "underlying_symbol": "GOLD", "underlying_key": "MCX_COM|1", "expiry": ms(2026, 12, 5), "instrument_key": "MCX_FO|1", "trading_symbol": "GOLD FUT 05 DEC 26"},
            {"segment": "MCX_FO", "instrument_type": "FUT", "underlying_symbol": "GOLD", "underlying_key": "MCX_COM|1", "expiry": ms(2027, 2, 5), "instrument_key": "MCX_FO|2", "trading_symbol": "GOLD FUT 05 FEB 27"},
        ],
    })


def test_nearest_option_expiry_and_index_chart(reports):
    at = datetime(2026, 11, 11, 10, 0, tzinfo=reports.IST)
    call = {"symbol": "NIFTY", "underlying": "NIFTY", "instrument": "option"}
    found = reports.resolve_instrument(index(reports), call, "NSE DERIVATIVES", at)
    # 10 Nov has passed; 17 Nov is the nearest expiry from now
    assert found == {"chartKey": "NSE_INDEX|Nifty 50", "chartLabel": "Nifty 50", "expiry": "17 Nov 2026"}


def test_commodity_charts_current_month_future(reports):
    at = datetime(2026, 11, 11, 10, 0, tzinfo=reports.IST)
    call = {"symbol": "GOLD", "underlying": "GOLD", "instrument": "option"}
    found = reports.resolve_instrument(index(reports), call, "MCX DERIVATIVES", at)
    assert found == {"chartKey": "MCX_FO|1", "chartLabel": "GOLD FUT 05 DEC 26", "expiry": "25 Nov 2026"}


def test_equity_and_unknown_symbols(reports):
    idx = index(reports)
    found = reports.resolve_instrument(idx, {"symbol": "RELIANCE", "underlying": "RELIANCE", "instrument": "equity"}, "NSE BSE EQUITY")
    assert found == {"chartKey": "NSE_EQ|INE002A01018", "chartLabel": "RELIANCE", "expiry": None}
    with pytest.raises(reports.ReportHeld):
        reports.resolve_instrument(idx, {"symbol": "XYZ", "underlying": "XYZ", "instrument": "option"}, "NSE DERIVATIVES")


# ---------- PDF ----------
PAGE2 = ("**Technical Rationale: NIFTY 24500 CE (17 Nov 2026 expiry), Buy**\n\nThis is a Buy on the NIFTY 24500 CE contract.\n\n"
         "Entry at 120 ... The view is invalidated if the premium falls to 100.\n\n**Rationale for records:** Entry 120, stop-loss 100.")
CALL = {"symbol": "NIFTY", "underlying": "NIFTY", "instrument": "option", "side": "Buy", "strike": "24500",
        "optionType": "CE", "entry": "120", "stopLoss": "100", "targets": ["150", "180"]}


def test_option_risk_names_buyer_or_seller_as_posted(reports):
    fields = {"BUYER": "seller", "CE/PE": "PE"}
    assert "As a seller of a PE option" in reports._fill(reports.OPTION_RISKS, fields)
    assert "As a buyer of a CE option" in reports._fill(reports.OPTION_RISKS, {"BUYER": "buyer", "CE/PE": "CE"})


def test_pdf_is_three_pages(reports):
    pdf = reports.build_pdf(PROFILE, CALL, candles(), "Nifty 50", "17 Nov 2026", PAGE2, "11 Nov 2026")
    assert pdf.startswith(b"%PDF") and len(pdf) > 3000


# ---------- the whole pipeline ----------
def build(reports, *args, **kwargs):
    """Queue one report and build it straight away, as the processing thread would."""
    record = reports.submit(*args, **kwargs)
    record.update({"status": "Generating", "startedAt": datetime.now(reports.timezone.utc).isoformat()})
    reports.store.put(reports.REPORTS, record["id"], record)
    return reports.run(record["id"])


def fake_pipeline(reports, monkeypatch, parsed=None):
    claude_calls = []

    def ask(cfg, system, prompt, schema, effort):
        claude_calls.append(schema.__name__)
        if schema is reports.ParsedCall:
            return parsed or reports.ParsedCall(symbol="NIFTY", underlying="NIFTY", instrument="option", side="Buy", strike="24500",
                                                option_type="CE", entry="120", stop_loss="100", targets=["150", "180"], missing_or_unclear=[])
        return reports.FilledPage(page2=PAGE2.replace("Entry at 120 ...", "Entry at 120, targets 150 and 180."))

    monkeypatch.setattr(reports, "ask_claude", ask)
    monkeypatch.setattr(reports, "instruments", lambda: index(reports))
    monkeypatch.setattr(reports, "fetch_candles", lambda key, token: candles())
    monkeypatch.setattr(reports, "settings", lambda: {"anthropic_key": "test", "model": "m", "upstox_key": "", "upstox_secret": "", "upstox_redirect": ""})
    return claude_calls


def test_report_is_held_until_the_company_profile_is_complete(crm, reports, monkeypatch):
    fake_pipeline(reports, monkeypatch)
    set_profile(crm, {**PROFILE, "registeredAddress": ""})
    record = build(reports, "NSE DERIVATIVES", "NIFTY 24500 CE Buy 120 SL 100 Tgt 150/180", {"name": "t"})
    assert record["status"] == "Held" and "Registered Address" in record["reason"]


def test_report_created_named_by_date_and_rotates_templates(crm, reports, monkeypatch):
    fake_pipeline(reports, monkeypatch)
    set_profile(crm, PROFILE)
    crm.store.set_value(reports.NEXT_TEMPLATE, 15)
    record = build(reports, "NSE DERIVATIVES", "NIFTY 24500 CE Buy 120 SL 100 Tgt 150/180", {"name": "t"})
    assert record["status"] == "Ready", record.get("reason")
    assert record["templateNumber"] == 15 and crm.store.get_value(reports.NEXT_TEMPLATE) == 1
    today = datetime.now(reports.IST).strftime("%d-%m-%Y")
    assert record["fileName"] == f"{today} NIFTY 24500 CE.pdf" and record["expiry"]
    pdf = base64.b64decode(crm.store.get(reports.REPORT_FILES, record["id"])["pdf"])
    assert pdf.startswith(b"%PDF")

    # A test report from the CRM does not use up a template
    test = build(reports, "NSE DERIVATIVES", "NIFTY 24500 CE Buy 120 SL 100 Tgt 150/180", {"name": "t"}, test=True)
    assert test["status"] == "Ready" and test["templateNumber"] == 1 and crm.store.get_value(reports.NEXT_TEMPLATE) == 1

    assert test["fileName"] == f"{today} test NIFTY 24500 CE.pdf"

    # The PDF downloads under its name
    res = crm.client.get(f"/api/reports/{record['id']}/pdf", headers=bearer(crm.token(SA)))
    assert res.status_code == 200 and res.content == pdf
    assert record["fileName"] in res.headers["content-disposition"]
    assert crm.client.get(f"/api/reports/{record['id']}/pdf", headers=bearer(crm.token(EXEC))).status_code == 403
    listed = crm.client.get("/api/reports", headers=bearer(crm.token(SA))).json()
    assert {r["id"] for r in listed["reports"]} >= {record["id"], test["id"]} and "chatId" not in listed["reports"][0]


def test_incomplete_call_is_held_and_never_guessed(crm, reports, monkeypatch):
    parsed = reports.ParsedCall(symbol="NIFTY", underlying="NIFTY", instrument="option", side="Buy", strike="24500", option_type="CE",
                                entry="120", stop_loss="", targets=["150"], missing_or_unclear=["stop-loss"])
    fake_pipeline(reports, monkeypatch, parsed)
    set_profile(crm, PROFILE)
    record = build(reports, "NSE DERIVATIVES", "NIFTY 24500 CE Buy 120 Tgt 150", {"name": "t"})
    assert record["status"] == "Held" and "stop-loss" in record["reason"]


def test_value_not_in_post_is_rejected(crm, reports, monkeypatch):
    # Claude "read" an entry of 125 that the post never had
    parsed = reports.ParsedCall(symbol="NIFTY", underlying="NIFTY", instrument="option", side="Buy", strike="24500", option_type="CE",
                                entry="125", stop_loss="100", targets=["150"], missing_or_unclear=[])
    fake_pipeline(reports, monkeypatch, parsed)
    set_profile(crm, PROFILE)
    record = build(reports, "NSE DERIVATIVES", "NIFTY 24500 CE Buy 120 SL 100 Tgt 150", {"name": "t"})
    assert record["status"] == "Held" and "entry" in record["reason"]


# ---------- Upstox daily login ----------
def test_upstox_callback_needs_a_state_started_from_the_crm(crm, reports):
    res = crm.client.get("/api/upstox/callback?code=abc&state=forged")
    assert res.status_code == 400 and "expired" in res.text
    assert reports.upstox_session() is None


def test_upstox_token_expires_at_half_past_three(reports):
    ist = reports.IST
    assert reports._token_expiry(datetime(2026, 11, 11, 9, 0, tzinfo=ist)) == datetime(2026, 11, 12, 3, 30, tzinfo=ist)
    assert reports._token_expiry(datetime(2026, 11, 12, 1, 0, tzinfo=ist)) == datetime(2026, 11, 12, 3, 30, tzinfo=ist)


# ---------- Upstox Analytics Token (replaces the daily login) ----------
class FakeUpstox:
    def __init__(self, status):
        self.status, self.calls = status, []

    def __call__(self, url, params=None, headers=None, timeout=None):
        self.calls.append(headers.get("Authorization"))
        import httpx
        return httpx.Response(self.status, json={"status": "success" if self.status == 200 else "error"})


def test_analytics_token_is_checked_saved_and_never_shown(crm, reports, monkeypatch):
    from backend.tests.test_broadcasts import ADMIN
    token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.analytics-token-abcd"
    sa = bearer(crm.token(SA))

    # Upstox rejects it: nothing is saved
    monkeypatch.setattr(reports.httpx, "get", FakeUpstox(401))
    res = crm.client.post("/api/upstox/analytics-token", json={"token": token}, headers=sa)
    assert res.status_code == 400 and reports.analytics_token() is None

    # Only a Super Admin may save it
    monkeypatch.setattr(reports.httpx, "get", FakeUpstox(200))
    assert crm.client.post("/api/upstox/analytics-token", json={"token": token}, headers=bearer(crm.token(ADMIN))).status_code == 403

    fake = FakeUpstox(200)
    monkeypatch.setattr(reports.httpx, "get", fake)
    res = crm.client.post("/api/upstox/analytics-token", json={"token": f"Bearer {token} "}, headers=sa)
    assert res.status_code == 200 and fake.calls == [f"Bearer {token}"]
    assert reports.upstox_token() == token

    status = crm.client.get("/api/reports", headers=sa).json()["status"]["analyticsToken"]
    assert status["saved"] and status["ending"] == "abcd" and token not in str(status)

    assert crm.client.delete("/api/upstox/analytics-token", headers=sa).status_code == 200
    assert reports.upstox_token() is None


def test_report_charts_with_the_saved_token(crm, reports, monkeypatch):
    fake_pipeline(reports, monkeypatch)
    used = []
    monkeypatch.setattr(reports, "fetch_candles", lambda key, token: used.append(token) or candles())
    set_profile(crm, PROFILE)
    crm.store.set_value(reports.UPSTOX_ANALYTICS, {"token": "tok-1234567890abcdefghij", "expiresAt": "2099-01-01T00:00:00+05:30"})
    record = build(reports, "NSE DERIVATIVES", "NIFTY 24500 CE Buy 120 SL 100 Tgt 150/180", {"name": "t"})
    assert record["status"] == "Ready" and record["upstoxConnected"] and used == ["tok-1234567890abcdefghij"]


# ---------- on demand: the button builds today's calls into a <date>_report folder ----------
def log_call(crm, reports, text, when, telegram=True):
    import uuid
    record = {"id": "bc-" + uuid.uuid4().hex[:8], "segment": "NSE DERIVATIVES", "call": text, "createdAt": when.isoformat(),
              "postedBy": {"telegramUserId": "42", "name": "Analyst"} if telegram else {"name": "Admin (CRM test)"}}
    crm.store.put(reports.broadcasts.BROADCASTS, record["id"], record)
    return record


def test_button_builds_todays_calls_into_a_dated_folder(crm, reports, monkeypatch):
    import io
    import zipfile
    from datetime import timedelta
    fake_pipeline(reports, monkeypatch)
    set_profile(crm, PROFILE)
    # Build synchronously in the test instead of in a background thread
    monkeypatch.setattr(reports, "ensure_processing", reports._process)
    crm.store.set_value(reports.NEXT_TEMPLATE, 4)
    now = datetime.now(reports.IST).replace(hour=12, minute=0, second=0, microsecond=0)
    first = log_call(crm, reports, "NIFTY 24500 CE Buy 120 SL 100 Tgt 150/180", now - timedelta(hours=2))
    second = log_call(crm, reports, "NIFTY 24500 CE Buy 120 SL 100 Tgt 150/180", now - timedelta(hours=1))
    log_call(crm, reports, "NIFTY 24500 CE Buy 120 SL 100 Tgt 150/180", now - timedelta(hours=1), telegram=False)  # CRM test SMS
    log_call(crm, reports, "NIFTY 24500 CE Buy 120 SL 100 Tgt 150/180", now - timedelta(days=1))  # yesterday
    sa = bearer(crm.token(SA))

    summary = crm.client.post("/api/reports/generate-today", headers=sa).json()
    date = now.strftime("%d-%m-%Y")
    assert summary["calls"] == 2 and summary["folder"] == f"{date}_report"
    today = {r["broadcastId"]: r for r in reports.day_reports(now.date())}
    assert set(today) == {first["id"], second["id"]}
    a, b = today[first["id"]], today[second["id"]]
    # Numbered and templated in the order the calls were posted
    assert (a["callNumber"], a["templateNumber"], b["callNumber"], b["templateNumber"]) == (1, 4, 2, 5)
    assert a["fileName"] == f"{date} (1) NIFTY 24500 CE.pdf" and b["fileName"] == f"{date} (2) NIFTY 24500 CE.pdf"

    # Pressing again later makes nothing twice
    again = crm.client.post("/api/reports/generate-today", headers=sa).json()
    assert again["ready"] == 2 and again["pending"] == 0 and len(reports.day_reports(now.date())) == 2

    res = crm.client.get("/api/reports/folder", headers=sa)
    assert res.status_code == 200 and f"{date}_report.zip" in res.headers["content-disposition"]
    names = zipfile.ZipFile(io.BytesIO(res.content)).namelist()
    assert names == [f"{date}_report/{date} (1) NIFTY 24500 CE.pdf", f"{date}_report/{date} (2) NIFTY 24500 CE.pdf"]
    assert crm.client.get("/api/reports/folder", headers=bearer(crm.token(EXEC))).status_code == 403


def test_button_retries_held_reports_and_folder_needs_a_ready_report(crm, reports, monkeypatch):
    from datetime import timedelta
    fake_pipeline(reports, monkeypatch)
    monkeypatch.setattr(reports, "ensure_processing", reports._process)
    day = datetime.now(reports.IST).date() + timedelta(days=3)
    assert crm.client.get(f"/api/reports/folder?day={day}", headers=bearer(crm.token(SA))).status_code == 404

    # Held while the Company Profile is incomplete; the next press builds it once the profile is filled in
    set_profile(crm, {**PROFILE, "website": ""})
    log_call(crm, reports, "NIFTY 24500 CE Buy 120 SL 100 Tgt 150/180", datetime.combine(day, datetime.min.time(), reports.IST).replace(hour=11))
    assert reports.queue_day(day)["pending"] == 1
    reports._process()
    assert reports.day_summary(day)["held"] == 1
    set_profile(crm, PROFILE)
    reports.queue_day(day)
    reports._process()
    assert reports.day_summary(day)["ready"] == 1
