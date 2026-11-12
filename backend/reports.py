"""Research Reports: every trade call posted in a Telegram bot becomes a 3-page PDF.

Page 1 is a cover with the 1-minute chart of the underlying (Upstox), page 2 the technical rationale
(the next of the 15 templates, filled by Claude), page 3 the fixed disclosures. Company details come
from the CRM's Company Profile, the call itself from Telegram, the expiry from Upstox.

Claude reads the post and fills the template; the CRM does the rest (numbers, chart, template order,
PDF) and checks Claude's text before it goes into the PDF. A report is never created half-done: if a
detail is missing or a connection fails it is held, the sender is told in Telegram, and the team can
press Retry in the CRM once the problem is fixed.
"""
import base64
import gzip
import json
import logging
import os
import re
import secrets
import threading
import time
import urllib.parse
import uuid
import zipfile
from datetime import datetime, timedelta, timezone
from io import BytesIO
from typing import List, Literal, Optional
from xml.sax.saxutils import escape

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel, Field

try:
    from backend import store, broadcasts
    from backend.auth import require_roles, ADMIN_ROLES
except ImportError:
    import store
    import broadcasts
    from auth import require_roles, ADMIN_ROLES

log = logging.getLogger("reports")
router = APIRouter(tags=["reports"])

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_PATH = os.path.join(BACKEND_DIR, "report_templates.json")
IST = broadcasts.IST

# Database names (see store.py)
REPORTS = "researchReports"          # one record per call: status, details, reason when held
REPORT_FILES = "researchReportFiles"  # the PDF of each Ready report, base64, kept apart so lists stay small
NEXT_TEMPLATE = "reportNextTemplate"  # 1..15, advanced only when a report is created
UPSTOX_SESSION = "upstoxSession"
UPSTOX_ANALYTICS = "upstoxAnalyticsToken"
ANALYTICS_TOKEN_DAYS = 365
UPSTOX_LOGIN_STATES = "upstoxLoginStates"

ENV_KEYS = ("ANTHROPIC_API_KEY", "REPORT_CLAUDE_MODEL", "UPSTOX_API_KEY", "UPSTOX_API_SECRET", "UPSTOX_REDIRECT_URI")
DEFAULT_MODEL = "claude-opus-5-5"
UPSTOX_API = "https://api.upstox.com"
UPSTOX_INSTRUMENTS = "https://assets.upstox.com/market-quote/instruments/exchange/{}.json.gz"
TEMPLATE_COUNT = 15
MAX_LISTED_REPORTS = 300

# Company Profile fields the report needs; the Investor Charter link is printed when set
PROFILE_REQUIRED = (("companyName", "Company Name"), ("sebiRegistrationNumber", "SEBI Registration Number"),
                    ("registeredAddress", "Registered Address"), ("contact", "Contact"), ("email", "Email"),
                    ("website", "Website"))

STATUS_QUEUED, STATUS_WORKING, STATUS_READY, STATUS_HELD = "Queued", "Generating", "Ready", "Held"


class ReportHeld(Exception):
    """A reason the report cannot be created right now; shown to the team as is."""


# ==========================================
# Configuration
# ==========================================
def settings() -> dict:
    env = broadcasts._load_env()
    for key in ENV_KEYS:
        if os.environ.get(key):
            env[key] = os.environ[key]
    return {
        "anthropic_key": env.get("ANTHROPIC_API_KEY", ""),
        "model": env.get("REPORT_CLAUDE_MODEL") or DEFAULT_MODEL,
        "upstox_key": env.get("UPSTOX_API_KEY", ""),
        "upstox_secret": env.get("UPSTOX_API_SECRET", ""),
        "upstox_redirect": env.get("UPSTOX_REDIRECT_URI", ""),
    }


def company_profile() -> dict:
    """The Company Profile block: a key/value collection, one record per field."""
    return {doc["id"]: doc.get("value") for doc in store.all("companyProfile")}


def profile_missing(profile: dict) -> List[str]:
    return [label for key, label in PROFILE_REQUIRED if not str(profile.get(key) or "").strip()]


def load_templates() -> List[dict]:
    with open(TEMPLATES_PATH, encoding="utf-8") as f:
        return json.load(f)


def now_ist() -> datetime:
    return datetime.now(IST)


def show_date(day) -> str:
    """11 Nov 2026"""
    return f"{day.day} {day:%b %Y}"


# ==========================================
# Numbers: the CRM's own calculation, and the check on Claude's text
# ==========================================
NUMBER = re.compile(r"\d[\d,]*(?:\.\d+)?|\.\d+")


def to_number(text) -> Optional[float]:
    try:
        return float(str(text).replace(",", "").strip())
    except (TypeError, ValueError):
        return None


def fmt(value: float) -> str:
    """120.0 -> "120", 12.50 -> "12.5"."""
    text = f"{value:.2f}".rstrip("0").rstrip(".")
    return text if text != "-0" else "0"


def numbers_in(text: str) -> set:
    found = set()
    for raw in NUMBER.findall(text or ""):
        value = to_number(raw.strip(",").rstrip("."))
        if value is not None:
            found.add(fmt(value))
    return found


def trade_math(side: str, entry: str, stop_loss: str, targets: List[str]) -> dict:
    """Risk, gains and risk-reward, in the call's own units (option premium for options)."""
    e, sl = to_number(entry), to_number(stop_loss)
    ts = [to_number(t) for t in targets]
    if e is None or sl is None or any(t is None for t in ts):
        raise ReportHeld("Entry, stop-loss and targets must be plain numbers.")
    buy = side.strip().lower() == "buy"
    risk = (e - sl) if buy else (sl - e)
    if risk <= 0:
        raise ReportHeld(f"The stop-loss {stop_loss} is on the wrong side of the entry {entry} for a {side} call.")
    gains = [(t - e) if buy else (e - t) for t in ts]
    if any(g <= 0 for g in gains):
        raise ReportHeld(f"A target is on the wrong side of the entry {entry} for a {side} call.")
    return {"risk": fmt(risk), "gains": [fmt(g) for g in gains], "rr": [f"1:{fmt(round(g / risk, 2))}" for g in gains]}


# Pattern -> the word as shown to the team
BANNED = {r"sure[\s-]*shot": "sure-shot", r"guaranteed": "guaranteed", r"assured\s+returns?": "assured returns",
          r"risk[\s-]*free": "risk-free"}


def check_page2(text: str, template: str, values: dict, must_contain: List[str]) -> List[str]:
    """Problems with Claude's page 2 text; empty when it can go into the PDF."""
    problems = []
    if not text.strip():
        return ["The text is empty."]
    if "{" in text or "}" in text:
        problems.append("A {placeholder} was left unfilled.")
    allowed = numbers_in(template) | numbers_in(" ".join(str(v) for v in values.values()))
    extra = sorted(numbers_in(text) - allowed)
    if extra:
        problems.append(f"It contains numbers that are not in the call or the template: {', '.join(extra)}.")
    # Template 10 itself says "not guaranteed to hold", so only words beyond the template's own count
    for pattern, word in BANNED.items():
        if len(re.findall(pattern, text, re.I)) > len(re.findall(pattern, template, re.I)):
            problems.append(f"It uses the banned word '{word}'.")
    lowered = text.lower()
    for item in must_contain:
        if item and item.lower() not in lowered:
            problems.append(f"'{item}' from the call does not appear in it.")
    return problems


