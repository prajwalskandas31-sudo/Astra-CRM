# Deployment

The CRM runs as Docker containers on the server (`skanda@200.234.32.65`, folder `~/srinivas-crm`):

| Container | Role |
|---|---|
| `frontend` | nginx: serves the app on port **8080**, forwards `/api` to the backend, gzips responses |
| `backend` | FastAPI, 2 worker processes by default; 6 on the large server (see below) |
| `db` | PostgreSQL 16: every CRM record (users, leads, sales, settings, Paid block, signatures). Volume `crm-db` |
| `backup` | `pg_dump` at start-up and nightly at 02:00 into `~/srinivas-crm/backups`, kept 14 days |

All data lives in Postgres and is shared by every browser through `/api/sync` (see `backend/sync.py`
for who may read and change what). Browsers keep only a cache. Restarts and redeploys keep all data.

## CI/CD (`.github/workflows/ci-cd.yml`)

| Job | Runs on | What it checks |
|---|---|---|
| Backend tests | every PR and push to `main` | `pytest backend/tests`: login, lockout, token revocation, role and data-access rules |
| Frontend build | every PR and push to `main` | the production build compiles |
| Docker integration | after the two above | builds both images, starts the stack, runs `deploy/smoke_test.sh` with a real sign-in |
| Dependency audit | every PR and push to `main` | `pip-audit` and `npm audit`; report only, never blocks |
| Deploy | push to `main`, after all gates pass | syncs code over SSH, runs `deploy/remote_deploy.sh`, then a public smoke test |

`remote_deploy.sh` keeps the previous images. If the new version fails its smoke test, it restores them automatically and the job fails.
To redeploy without a code change, use **Actions → CI/CD → Run workflow** on `main`.

Deploy secrets live in the GitHub `production` environment (only `main` can use them):
`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` (key comment `github-actions-srinivas-crm` on the server), `DEPLOY_KNOWN_HOSTS`.

## Server-only files (never synced, never in git)

- `.env`: `CRM_PORT`, `JWT_SECRET_KEY`, `POSTGRES_PASSWORD` (created by the first deploy; never change it, the
  database keeps the password it was created with). Optional: `WEB_CONCURRENCY`, `BACKUP_HOUR`, `BACKUP_KEEP_DAYS`
- `backups/`: database dumps (never synced, never deleted by a deploy)
- `secrets/credentials.json`: account passwords
- `backend/.env`: Leegality API keys, and the Trade Call Broadcast settings below

## Trade Call Broadcasts (Telegram → SMS)

Each trading segment has its own Telegram bot, matching the four checkboxes per client in the
**Telegram Control Block**:

| Bot | Segment checkbox |
|---|---|
| @Srin_vas_1_bot | NSE DERIVATIVES |
| @Srin_vas_2_bot | MCX DERIVATIVES |
| @Srin_vas_3_bot | BSE DERIVATIVES |
| @Srin_vas_4_bot | NSE BSE EQUITY |

