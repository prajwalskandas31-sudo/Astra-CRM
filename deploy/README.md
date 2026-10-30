# Deployment

The CRM runs as two Docker containers on the server (`skanda@200.234.32.65`, folder `~/srinivas-crm`):
nginx serves the frontend on port **8080** and forwards `/api` to the FastAPI backend.

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

- `.env`: `CRM_PORT`, `JWT_SECRET_KEY`
- `secrets/credentials.json`: account passwords
- `backend/.env`: Leegality API keys, and the Trade Call Broadcast settings below

## Trade Call Broadcasts (Telegram → SMS)

Each service has its own Telegram bot. A call posted to that bot goes out as SMS, through the wappie gateway,
to every **active** Paid client on that service (expired tenures are skipped). The Paid block is synced to
`backend/data/paid_clients.json` by Admin/Super Admin sessions; the bots read that copy.

Settings in `backend/.env` (restart the backend after changing bots):

| Key | Value |
|---|---|
| `SMS_ACCESS_TOKEN` | wappie Developers → Access Tokens |
| `SMS_SENDER` | approved DLT sender ID (header) |
| `SMS_SERVICE` | route for that sender: `SI`, `SE`, `TR` or `PR` |
| `SMS_COUNTRY_CODE` | default `+91` |
| `SMS_MESSAGE_FORMAT` | SMS text; must match the approved DLT template. `{call}` = Telegram message, `{service}` = service name. Default `{call}` |
| `SMS_MAX_CHARS` | longest SMS allowed, default 480 |
| `SMS_TEST_RECIPIENT` | while set, every call goes only to this number (bot reply says how many clients it would have reached) |
| `SMS_DRY_RUN` | `1` = log only, send nothing |
| `TELEGRAM_BOTS` | JSON: `{"<service name exactly as in the CRM>": "<BotFather token>"}` |
| `TELEGRAM_ALLOWED_PHONES` | comma-separated numbers allowed to post calls |

A sender verifies once by opening the bot and tapping **Share my number**; only a number listed in
`TELEGRAM_ALLOWED_PHONES` is accepted, and removing it revokes them. Calls that reach the server more than
5 minutes late (e.g. while it was restarting) are not sent. Results show in the Paid block under
**Trade Call Broadcasts** and in the bot's reply.

## Rotating account passwords

```bash
python deploy/generate_credentials.py          # writes secrets/credentials.json + CRM_ACCOUNT_CREDENTIALS.txt
scp secrets/credentials.json skanda@200.234.32.65:srinivas-crm/secrets/credentials.json
ssh skanda@200.234.32.65 'cd srinivas-crm && docker compose restart backend'
```
