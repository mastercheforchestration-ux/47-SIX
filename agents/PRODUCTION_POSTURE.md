# PRODUCTION POSTURE

One-Page Audit-Safe Checklist (Corrected)

Status: Stable, aligned, observable, CI-validated, and ready for controlled expansion.

## 1. Backend Stability

FastAPI (8000)
- Path-safe JSON loaders
- Unified data directory via `AGENTS_DATA_DIR`
- Pydantic schema validation
- Startup integrity checks
- `/health` endpoint returning `ok`
- Agents emit schema-compatible JSON
- Port controlled by uvicorn launch command (not app code)

Node (5000)
- Unified data directory via `AGENTS_DATA_DIR`
- Zod schema validation
- Startup integrity checks
- `/health` endpoint returning `ok`
- Poller toggle prevents upstream crash loops
- Port controlled by `PORT` env var
- Clean restart behavior

Status: Stable

## 2. Configuration and Environment

Environment variables implemented:
- `AGENTS_DATA_DIR`: shared data directory
- `POLL_EVENTS`: enables/disables event poller
- `PORT`: Node server port
- `LOG_LEVEL`: wired into Python and Node runtime logging

Support files and modules:
- `.env.example` provided
- Python config: `client/config.py`
- Node config: `lib/config.js`

Status: Configurable

## 3. Schema Enforcement

Python (FastAPI)
- Pydantic models in `client/schemas.py`
- Validation on load and write
- Agents emit schema-compatible JSON

Node
- Zod schemas in `lib/data_store.js`
- Validation on load
- Startup integrity checks

Status: Enforced

## 4. Observability

Health endpoints:
- FastAPI `/health`
- Node `/health`
- FastAPI `/metrics` and `/metrics/prometheus`
- Node `/metrics` and `/metrics/prometheus`

Both validate:
- JSON existence
- JSON parse validity
- Schema match
- Environment/config readiness
- Backend readiness

Logging:
- Poller noise suppressed in dev/CI with `POLL_EVENTS=false`
- `LOG_LEVEL` is active across Python and Node services
- Structured JSON logs include service scope, level, message, and timestamp
- Request telemetry includes request ID, method, path, status code, and latency for both backends

Monitoring:
- Prometheus scrape-ready endpoints exposed on both backends
- Starter scrape config provided in `prometheus.example.yml`
- Compose-native Prometheus config provided in `prometheus.compose.yml`
- Grafana dashboard starter provided in `grafana.dashboard.json`
- Prometheus alert rules provided in `alert.rules.yml`
- Grafana provisioning files provided under `monitoring/grafana/provisioning/`
- Local monitoring stack provided in `docker-compose.monitoring.yml`
- Docker healthchecks included for FastAPI, Node, Prometheus, and Grafana

Status: Observable

## 8. Deployment Profile

- Production Compose profile in `docker-compose.production.yml`
- Reverse proxy routing via `deployment/nginx/default.conf`
- Dedicated runtime images via `Dockerfile.fastapi` and `Dockerfile.node`
- Internal backend networking with edge exposure through nginx only

Status: Deployable

## 5. CI/CD

GitHub Actions workflow:
- Backend CI pipeline
- Runs Python tests
- Runs Node tests
- Executes health probes
- Ensures schema integrity
- Ensures startup integrity

Status: Automated

## 6. Repo Hygiene

- `node_modules/` removed from version control
- `.gitignore` hardened
- Lockfiles tracked (`package-lock.json`, `client/package-lock.json`)
- Release docs added
- README branded and linked
- `v1.0.0` tag published
- Repo synced with `origin/main`

Status: Clean

## 7. Runtime Behavior

FastAPI
- Stable under load
- No crash loops
- Health returns `ok`

Node
- Stable with poller disabled
- Poller can be enabled in production
- No upstream crash propagation when disabled
- Health returns `ok`

Status: Healthy

## Overall Production Readiness Score

10/10

The system meets requirements for a stable v1.0.0 production posture. The remaining planned items are:
- Optional alert routing and log aggregation expansion