# ==========================================
# Claude
# ==========================================
class ParsedCall(BaseModel):
    symbol: str = Field(description="The symbol (script) exactly as written in the post, e.g. NIFTY, BANKNIFTY, RELIANCE, GOLD.")
    underlying: str = Field(description="The exchange trading symbol of the underlying, in capitals with no spaces, e.g. NIFTY, BANKNIFTY, FINNIFTY, MIDCPNIFTY, SENSEX, BANKEX, RELIANCE, TCS, GOLD, GOLDM, SILVER, CRUDEOIL, NATURALGAS.")
    instrument: Literal["option", "future", "equity"] = Field(description="option when the call names CE/PE, future when it says FUT/futures, equity for a cash-market stock call.")
    side: str = Field(description="The word Buy or Sell exactly as written in the post; empty when the post does not say.")
    strike: Optional[str] = Field(description="Option strike exactly as written; null for futures and equity.")
    option_type: Optional[Literal["CE", "PE"]] = Field(description="CE or PE for options; null otherwise.")
    entry: str = Field(description="Entry price exactly as written; empty when not given.")
    stop_loss: str = Field(description="Stop-loss exactly as written; empty when not given.")
    targets: List[str] = Field(description="Each target exactly as written, in the order posted.")
    missing_or_unclear: List[str] = Field(description="Every detail that is missing or unclear, in a few words each. Empty only when the call is complete and unambiguous.")


class FilledPage(BaseModel):
    page2: str = Field(description="The filled template text.")


PARSE_SYSTEM = """You read trade calls that a SEBI-registered research analyst's team posts in Telegram, and return the call's details exactly as written.

Rules:
- Never guess, infer, round or correct a value. Copy every number exactly as it appears in the post.
- A complete call has: symbol, Buy or Sell, entry, stop-loss and at least one target; options also need a strike and CE or PE.
- The expiry is never part of the call: the CRM takes the nearest expiry from the exchange. Never list the expiry as missing.
- Entry, stop-loss and each target must be a single number. A range (e.g. 120-125), several entries, or a level written in words is unclear.
- Anything missing or ambiguous goes in missing_or_unclear. Do not fill a missing value from context.
- Text such as a company name, SEBI registration number, website or alert heading is not part of the call."""

FILL_SYSTEM = """You write page 2 (Technical Rationale) of a SEBI research analyst's report by filling one fixed template with the details of a trade call.

Rules:
- Keep the template's wording, sentence order and paragraph breaks. Keep the ** markers around the heading and around "Rationale for records:".
- Replace every {placeholder} with the value given. For every {a/b} choice, write the first option when the direction is bullish and the second when it is bearish, without the braces.
- Use only the values given. Do not add any price, level, indicator reading, number, date, news or fundamental claim that is not already in the template or the values.
- Never write sure-shot, guaranteed, assured returns, risk-free or similar promises unless the template's own wording already has them.
- Never change the call. Symbol, side, strike, CE/PE, expiry, entry, stop-loss and targets appear exactly as given.
- When only one target is given, remove what refers to a second target (Target 2, its gain and its risk-reward) and fix the grammar, e.g. "Target at 150 offers a potential gain of 30 points, a risk-reward of about 1:1.5".
- For a Sell call the view is invalidated when the price or premium rises to the stop-loss, so write "rises to" where the template says "falls to".
- When the instrument is a future or equity instead of an option, change only the option-specific wording (strike, CE/PE, premium, time decay, implied volatility, expiring worthless) so that it is accurate for that instrument. Where there is no expiry (equity), leave out the expiry mentions. Keep everything else.
Return only the filled text in page2."""


def _client(cfg: dict):
    import anthropic
    if not cfg["anthropic_key"]:
        raise ReportHeld("ANTHROPIC_API_KEY is not set in backend/.env.")
    return anthropic.Anthropic(api_key=cfg["anthropic_key"], timeout=180, max_retries=2)


