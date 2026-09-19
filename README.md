# MPLADS Sentinel AI

Secure, role-aware risk-intelligence platform for MPLADS monitoring. Phase 2 adds a tested FastAPI backend, persistent data, authentication, jurisdiction enforcement, explainable rules, risk alerts and audit events.

## Run the demonstration locally

```powershell
npm install
npm run dev
```

Open the URL printed by Vite. This single command starts both the frontend and
the FastAPI demo API; stop it with `Ctrl+C` when finished.

## Run the Phase 2 API separately

From the project root:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
cd ..
npm run dev:api
```

The API runs at `http://127.0.0.1:8000`; interactive documentation is available at `/docs`. Keep this terminal running and start `npm run dev` in a second terminal.

For a quick college demonstration, SQLite is used automatically. To move to PostgreSQL, start `docker compose up -d postgres` and set `DATABASE_URL=postgresql+psycopg://sentinel:sentinel_local_only@localhost:5432/mplads_sentinel` in `backend/.env`.

## Seeded demonstration accounts

All demonstration accounts use password `Sentinel@2026`:

| Role | Email | Visible scope |
|---|---|---|
| Ministry | `ministry@sentinel.gov.in` | All projects |
| State | `state@sentinel.gov.in` | Karnataka only |
| District | `district@sentinel.gov.in` | Bengaluru Rural only |
| Auditor | `auditor@sentinel.gov.in` | All projects |

These accounts are for local demonstration only. Replace the seed and secret key before any deployment.

## Production build

```bash
npm run build
npm run preview
```

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
- Explainable payment-progress, cost, evidence and delay rules
- Idempotent risk alert creation and access audit events
- Responsive navigation and dark theme

The seeded data is synthetic. The backend authorizes every protected request; frontend visibility is never treated as an access-control boundary.

## Verification

```powershell
npm run build
npm run test:api
```

Current result: frontend build succeeds and all six API/security tests pass.