A call posted to a bot goes out as SMS, through the wappie gateway, to every **active** Paid client with that
segment ticked (expired tenures are skipped; a client with several boxes ticked gets each bot's calls). The bots
read the Paid block from the database. Only one backend worker runs the bots (it holds a database lock), so each
call is sent once.

Senders post the template values, e.g. `NIFTY 24500 CE Buy 120 SL 100 Tgt 150`; the fixed template words
(`FNO ALERT:`, optionally preceded by `InvestEQ`, and the SEBI footer) are optional, so pasting the full
approved text works too. A call that does not fit the template is refused, and the bot replies with the expected format.

The SMS must match the template **as registered on DLT** character for character (wappie dashboard →
SMS → Templates → edit shows it), not the text in any handover document; otherwise wappie accepts and
charges it but the operator drops it ("Template not matched … content violation in static part", visible
under SMS → Messages → ⓘ). "Blocked in preferences with MSISDN as PK" there means the recipient has DND /
commercial-SMS blocking on their number.

Settings in `backend/.env` (restart the backend after changing bots):

| Key | Value |
|---|---|
| `SMS_ACCESS_TOKEN` | wappie Developers → Access Tokens |
| `SMS_SENDER` | approved DLT sender ID (header) |
| `SMS_SERVICE` | route registered for the template: `SI`, `SE`, `T`, `P` or `OTP` (wappie rejects `TR`/`PR`). Current: `SI` |
| `SMS_COUNTRY_CODE` | default `+91` |
| `SMS_MESSAGE_FORMAT` | SMS text; must match the approved DLT template. `{{1}}`…`{{4}}` = template variables read from the Telegram message (or `{call}` = whole message), `{segment}` = bot's segment, `\n` = line break. Default `{call}`. Current: `FNO ALERT: {{1}} Buy {{2}} SL {{3}} Tgt {{4}}\n\nUnite Technologies Financial Service (SEBI Reg: INH000020350) - https://investeq.in/` (DLT template 1777179206957321210, verified delivered 9 Nov 2026) |
| `SMS_MAX_CHARS` | longest SMS allowed, default 480 |
| `SMS_TEST_RECIPIENT` | comma-separated; while set, every call goes only to these numbers (bot reply says how many clients it would have reached). Super Admins can also send a test from the Trade Call Broadcasts panel |
| `SMS_DRY_RUN` | `1` = log only, send nothing |
| `SMS_BLOCKED_HOURS` | IST hours when carriers drop the route's SMS; calls then are refused, not sent. Default `21-10` for `SE`/`PR`, `off` otherwise |
| `TELEGRAM_BOTS` | JSON on one line: `{"<segment>": "<BotFather token>"}` for the segments `NSE DERIVATIVES`, `MCX DERIVATIVES`, `BSE DERIVATIVES`, `NSE BSE EQUITY` (case-insensitive), e.g. `{"NSE DERIVATIVES": "123:abc", "MCX DERIVATIVES": "456:def"}`. Never run the same token on two servers at once: Telegram gives each message to one poller only |
| `TELEGRAM_ALLOWED_PHONES` | comma-separated numbers allowed to post calls |

A sender verifies once by opening the bot and tapping **Share my number**; only a number listed in
`TELEGRAM_ALLOWED_PHONES` is accepted, and removing it revokes them. Calls that reach the server more than
5 minutes late (e.g. while it was restarting) are not sent. Results show in the Paid block under
**Trade Call Broadcasts** and in the bot's reply.

## Research Reports (Telegram calls → 3-page PDFs, on demand)

Calls posted in the Telegram bots (above) are logged as they come in. Reports are not made live: in
**Research Reports** the team presses **Generate today's reports**, and the CRM builds a report for
every call posted today (IST) in any of the 4 bots, one at a time in the order the calls were posted
(`backend/reports.py`). When all are done, the browser downloads `<dd-mm-yyyy>_report.zip`, which
holds the folder `<dd-mm-yyyy>_report` with `<dd-mm-yyyy> (n) <call>.pdf`, e.g.
`12-11-2026 (1) NIFTY 25200 CE.pdf`. Pressing again later only builds the new calls (and retries held
ones); nothing is paid for twice. Test SMS sent from the CRM are not calls and get no report. For each call:

1. Claude reads the post (symbol, Buy/Sell, strike, CE/PE, entry, stop-loss, targets). Anything missing
   or unclear holds the report; nothing is guessed, and every number must appear in the post itself.
2. The CRM works out risk, gains and risk-reward, finds the nearest expiry in Upstox's instrument list,
   and fetches the 1-minute candles of the underlying (NIFTY 50 for NIFTY, the stock for a stock, the
   current-month MCX future for a commodity; the last trading day when today has no data yet).
3. Claude fills the next of the 15 templates (`backend/report_templates.json`, used in turn across all
   bots; a test report from the CRM does not advance the rotation). The CRM rejects the text if it has a
   blank, a number that is not in the call or template, a banned word, or a changed call, and asks once more.
4. The PDF (cover + chart, technical rationale, fixed disclosures) is stored in the database.

A held report shows its reason in Research Reports and can be retried once the cause is fixed. Company details come from the **Company Profile**
block; the report is held until Company Name, SEBI Registration Number, Registered Address, Contact,
Email and Website are filled in.

Set in `backend/.env` on the server:

| Key | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key from the client's Anthropic account (the one holding the report credit) |
| `REPORT_CLAUDE_MODEL` | Optional; defaults to `claude-opus-5-5` |
| `UPSTOX_API_KEY` / `UPSTOX_API_SECRET` | From the Upstox developer app "CRM Report Generator" |
| `UPSTOX_REDIRECT_URI` | `http://<server>:<CRM_PORT>/api/upstox/callback`, e.g. `http://200.234.32.65:8080/api/upstox/callback`. Must be entered exactly the same as the Redirect URL of the Upstox app |

**Upstox Analytics Token:** Upstox only accepts an https Redirect URL, and this server runs plain HTTP,
so the daily login is not used here. Instead the Upstox account owner generates an Analytics Token
(Upstox, Apps, Analytics tab: read-only, valid one year) and a Super Admin pastes it into Research
Reports. The CRM checks it with Upstox before saving, never shows it again, and warns 30 days before it
expires. Without a token the CRM uses Upstox's public market data and notes this in the Telegram reply.
The daily login (`/api/upstox/login-url`, `/api/upstox/callback`) stays in the code for a server with HTTPS.

## e-KYC & E-Sign (Leegality)

"Trigger e-KYC & E-Sign" sends workflow `KKliSJp` (template `kFWn7uC`, RA Terms and Conditions - UTFS) with
Date 1 = today, Checkbox 1 = the Service Tenure (as the template orders them: 1 Month = Option 1 … 12 Months =
Option 12, Demo = Option 13; images must go as type `files`, a data URL, 200x80 px — all verified on a live document),
and the Primary Signatory from the Digital Signature Storage block in both signature boxes, each stamped
with the date and 24-hour time (IST) it was sent.

Both signature boxes are named "Image 1", so Leegality needs their field ids; until they are set, sending is
refused rather than producing an agreement with one box empty. Leegality has no API for the ids. In the
dashboard open Templates > RA Terms and Conditions - UTFS > three dots > **Download Form Fields**, then:

    python deploy/import_leegality_fields.py <downloaded .json> --dry-run   # check the matches
    python deploy/import_leegality_fields.py <downloaded .json>             # write backend/leegality_template_map.json

Commit the updated map; the next deploy picks it up. If the template is ever edited, download and import again.

## Rotating account passwords

The credentials file sets the passwords of a brand-new database. After that, passwords live in the database
(changed in the CRM by a Super Admin), and a restart never resets them. To force the file's passwords again:

```bash
python deploy/generate_credentials.py          # writes secrets/credentials.json + CRM_ACCOUNT_CREDENTIALS.txt
scp secrets/credentials.json skanda@200.234.32.65:srinivas-crm/secrets/credentials.json
ssh skanda@200.234.32.65 'cd srinivas-crm && docker compose exec backend python -m backend.db_init --apply-credentials'
```

## Backups and restore

- Nightly: `backups/crm-YYYYMMDD-HHMMSS.dump` (plus one each time the backup container starts), kept 14 days.
- Before every deploy: `backups/pre-deploy-*.dump`, last 10 kept.
- These sit on the same server. Copy them off it regularly (another machine or cloud storage), e.g. from your PC:
  `scp skanda@200.234.32.65:srinivas-crm/backups/crm-*.dump ./crm-backups/`

Restore (replaces all current data; asks for confirmation):

```bash
ssh skanda@200.234.32.65
cd srinivas-crm && deploy/restore_backup.sh backups/crm-20261103-020000.dump
```

## Upgrading from the in-memory version

The first deploy of this version creates the database and seeds the accounts from `secrets/credentials.json`.
It also imports the files the old version kept in `backend/data` (Paid clients, broadcast log, Telegram senders,
signatures, Leegality records), once. The first Super Admin to sign in afterwards uploads the leads, sales and
assignments their browser holds, because the old version kept those only in browsers. Users created in the CRM
since the last restart lived only in memory and must be created again, once.

## Capacity and load testing

The defaults are deliberately light, so the current small server is never overloaded. The ~300-user setup
is for the 32 GB / 8 vCPU server: append `deploy/env.large-server.example` to that server's `.env`, then
`docker compose up -d`. Never run the load test against the current small server.

Before go-live on the large server (outside working hours; it writes test records and removes them again),
run from any PC:

```bash
python deploy/load_test.py http://SERVER:8080 --password-file secrets/credentials.json     --users 300 --admins 10 --create-users 290 --leads 20000 --minutes 3
```

To grow further: raise `WEB_CONCURRENCY` with more CPUs; above ~1,000 users move Postgres to its own server
(set `DATABASE_URL`) and run several backend servers behind a load balancer. Nothing in the app keeps
state in memory, so this needs no code change.

A message queue (Apache Artemis) is deliberately not part of this setup: no work in the CRM waits in a
queue today, and requests are answered directly. The first place it would earn its keep is the Telegram →
SMS fan-out, once Paid clients number in the thousands: each SMS as a durable message with retries that
survives a backend restart mid-broadcast. Add it then, as an `artemis` container next to `db`.