def ask_claude(cfg: dict, system: str, prompt: str, schema, effort: str):
    """One structured request. Any API problem becomes a held report with a readable reason."""
    import anthropic
    client = _client(cfg)
    try:
        response = client.beta.messages.parse(
            model=cfg["model"],
            max_tokens=16000,
            system=system,
            messages=[{"role": "user", "content": prompt}],
            output_format=schema,
            output_config={"effort": effort},
            # If a safety classifier declines, the API re-runs the request on a fallback model
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
    except anthropic.AuthenticationError:
        raise ReportHeld("Claude rejected the API key (ANTHROPIC_API_KEY in backend/.env).")
    except anthropic.PermissionDeniedError:
        raise ReportHeld("Claude refused the request: the API key lacks permission or the credit has run out.")
    except anthropic.RateLimitError:
        raise ReportHeld("Claude is rate-limiting requests right now. Retry in a minute.")
    except anthropic.BadRequestError as err:
        message = str(getattr(err, "message", err))
        if "credit" in message.lower() or "billing" in message.lower():
            raise ReportHeld("The Claude account is out of credit. Add credit in the Anthropic Console.")
        raise ReportHeld(f"Claude rejected the request: {message[:200]}")
    except anthropic.APIStatusError as err:
        raise ReportHeld(f"Claude is unavailable (HTTP {err.status_code}). Retry later.")
    except anthropic.APIConnectionError:
        raise ReportHeld("Could not reach Claude (network error). Retry later.")
    if response.stop_reason == "refusal":
        raise ReportHeld("Claude declined to write this report.")
    if response.stop_reason == "max_tokens" or response.parsed_output is None:
        raise ReportHeld("Claude's answer was incomplete. Retry.")
    return response.parsed_output


def parse_call(cfg: dict, text: str) -> dict:
    parsed: ParsedCall = ask_claude(cfg, PARSE_SYSTEM, f"Telegram post:\n<post>\n{text}\n</post>", ParsedCall, "low")
    # The expiry comes from Upstox, so it is never a reason to hold the call
    problems = [p for p in parsed.missing_or_unclear if "expir" not in p.lower()]

    def require(ok: bool, label: str, word: str) -> None:
        if not ok and not any(word in p.lower() for p in problems):
            problems.append(label)

    require(parsed.side.strip().lower() in ("buy", "sell"), "Buy or Sell", "buy")
    require(bool(parsed.entry.strip()), "entry", "entry")
    require(bool(parsed.stop_loss.strip()), "stop-loss", "stop")
    require(bool(parsed.targets), "target", "target")
    require(parsed.instrument != "option" or bool(parsed.strike and parsed.option_type), "strike and CE/PE", "strike")
    if problems:
        raise ReportHeld("The call is missing or unclear: " + "; ".join(dict.fromkeys(problems)) + ". Post the call again with these details.")

    # Every value must be in the post itself: Claude reads, it never supplies a number
    posted = numbers_in(text)
    for label, value in (("entry", parsed.entry), ("stop-loss", parsed.stop_loss), ("strike", parsed.strike),
                         *(("target", t) for t in parsed.targets)):
        if value is not None and (to_number(value) is None or fmt(to_number(value)) not in posted):
            raise ReportHeld(f"Could not read the {label} from the post reliably ({value}). Post the call again.")
    lowered = text.lower()
    if parsed.symbol.lower() not in lowered or parsed.side.lower() not in lowered:
        raise ReportHeld("Could not read the symbol or Buy/Sell from the post reliably. Post the call again.")
    side_at = lowered.find(parsed.side.lower())
    return {
        "symbol": parsed.symbol.strip(),
        "underlying": re.sub(r"\s+", "", parsed.underlying).upper(),
        "instrument": parsed.instrument,
        # The word as posted in Telegram (Buy / BUY / Sell ...)
        "side": text[side_at:side_at + len(parsed.side)],
        "strike": (parsed.strike or "").strip() or None,
        "optionType": parsed.option_type,
        "entry": parsed.entry.strip(),
        "stopLoss": parsed.stop_loss.strip(),
        "targets": [t.strip() for t in parsed.targets],
    }


def fill_template(cfg: dict, template: dict, call: dict, math: dict, expiry: Optional[str]) -> str:
    bullish = (call["side"].lower() == "buy") != (call.get("optionType") == "PE")
    values = {"symbol": call["symbol"], "call": call["side"], "strike": call.get("strike") or "",
              "CE/PE": call.get("optionType") or "", "expiry": expiry or "", "entry": call["entry"],
              "sl": call["stopLoss"], "risk": math["risk"]}
    for i, target in enumerate(call["targets"], start=1):
        values[f"t{i}"], values[f"gain{i}"], values[f"rr{i}"] = target, math["gains"][i - 1], math["rr"][i - 1]
    prompt = (f"Template {template['number']} ({template['name']}):\n<template>\n{template['text']}\n</template>\n\n"
              f"Instrument: {call['instrument']}\nDirection: {'bullish' if bullish else 'bearish'}\n"
              f"Number of targets: {len(call['targets'])}\n"
              f"Values:\n{json.dumps(values, indent=2, ensure_ascii=False)}")
    must = [call["symbol"], call["side"], call["entry"], call["stopLoss"], *call["targets"]]
    if call.get("strike"):
        must.append(call["strike"])
    problems: List[str] = []
    for _ in range(2):
        text = ask_claude(cfg, FILL_SYSTEM, prompt, FilledPage, "medium").page2.strip()
        problems = check_page2(text, template["text"], values, must)
        if not problems:
            return text
        prompt += "\n\nYour previous text failed these checks; write it again without them:\n- " + "\n- ".join(problems)
    raise ReportHeld("Claude's page 2 text failed the checks twice: " + " ".join(problems))


# ==========================================
# Upstox: login, instruments, candles
# ==========================================
def upstox_session() -> Optional[dict]:
    """Today's Upstox login, or None. Upstox tokens end at 3:30 AM IST the next day."""
    session = store.get_value(UPSTOX_SESSION)
    if not session or not session.get("accessToken"):
        return None
    try:
        if datetime.fromisoformat(session["expiresAt"]) <= now_ist():
            return None
    except (KeyError, ValueError):
        return None
    return session


def analytics_token() -> Optional[dict]:
    """The Upstox Analytics Token a Super Admin pasted into the CRM: read-only, valid for one year, so no
    daily login is needed (the daily login needs an https Redirect URL, which this server does not have)."""
    saved = store.get_value(UPSTOX_ANALYTICS)
    if not saved or not saved.get("token"):
        return None
    try:
        if datetime.fromisoformat(saved["expiresAt"]) <= now_ist():
            return None
    except (KeyError, ValueError):
        return None
    return saved


def upstox_token() -> Optional[str]:
    """The token for Upstox requests: the Analytics Token, else today's login, else none (public data)."""
    saved, session = analytics_token(), upstox_session()
    return (saved or {}).get("token") or (session or {}).get("accessToken")


def _token_expiry(at: datetime) -> datetime:
    cutoff = at.replace(hour=3, minute=30, second=0, microsecond=0)
    return cutoff if at < cutoff else cutoff + timedelta(days=1)


_instruments: dict = {"day": None, "index": None}
_instruments_lock = threading.Lock()


def _build_index(files: dict) -> dict:
    """The few facts the report needs from Upstox's instrument lists, keyed by underlying symbol."""
    deriv, equity, indices = {}, {}, {}
    for rows in files.values():
        for row in rows:
            seg, kind = row.get("segment"), row.get("instrument_type")
            if seg in ("NSE_FO", "BSE_FO", "MCX_FO") and row.get("expiry"):
                d = deriv.setdefault((seg, row.get("underlying_symbol")), {"opt": set(), "fut": [], "underlying": row.get("underlying_key")})
                if kind in ("CE", "PE"):
                    d["opt"].add(row["expiry"])
                elif kind == "FUT":
                    d["fut"].append((row["expiry"], row["instrument_key"], row.get("trading_symbol") or row.get("name")))
            elif seg in ("NSE_EQ", "BSE_EQ") and row.get("trading_symbol"):
                current = equity.get((seg, row["trading_symbol"]))
                if current is None or kind in ("EQ", "A", "B"):
                    equity[(seg, row["trading_symbol"])] = row["instrument_key"]
            elif seg in ("NSE_INDEX", "BSE_INDEX") and row.get("trading_symbol"):
                indices[row["instrument_key"]] = row.get("name") or row["trading_symbol"]
    return {"deriv": deriv, "equity": equity, "indices": indices}


def instruments() -> dict:
    """Downloaded once a day (public files, no login needed)."""
    today = now_ist().date()
    with _instruments_lock:
        if _instruments["day"] != today:
            files = {}
            for exchange in ("NSE", "BSE", "MCX"):
                try:
                    res = httpx.get(UPSTOX_INSTRUMENTS.format(exchange), timeout=60)
                    res.raise_for_status()
                    files[exchange] = json.loads(gzip.decompress(res.content))
                except (httpx.HTTPError, ValueError, OSError):
                    raise ReportHeld(f"Could not download the Upstox {exchange} instrument list. Retry later.")
            _instruments["index"] = _build_index(files)
            _instruments["day"] = today
            del files
        return _instruments["index"]


def _segment_order(segment: str) -> List[str]:
    name = segment.upper()
    if "MCX" in name:
        return ["MCX_FO", "NSE_FO", "BSE_FO"]
    if "BSE" in name and "EQUITY" not in name:
        return ["BSE_FO", "NSE_FO", "MCX_FO"]
    return ["NSE_FO", "BSE_FO", "MCX_FO"]


def resolve_instrument(index: dict, call: dict, segment: str, at: Optional[datetime] = None) -> dict:
    """The chart's instrument and, for options and futures, the nearest expiry from now."""
    at = at or now_ist()
    now_ms = at.timestamp() * 1000
    symbol = call["underlying"]
    if call["instrument"] == "equity":
        for seg in ("NSE_EQ", "BSE_EQ"):
            key = index["equity"].get((seg, symbol))
            if key:
                return {"chartKey": key, "chartLabel": symbol, "expiry": None}
        raise ReportHeld(f"{call['symbol']} was not found on NSE or BSE in Upstox.")

    for seg in _segment_order(segment):
        d = index["deriv"].get((seg, symbol))
        if not d:
            continue
        futures = sorted(f for f in d["fut"] if f[0] >= now_ms)
        expiries = sorted(e for e in d["opt"] if e >= now_ms) if call["instrument"] == "option" else [f[0] for f in futures]
        if not expiries:
            continue
        if seg == "MCX_FO":
            # Commodities are charted on the current-month futures contract
            if not futures:
                continue
            chart_key, chart_label = futures[0][1], futures[0][2]
        else:
            chart_key = d["underlying"]
            chart_label = index["indices"].get(chart_key, symbol)
        expiry = datetime.fromtimestamp(expiries[0] / 1000, IST)
        return {"chartKey": chart_key, "chartLabel": chart_label, "expiry": show_date(expiry)}
    raise ReportHeld(f"No live {call['instrument']} contracts for {call['symbol']} were found in Upstox.")


def _upstox_get(path: str, token: Optional[str]) -> dict:
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        res = httpx.get(UPSTOX_API + path, headers=headers, timeout=30)
    except httpx.HTTPError:
        raise ReportHeld("Upstox is unreachable. Retry later.")
    if res.status_code == 401:
        raise ReportHeld("Upstox refused the request: log in to Upstox again in the CRM (Research Reports).")
    try:
        body = res.json()
    except ValueError:
        body = {}
    if res.status_code != 200 or body.get("status") != "success":
        errors = body.get("errors") or [{}]
        raise ReportHeld(f"Upstox error ({res.status_code}): {errors[0].get('message') or 'no details'}.")
    return body.get("data") or {}


def fetch_candles(chart_key: str, token: Optional[str], at: Optional[datetime] = None) -> dict:
    """Today's 1-minute candles, or the last trading day's when today has none yet."""
    at = at or now_ist()
    key = urllib.parse.quote(chart_key, safe="")
    candles = _upstox_get(f"/v3/historical-candle/intraday/{key}/minutes/1", token).get("candles") or []
    if not candles:
        to_day, from_day = (at - timedelta(days=1)).date(), (at - timedelta(days=10)).date()
        candles = _upstox_get(f"/v3/historical-candle/{key}/minutes/1/{to_day}/{from_day}", token).get("candles") or []
        if candles:
            last_day = max(c[0][:10] for c in candles)
            candles = [c for c in candles if c[0].startswith(last_day)]
    if not candles:
        raise ReportHeld("Upstox returned no 1-minute data for the chart.")
    rows = sorted((c[0], float(c[1]), float(c[2]), float(c[3]), float(c[4])) for c in candles)
    day = datetime.fromisoformat(rows[0][0]).date()
    return {"day": day.isoformat(), "dayLabel": show_date(day), "lastTradingDay": day != at.date(), "candles": rows}


# ==========================================
# PDF
# ==========================================
OPTION_RISKS = (
    "<b>Time Decay (Theta):</b> As a [BUYER] of a [CE/PE] option, the value of your position will erode over time, especially as "
    "the expiry date [EXPIRY] approaches. The trade is unprofitable if [SYMBOL] does not move favorably before expiry. "
    "<b>Volatility Risk:</b> A sudden decrease in Implied Volatility (IV crush) can lead to a drop in the option's premium, even "
    "if the underlying price remains stable or moves slightly in your favor. <b>Market Risk:</b> Unexpected adverse market news "
    "or events could lead to a sharp reversal, potentially hitting the stop-loss of [STOP-LOSS] and resulting in a loss of the "
    "premium paid. <b>Leverage Risk:</b> F&amp;O trading involves high leverage. A small adverse move in [SYMBOL] can result in a "
    "significant percentage loss of capital invested in the premium.")
# Written for this CRM (the brief only gave the options paragraph); to be confirmed by compliance
FUTURE_RISKS = (
    "<b>Leverage Risk:</b> Futures trading involves high leverage. A small adverse move in [SYMBOL] can result in a significant "
    "loss, which can exceed the margin deposited. <b>Market Risk:</b> Unexpected adverse market news or events could lead to a "
    "sharp reversal, potentially hitting the stop-loss of [STOP-LOSS] and resulting in a loss. <b>Gap Risk:</b> Prices can open "
    "beyond the stop-loss after overnight or weekend news, so the actual loss can be larger than planned. <b>Expiry Risk:</b> "
    "The contract expires on [EXPIRY]; positions still open at expiry are settled, and rolling them over carries extra cost.")
EQUITY_RISKS = (
    "<b>Market Risk:</b> Unexpected adverse market news or events could lead to a sharp reversal, potentially hitting the "
    "stop-loss of [STOP-LOSS] and resulting in a loss. <b>Gap Risk:</b> The price of [SYMBOL] can open beyond the stop-loss "
    "after overnight or weekend news, so the actual loss can be larger than planned. <b>Liquidity Risk:</b> In thinly traded "
    "stocks, orders may be filled at prices away from the entry, target or stop-loss. <b>Concentration Risk:</b> Putting a large "
    "share of capital into a single stock increases the impact of an adverse move in [SYMBOL].")

DISCLOSURES = (
    ("1. Analyst Certification",
     "All views expressed in this research report reflect my personal and independent opinions about the underlying asset "
     "[SYMBOL]. No part of my compensation was, is, or will be, directly or indirectly related to any specific recommendation or "
     "views expressed in this report."),
    ("2. General Disclaimer",
     "This report has been prepared by [COMPANY NAME], a SEBI-registered Research Analyst, Registration No. [SEBI NO.]. This "
     "report is provided for information purposes only and shall not be construed as investment advice or a solicitation to "
     "buy/sell any derivatives. This report is generated with the assistance of artificial intelligence (AI) tools for analytical "
     "and drafting purposes. The information herein is obtained from publicly available sources believed to be reliable, but "
     "accuracy or completeness is not guaranteed. Investments in securities &amp; derivatives are subject to market risks, "
     "including a possible loss of principal. Past performance is not indicative of future performance. Readers should consult "
     "their independent financial adviser before making any investment decision. Neither [COMPANY NAME], nor its associates, nor "
     "its relatives, accept liability for any losses (direct, indirect, or consequential) arising out of the use of this report. "
     "The Investor Charter and other compliance documents can be viewed on our website: [WEBSITE]"),
    ("3. Conflict of Interest Disclosures",
     "The Research Analyst, relatives, or associates do not have any financial interest in the derivatives of [SYMBOL]. The "
     "Research Analyst, relatives, or associates do not hold 1% or more of the equity securities of the company behind the "
     "underlying asset [SYMBOL]. The Research Analyst, relatives, or associates do not have any material conflict of interest at "
     "the time of publication of this report. The Research Analyst has not served as an officer, director, or employee of the "
     "company behind [SYMBOL]."),
    ("4. Compensation Disclosures",
     "The Research Analyst/Entity/associates have not received any compensation from the company behind [SYMBOL] in the past 12 "
     "months. The Research Analyst/Entity has not managed or co-managed any public offering of securities for the company behind "
     "[SYMBOL] in the past 12 months. The Research Analyst/Entity/associates have not received compensation for any other services "
     "or products from the company behind [SYMBOL] in the past 12 months."),
    ("5. Client Relationship Disclosure",
     "The company behind the underlying asset, [SYMBOL], is not a client of the Research Analyst/Entity. The Research "
     "Analyst/Entity has not provided any investment banking, merchant banking, brokerage, or other services to the company "
     "behind the underlying asset, [SYMBOL], in the past 12 months."),
    ("6. Risk Disclaimer for Derivatives",
     "Derivatives are complex instruments and come with a high risk of losing money rapidly due to leverage. Trading in futures "
     "and options is speculative and involves a substantial risk of loss and is not suitable for all investors. Investors should "
     "assess their financial position, investment objectives, and risk tolerance before acting on any recommendation. Neither "
     "SEBI, nor stock exchanges, nor [COMPANY NAME] guarantee returns or performance of any derivative contract mentioned."),
)


def _fill(text: str, fields: dict) -> str:
    for key, value in fields.items():
        text = text.replace(f"[{key}]", escape(value or ""))
    return text


def _markdown(text: str) -> List[str]:
    """Paragraphs of Claude's page 2, with **bold** turned into reportlab markup."""
    paragraphs = []
    for block in re.split(r"\n\s*\n", text.strip()):
        html = escape(" ".join(block.split()))
        paragraphs.append(re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", html))
    return paragraphs


def build_pdf(profile: dict, call: dict, chart: dict, chart_label: str, expiry: Optional[str], page2: str, report_date: str) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import Flowable, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer

    ink, muted, accent, rule = colors.HexColor("#111827"), colors.HexColor("#4b5563"), colors.HexColor("#1e3a8a"), colors.HexColor("#d1d5db")
    body = ParagraphStyle("body", fontName="Helvetica", fontSize=10, leading=14.5, textColor=ink, spaceAfter=8)
    small = ParagraphStyle("small", parent=body, fontSize=8, leading=10.6, spaceAfter=3.2)
    heading = ParagraphStyle("heading", parent=body, fontName="Helvetica-Bold", fontSize=8.6, leading=11, spaceBefore=2.5, spaceAfter=1.2, textColor=accent)
    title = ParagraphStyle("title", parent=body, fontName="Helvetica-Bold", fontSize=19, leading=24, textColor=accent, spaceAfter=4)
    subtitle = ParagraphStyle("subtitle", parent=body, fontSize=10, textColor=muted, spaceAfter=14)
    contact = ParagraphStyle("contact", parent=body, fontSize=9, textColor=muted, alignment=TA_CENTER, spaceBefore=10)

    company = profile.get("companyName") or ""
    sebi = profile.get("sebiRegistrationNumber") or ""
    contact_line = escape(" | ".join(str(profile.get(k) or "") for k in ("companyName", "contact", "email", "website")))

    def frame(canvas, doc):
        width, height = A4
        canvas.saveState()
        canvas.setFillColor(accent)
        canvas.setFont("Helvetica-Bold", 12.5)
        canvas.drawString(18 * mm, height - 16 * mm, company)
        canvas.setFillColor(muted)
        canvas.setFont("Helvetica", 9)
        canvas.drawRightString(width - 18 * mm, height - 16 * mm, f"SEBI Registration No.: {sebi}")
        canvas.setStrokeColor(accent)
        canvas.setLineWidth(1.2)
        canvas.line(18 * mm, height - 19.5 * mm, width - 18 * mm, height - 19.5 * mm)
        canvas.setStrokeColor(rule)
        canvas.setLineWidth(0.5)
        canvas.line(18 * mm, 14 * mm, width - 18 * mm, 14 * mm)
        canvas.setFont("Helvetica", 7.5)
        canvas.drawString(18 * mm, 10 * mm, f"Report Date: {report_date}")
        canvas.drawRightString(width - 18 * mm, 10 * mm, f"Page {doc.page} of 3")
        canvas.restoreState()

    class Chart(Flowable):
        def __init__(self, width, height):
            super().__init__()
            self.width, self.height = width, height

        def wrap(self, aW, aH):
            return self.width, self.height

        def draw(self):
            c, rows = self.canv, chart["candles"]
            left, right, bottom, top = 4, self.width - 52, 22, self.height - 26
            low, high = min(r[3] for r in rows), max(r[2] for r in rows)
            pad = (high - low) * 0.06 or max(high * 0.002, 1)
            low, high = low - pad, high + pad

            def y(price):
                return bottom + (price - low) / (high - low) * (top - bottom)

            c.setFillColor(ink)
            c.setFont("Helvetica-Bold", 10)
            c.drawString(left, self.height - 12, f"{chart_label}  ·  1-minute candles")
            c.setFont("Helvetica", 8.5)
            c.setFillColor(muted)
            day_text = f"{chart['dayLabel']} (last trading day)" if chart["lastTradingDay"] else chart["dayLabel"]
            c.drawRightString(self.width, self.height - 12, day_text)
            c.setStrokeColor(rule)
            c.setLineWidth(0.6)
            c.rect(left, bottom, right - left, top - bottom)

            step = _nice_step((high - low) / 6)
            level = (low // step + 1) * step
            c.setFont("Helvetica", 7)
            while level < high:
                c.setStrokeColor(colors.HexColor("#eef0f3"))
                c.line(left, y(level), right, y(level))
                c.setFillColor(muted)
                c.drawString(right + 4, y(level) - 2.5, f"{level:,.2f}".rstrip("0").rstrip("."))
                level += step

            n = len(rows)
            slot = (right - left) / max(n, 1)
            body_w = max(slot * 0.62, 0.35)
            last_label = None
            for i, (stamp, o, h, l, cl) in enumerate(rows):
                x = left + slot * (i + 0.5)
                minute = stamp[11:16]
                if minute.endswith((":00", ":30")) and minute != last_label and (minute.endswith(":00") or n < 200):
                    c.setStrokeColor(colors.HexColor("#eef0f3"))
                    c.line(x, bottom, x, top)
                    c.setFillColor(muted)
                    c.drawCentredString(x, bottom - 10, minute)
                    last_label = minute
                colour = colors.HexColor("#15803d") if cl > o else colors.HexColor("#b91c1c") if cl < o else muted
                c.setStrokeColor(colour)
                c.setFillColor(colour)
                c.setLineWidth(max(min(slot * 0.18, 0.8), 0.25))
                c.line(x, y(l), x, y(h))
                c.rect(x - body_w / 2, min(y(o), y(cl)), body_w, max(abs(y(cl) - y(o)), 0.3), stroke=0, fill=1)

    out = BytesIO()
    doc = SimpleDocTemplate(out, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=26 * mm,
                            bottomMargin=20 * mm, title=f"Recommendation Report: {call['symbol']}", author=company)
    fields = {"COMPANY NAME": company, "SEBI NO.": sebi, "SYMBOL": call["symbol"], "WEBSITE": profile.get("website"),
              "CE/PE": call.get("optionType") or "", "EXPIRY": expiry or "", "STOP-LOSS": call["stopLoss"],
              # Buyer or seller, as the call was posted in Telegram
              "BUYER": "seller" if call["side"].strip().lower() == "sell" else "buyer"}

    summary = " ".join(x for x in (call["side"], call["symbol"], call.get("strike") or "", call.get("optionType") or "") if x)
    story = [
        Paragraph(f"Recommendation Report: {escape(call['symbol'])}", title),
        Paragraph(escape(summary + (f"  ·  Expiry {expiry}" if expiry else "") + f"  ·  {report_date}"), subtitle),
        Chart(doc.width, 118 * mm),
        Paragraph(contact_line, contact),
        PageBreak(),
        *[Paragraph(p, body) for p in _markdown(page2)],
        Paragraph(contact_line, contact),
        PageBreak(),
    ]
    info = [("Company name", company), ("SEBI Registration No.", sebi), ("Registered Address", profile.get("registeredAddress")),
            ("Contact", profile.get("contact")), ("Email", profile.get("email")), ("Website", profile.get("website"))]
    if profile.get("investorCharterUrl"):
        info.append(("Investor Charter", profile["investorCharterUrl"]))
    info += [("Report Date", report_date), ("Subject Underlying", call["symbol"])]
    story += [Paragraph(f"<b>{label}:</b> {escape(str(value or ''))}", small) for label, value in info]
    story.append(Spacer(1, 3))
    for head, text in DISCLOSURES:
        story.append(KeepTogether([Paragraph(head, heading), Paragraph(_fill(text, fields), small)]))
    risks = {"option": OPTION_RISKS, "future": FUTURE_RISKS}.get(call["instrument"], EQUITY_RISKS)
    story.append(KeepTogether([Paragraph("Potential Risks associated with this Trade", heading), Paragraph(_fill(risks, fields), small)]))

    doc.build(story, onFirstPage=frame, onLaterPages=frame)
    pdf = out.getvalue()
    pages = len(re.findall(rb"/Type\s*/Page[^s]", pdf))
    if pages != 3:
        raise ReportHeld(f"The report came out at {pages} pages instead of 3 (page 2 text too long?).")
    return pdf


def _nice_step(raw: float) -> float:
    if raw <= 0:
        return 1.0
    power = 10 ** int(f"{raw:e}".split("e")[1])
    for mult in (1, 2, 2.5, 5, 10):
        if raw <= mult * power:
            return mult * power
    return 10 * power


# ==========================================
# The report pipeline
# ==========================================
def generate(record: dict) -> dict:
    """Build the PDF for one call. Raises ReportHeld with the reason when it cannot be created."""
    cfg = settings()
    profile = company_profile()
    missing = profile_missing(profile)
    if missing:
        raise ReportHeld("The Company Profile in the CRM is missing: " + ", ".join(missing) + ".")
    if not cfg["anthropic_key"]:
        raise ReportHeld("ANTHROPIC_API_KEY is not set in backend/.env.")

    call = parse_call(cfg, record["call"])
    math = trade_math(call["side"], call["entry"], call["stopLoss"], call["targets"])
    target = resolve_instrument(instruments(), call, record.get("segment") or "")
    token = upstox_token()
    chart = fetch_candles(target["chartKey"], token)

    templates = load_templates()
    # A test report uses the next template too, but does not advance the rotation (see run)
    number = store.get_value(NEXT_TEMPLATE, 1)
    template = next((t for t in templates if t["number"] == number), templates[0])
    page2 = fill_template(cfg, template, call, math, target["expiry"])
    today = now_ist()
    pdf = build_pdf(profile, call, chart, target["chartLabel"], target["expiry"], page2, show_date(today))
    return {"call": call, "math": math, "target": target, "chartDay": chart["dayLabel"], "template": template,
            "page2": page2, "pdf": pdf, "reportDate": show_date(today), "upstoxConnected": bool(token)}


def file_label(details: Optional[dict]) -> str:
    """NIFTY 25200 CE, GOLD FUT, RELIANCE: the call as it appears in the PDF's name."""
    details = details or {}
    parts = [details.get("symbol") or "Report"]
    if details.get("instrument") == "option":
        parts += [details.get("strike") or "", details.get("optionType") or ""]
    elif details.get("instrument") == "future":
        parts.append("FUT")
    return re.sub(r'[\\/:*?"<>|]+', "-", " ".join(p for p in parts if p)).strip()


def name_date(day) -> str:
    """12-11-2026: the date in folder and file names."""
    return f"{day:%d-%m-%Y}"


def report_file_name(record: dict) -> str:
    made = datetime.fromisoformat(record.get("createdReportAt") or record["createdAt"]).astimezone(IST)
    number = f"({record['callNumber']}) " if record.get("callNumber") else ("test " if record.get("test") else "")
    return f"{name_date(made)} {number}{file_label(record.get('details'))}.pdf"


def run(report_id: str) -> Optional[dict]:
    """Build one claimed report (status Generating). Ready or Held afterwards, never half-done."""
    record = store.get(REPORTS, report_id)
    if not record or record.get("status") != STATUS_WORKING:
        return record
    try:
        result = generate(record)
    except ReportHeld as held:
        record.update({"status": STATUS_HELD, "reason": str(held)})
    except Exception as err:  # never lose a call over an unexpected error; the team can retry
        log.exception("Report %s failed", report_id)
        record.update({"status": STATUS_HELD, "reason": f"Unexpected error ({type(err).__name__}). Retry, or tell the developer."})
    else:
        template = result["template"]
        record.update({
            "status": STATUS_READY, "reason": "", "details": result["call"], "math": result["math"],
            "expiry": result["target"]["expiry"], "chartLabel": result["target"]["chartLabel"], "chartDay": result["chartDay"],
            "templateNumber": template["number"], "templateName": template["name"], "page2": result["page2"],
            "reportDate": result["reportDate"], "upstoxConnected": result["upstoxConnected"],
            "createdReportAt": datetime.now(timezone.utc).isoformat(),
        })
        record["fileName"] = report_file_name(record)
        with store.transaction():
            store.put(REPORT_FILES, report_id, {"id": report_id, "pdf": base64.b64encode(result["pdf"]).decode()})
            store.put(REPORTS, report_id, record)
            if not record.get("test"):
                # Templates are used one after another, in the order the calls were posted; 15 is followed by 1
                store.set_value(NEXT_TEMPLATE, template["number"] % TEMPLATE_COUNT + 1)
        return record
    store.put(REPORTS, report_id, record)
    return record


# ==========================================
# Generating on demand: one report at a time, in call order, across all backend workers
# ==========================================
STALE_SECONDS = 15 * 60  # a report still "Generating" after this was cut off by a restart


def _order(record: dict) -> str:
    return record.get("callAt") or record.get("createdAt") or ""


def _fresh(record: dict) -> bool:
    try:
        started = datetime.fromisoformat(record.get("startedAt") or "")
    except ValueError:
        return False
    return (datetime.now(timezone.utc) - started).total_seconds() < STALE_SECONDS


def claim_next() -> Optional[str]:
    """Mark the oldest queued report as Generating and return it, or None. Transactions hold the database's
    write lock, so only one worker builds at a time and the template rotation follows the call order."""
    with store.transaction():
        records = store.all(REPORTS)
        if any(r.get("status") == STATUS_WORKING and _fresh(r) for r in records):
            return None
        queued = sorted((r for r in records if r.get("status") == STATUS_QUEUED
                         or (r.get("status") == STATUS_WORKING and not _fresh(r))), key=_order)
        if not queued:
            return None
        record = queued[0]
        record.update({"status": STATUS_WORKING, "startedAt": datetime.now(timezone.utc).isoformat()})
        store.put(REPORTS, record["id"], record)
        return record["id"]


_processor: dict = {"thread": None}
_processor_lock = threading.Lock()


def _process() -> None:
    try:
        while True:
            report_id = claim_next()
            if not report_id:
                return
            run(report_id)
    except Exception:
        log.exception("Report processing stopped")


def ensure_processing() -> None:
    """Start building the queued reports in this worker, unless it already is."""
    with _processor_lock:
        thread = _processor["thread"]
        if thread is None or not thread.is_alive():
            _processor["thread"] = threading.Thread(target=_process, name="research-reports", daemon=True)
            _processor["thread"].start()


def start_worker() -> None:
    """At startup: finish reports a restart left queued."""
    ensure_processing()


def _new_record(segment: str, call_text: str, posted_by: dict, **extra) -> dict:
    record = {"id": "rr-" + uuid.uuid4().hex[:12], "segment": segment, "call": call_text, "postedBy": posted_by,
              "test": False, "status": STATUS_QUEUED, "createdAt": datetime.now(timezone.utc).isoformat(), **extra}
    store.put(REPORTS, record["id"], record)
    return record


def submit(segment: str, call_text: str, posted_by: dict, test: bool = False) -> dict:
    """Queue one report (used for test reports from the CRM)."""
    return _new_record(segment, call_text, posted_by, test=test)


def ist_day(iso: Optional[str]):
    try:
        return datetime.fromisoformat(iso or "").astimezone(IST).date()
    except ValueError:
        return None


def calls_on(day) -> List[dict]:
    """The trade calls posted in the Telegram bots on this day (IST), oldest first. Test SMS sent from
    the CRM are not calls: only Telegram posts carry the sender's Telegram user id."""
    calls = [b for b in store.all(broadcasts.BROADCASTS)
             if (b.get("postedBy") or {}).get("telegramUserId") and ist_day(b.get("createdAt")) == day]
    return sorted(calls, key=lambda b: b.get("createdAt") or "")


def queue_day(day) -> dict:
    """Queue a report for each of the day's calls that does not have one; held reports are tried again."""
    calls = calls_on(day)
    with store.transaction():
        by_call = {r.get("broadcastId"): r for r in store.all(REPORTS) if r.get("broadcastId")}
        for number, call in enumerate(calls, start=1):
            record = by_call.get(call["id"])
            if record is None:
                _new_record(call.get("segment") or "", call.get("call") or "", call.get("postedBy") or {},
                            broadcastId=call["id"], callAt=call.get("createdAt"), callNumber=number, day=day.isoformat())
            elif record.get("status") == STATUS_HELD:
                record.update({"status": STATUS_QUEUED, "reason": ""})
                store.put(REPORTS, record["id"], record)
    return day_summary(day)


def day_reports(day) -> List[dict]:
    return sorted((r for r in store.all(REPORTS) if r.get("day") == day.isoformat() and not r.get("test")),
                  key=lambda r: r.get("callNumber") or 0)


def day_summary(day) -> dict:
    reports = day_reports(day)

    def count(*statuses):
        return sum(1 for r in reports if r.get("status") in statuses)

    return {"date": name_date(day), "day": day.isoformat(), "folder": f"{name_date(day)}_report",
            "calls": len(calls_on(day)), "ready": count(STATUS_READY), "held": count(STATUS_HELD),
            "pending": count(STATUS_QUEUED, STATUS_WORKING)}


def day_zip(day) -> Optional[bytes]:
    """The day's ready reports in a folder named <date>_report, zipped; None when none is ready."""
    folder = f"{name_date(day)}_report"
    out, added = BytesIO(), 0
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as archive:
        for record in day_reports(day):
            file = store.get(REPORT_FILES, record["id"]) if record.get("status") == STATUS_READY else None
            if file:
                archive.writestr(f"{folder}/{record.get('fileName') or report_file_name(record)}", base64.b64decode(file["pdf"]))
                added += 1
    return out.getvalue() if added else None


# ==========================================
# API
# ==========================================
def _public(record: dict) -> dict:
    return {k: v for k, v in record.items() if k not in ("chatId",)}


def _attachment(data: bytes, name: str, media_type: str) -> Response:
    return Response(data, media_type=media_type,
                    headers={"Content-Disposition": f"attachment; filename=\"{name}\"; filename*=UTF-8''{urllib.parse.quote(name)}"})


@router.get("/api/reports")
def list_reports(current_user: dict = Depends(require_roles(ADMIN_ROLES))):
    cfg = settings()
    session, saved = upstox_session(), analytics_token()
    stored = store.get_value(UPSTOX_ANALYTICS) or {}
    records = sorted(store.all(REPORTS), key=lambda r: r.get("createdAt") or "", reverse=True)[:MAX_LISTED_REPORTS]
    return {
        "status": {
            "claudeReady": bool(cfg["anthropic_key"]),
            "model": cfg["model"],
            "upstoxConfigured": bool(cfg["upstox_key"] and cfg["upstox_secret"] and cfg["upstox_redirect"]),
            "upstox": {"loggedIn": bool(session), "userName": (session or {}).get("userName"),
                       "loggedInAt": (session or {}).get("loggedInAt"), "expiresAt": (session or {}).get("expiresAt")},
            # Never the token itself: only whether one is saved, when, by whom, and its last characters
            "analyticsToken": {"saved": bool(saved), "expired": bool(stored.get("token")) and not saved,
                               "savedAt": stored.get("savedAt"), "savedBy": stored.get("savedBy"),
                               "expiresAt": stored.get("expiresAt"), "ending": (stored.get("token") or "")[-4:]},
            "profileMissing": profile_missing(company_profile()),
            "nextTemplate": store.get_value(NEXT_TEMPLATE, 1),
            "bots": list(broadcasts.settings()["bots"].keys()),
            "today": day_summary(now_ist().date()),
        },
        "reports": [_public(r) for r in records],
    }


@router.post("/api/reports/generate-today")
def generate_today(current_user: dict = Depends(require_roles(ADMIN_ROLES))):
    """The button: a report for every call posted today in any of the Telegram bots."""
    summary = queue_day(now_ist().date())
    ensure_processing()
    return summary


@router.get("/api/reports/folder")
def download_folder(day: str = Query("", description="YYYY-MM-DD, default today (IST)"),
                    current_user: dict = Depends(require_roles(ADMIN_ROLES))):
    try:
        when = datetime.strptime(day, "%Y-%m-%d").date() if day else now_ist().date()
    except ValueError:
        raise HTTPException(status_code=400, detail="day must be YYYY-MM-DD.")
    data = day_zip(when)
    if data is None:
        raise HTTPException(status_code=404, detail="No reports are ready for that day yet.")
    return _attachment(data, f"{name_date(when)}_report.zip", "application/zip")


@router.get("/api/reports/{report_id}/pdf")
def download_report(report_id: str, current_user: dict = Depends(require_roles(ADMIN_ROLES))):
    record, file = store.get(REPORTS, report_id), store.get(REPORT_FILES, report_id)
    if not record or not file:
        raise HTTPException(status_code=404, detail="That report has no PDF.")
    return _attachment(base64.b64decode(file["pdf"]), record.get("fileName") or report_file_name(record), "application/pdf")


@router.post("/api/reports/{report_id}/retry")
def retry_report(report_id: str, current_user: dict = Depends(require_roles(ADMIN_ROLES))):
    with store.transaction():
        record = store.get(REPORTS, report_id)
        if not record:
            raise HTTPException(status_code=404, detail="Report not found.")
        if record.get("status") != STATUS_HELD:
            raise HTTPException(status_code=400, detail="Only a held report can be retried.")
        record.update({"status": STATUS_QUEUED, "reason": "", "retriedBy": current_user.get("name")})
        store.put(REPORTS, report_id, record)
    ensure_processing()
    return _public(record)


class TestReport(BaseModel):
    segment: str
    call: str


@router.post("/api/reports/test")
def test_report(req: TestReport, current_user: dict = Depends(require_roles(["Super Admin"]))):
    """Build a report from the CRM to check it, without using up a template in the rotation."""
    if not req.call.strip():
        raise HTTPException(status_code=400, detail="Enter the call text.")
    record = submit(req.segment.strip(), req.call.strip(), {"name": f"{current_user['name']} (CRM test)", "phone": ""}, test=True)
    ensure_processing()
    return _public(record)


class AnalyticsToken(BaseModel):
    token: str


@router.post("/api/upstox/analytics-token")
def save_analytics_token(req: AnalyticsToken, current_user: dict = Depends(require_roles(["Super Admin"]))):
    """Save the Upstox Analytics Token after checking it with Upstox (a read-only quote request)."""
    token = "".join(req.token.split())
    if token.lower().startswith("bearer"):
        token = token[6:]
    if len(token) < 20 or len(token) > 4000:
        raise HTTPException(status_code=400, detail="That does not look like an Upstox Analytics Token.")
    try:
        res = httpx.get(f"{UPSTOX_API}/v3/market-quote/ltp", params={"instrument_key": "NSE_INDEX|Nifty 50"},
                        headers={"Accept": "application/json", "Authorization": f"Bearer {token}"}, timeout=20)
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Upstox could not be reached to check the token. Try again.")
    if res.status_code in (401, 403):
        raise HTTPException(status_code=400, detail="Upstox rejected this token. Copy the Analytics Token again from Upstox (Apps, Analytics tab).")
    if res.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Upstox answered {res.status_code} while checking the token. Try again.")
    at = now_ist()
    store.set_value(UPSTOX_ANALYTICS, {"token": token, "savedAt": at.isoformat(), "savedBy": current_user.get("name"),
                                       "expiresAt": (at + timedelta(days=ANALYTICS_TOKEN_DAYS)).isoformat()})
    return {"saved": True, "expiresAt": (at + timedelta(days=ANALYTICS_TOKEN_DAYS)).isoformat(), "ending": token[-4:]}


@router.delete("/api/upstox/analytics-token")
def delete_analytics_token(current_user: dict = Depends(require_roles(["Super Admin"]))):
    store.set_value(UPSTOX_ANALYTICS, {})
    return {"saved": False}


@router.get("/api/upstox/login-url")
def upstox_login_url(current_user: dict = Depends(require_roles(ADMIN_ROLES))):
    cfg = settings()
    if not (cfg["upstox_key"] and cfg["upstox_secret"] and cfg["upstox_redirect"]):
        raise HTTPException(status_code=400, detail="Set UPSTOX_API_KEY, UPSTOX_API_SECRET and UPSTOX_REDIRECT_URI in backend/.env.")
    state = secrets.token_urlsafe(24)
    with store.update_value(UPSTOX_LOGIN_STATES, {}) as states:
        now = time.time()
        states[0] = {s: t for s, t in states[0].items() if t > now}
        states[0][state] = now + 600
    query = urllib.parse.urlencode({"response_type": "code", "client_id": cfg["upstox_key"],
                                    "redirect_uri": cfg["upstox_redirect"], "state": state})
    return {"url": f"{UPSTOX_API}/v2/login/authorization/dialog?{query}"}


def _page(title: str, message: str, ok: bool) -> HTMLResponse:
    colour = "#15803d" if ok else "#b91c1c"
    return HTMLResponse(
        f"<!doctype html><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
        f"<title>{escape(title)}</title><body style='font-family:system-ui,sans-serif;max-width:520px;margin:15vh auto;padding:0 16px'>"
        f"<h2 style='color:{colour}'>{escape(title)}</h2><p>{escape(message)}</p>"
        f"<p><a href='/'>Back to the CRM</a></p></body>", status_code=200 if ok else 400)


@router.get("/api/upstox/callback")
def upstox_callback(code: str = Query(""), state: str = Query("")):
    """Upstox sends the browser here after the daily login. The state proves the login was started from the CRM."""
    with store.update_value(UPSTOX_LOGIN_STATES, {}) as states:
        valid = states[0].pop(state, 0) > time.time() if state else False
    if not valid or not code:
        return _page("Upstox login failed", "This login link has expired or was not started from the CRM. Start again from Research Reports.", False)
    cfg = settings()
    try:
        res = httpx.post(f"{UPSTOX_API}/v2/login/authorization/token", timeout=30, headers={"Accept": "application/json"},
                         data={"code": code, "client_id": cfg["upstox_key"], "client_secret": cfg["upstox_secret"],
                               "redirect_uri": cfg["upstox_redirect"], "grant_type": "authorization_code"})
        body = res.json()
    except (httpx.HTTPError, ValueError):
        return _page("Upstox login failed", "Upstox could not be reached. Try again.", False)
    if res.status_code != 200 or not body.get("access_token"):
        errors = body.get("errors") or [{}]
        return _page("Upstox login failed", f"Upstox said: {errors[0].get('message') or res.status_code}", False)
    at = now_ist()
    store.set_value(UPSTOX_SESSION, {"accessToken": body["access_token"], "userName": body.get("user_name") or body.get("user_id"),
                                     "loggedInAt": at.isoformat(), "expiresAt": _token_expiry(at).isoformat()})
    return _page("Upstox connected", f"Logged in as {body.get('user_name') or body.get('user_id')}. "
                                     f"Valid until 3:30 AM. You can close this tab.", True)
