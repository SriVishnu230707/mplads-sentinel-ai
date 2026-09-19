# MPLADS Sentinel AI

Secure, role-aware risk-intelligence platform for MPLADS monitoring. It combines explainable anomaly detection, scoped operational workflows, investigation cases, and deployment-aware security controls.

## Run locally

```powershell
npm install
npm run dev
```

Open the URL printed by Vite.

## Run the Phase 2 API

From the project root:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
cd ..
npm run dev:api
```

The API runs at `http://localhost:8000`; interactive documentation is available at `/docs`. Keep this terminal running and start `npm run dev` in a second terminal. Using `localhost` for both services keeps the development refresh cookie first-party, including on Antigravity preview ports.

For a quick college demonstration, SQLite is used automatically. It is not a production configuration.

## Seeded demonstration accounts

All demonstration accounts use password `Sentinel@2026`:

| Role | Email | Visible scope |
|---|---|---|
| Ministry | `ministry@sentinel.gov.in` | All projects |
| State | `state@sentinel.gov.in` | Karnataka only |
| District | `district@sentinel.gov.in` | Bengaluru Rural only |
| Auditor | `auditor@sentinel.gov.in` | All projects |

These accounts and the password are synthetic, local demonstration data only. They must never be provisioned in a deployed environment.

Production and staging startup fail closed unless `AUTO_SEED=false`, `SECRET_KEY` is replaced with a high-entropy secret, PostgreSQL and Redis are configured, and explicit HTTPS frontend origins are supplied. This prevents known demonstration credentials or the development signing secret from reaching a deployed environment.

## Production build

```bash
npm run build
npm run preview
```

## Secure deployment

Copy `deployment.env.example` to a private deployment environment and replace every placeholder. URL-encode database and Redis passwords when placing them in connection URLs. The Compose configuration intentionally keeps PostgreSQL, Redis, and MinIO off host-published ports; expose only the API through a TLS reverse proxy. Use reviewed immutable image digests, managed secret storage, backups, and a firewall policy.

The `/health` endpoint is a liveness probe and `/ready` verifies database and Redis availability. The authenticated Ministry/Auditor endpoint `/api/v1/audit/integrity` verifies the application audit hash chain. It is tamper-evident—not a substitute for periodically anchoring audit hashes in independent immutable storage.

## Included prototype modules

- National command centre
- Explainable risk alerts and project drill-down
- Works and expenditure monitoring
- Geospatial risk intelligence
- Investigation case workflow
- Secure report catalogue
- Administration and model-governance view
- Server-authenticated Ministry, state, district and audit roles
- Query-level jurisdiction enforcement
- Rotating refresh sessions in an HttpOnly cookie
- Argon2id password hashing and short-lived JWT access tokens
- Login throttling and timing-safe handling of unknown accounts
- Controlled alert lifecycle with role-restricted closure and duplicate cleanup
- API security headers for content type, framing, referrer, permissions, and caching
- Explainable payment-progress, cost, evidence and delay rules
- Idempotent risk alert creation and access audit events
- Responsive navigation and dark theme
- Phase 3 project-health score, compliance watch, and historical risk timeline
- Scoped duplicate-work matching with explainable similarity factors
- Human alert-triage action recorded in the audit trail
- Phase 4 explainable delay early-warning, labelled as non-decisive assistance
- Secure progress-import API: UTF-8 CSV only, 1 MB / 500-row limits, dry-run default, all-or-nothing validation, and jurisdiction enforcement
- Metadata-only field evidence with time, monotonic-progress, India-boundary, and 2 km project-radius checks
- Phase 5 investigation cases, maker-checker closure, scoped CSV report exports, and formula-injection protection
- Phase 6 Alembic migrations, Redis-backed distributed limits, readiness checks, Docker deployment controls, and CI
- Final hardening: chunked-request size enforcement, finite financial imports, optimistic concurrency, monotonic evidence timestamps, staging seed lockout, and audit hash-chain verification

The seeded data is synthetic. The backend authorizes every protected request; frontend visibility is never treated as an access-control boundary.

## Verification

```powershell
npm run build
npm run test:api
```

Current result: frontend build succeeds and all 25 API, security, configuration, lifecycle, integrity, and deployment-control tests pass.
