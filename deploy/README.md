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
- `backend/.env`: Leegality API keys

## Rotating account passwords

```bash
python deploy/generate_credentials.py          # writes secrets/credentials.json + CRM_ACCOUNT_CREDENTIALS.txt
scp secrets/credentials.json skanda@200.234.32.65:srinivas-crm/secrets/credentials.json
ssh skanda@200.234.32.65 'cd srinivas-crm && docker compose restart backend'
```
