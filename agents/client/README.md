# Client App Launch Guide

For the project overview, collaboration statement, and architecture summary, see [../README.md](../README.md).

For the full monitoring workflow, see [../MONITORING.md](../MONITORING.md).

This workspace uses a shared JSON data folder at `client/data/` for both backends.

## Configuration

Copy [../.env.example](../.env.example) to `.env` and set the runtime values you need.

- `CB_USERNAME` and `CB_PASSWORD` drive the Chaturbate-authenticated agents.
- `CB_EVENT_URL` controls the event poller URL.
- `POLL_EVENTS` controls whether the Node backend starts the external event poller (`true` or `false`).
- `LOG_LEVEL` controls backend log verbosity (`DEBUG`, `INFO`, `WARNING`, `ERROR`).
- `PROFILE_DISPLAY_NAME`, `PROFILE_ROLE`, and `PROFILE_BUSINESS` control profile defaults.
- `ANALYTICS_DEFAULT_VISITS` and `ANALYTICS_DEFAULT_CONVERSION_RATE` seed analytics output.
- `AGENTS_DATA_DIR` optionally overrides the shared JSON directory.

PowerShell note: set one-off env vars with `$env:NAME='value'`.
Example:

```powershell
$env:POLL_EVENTS='false'; npm start
```

## Data layout

- `client/data/profile.json`
- `client/data/messages.json`
- `client/data/analytics.json`

Both [main.py](main.py) and [index.js](../index.js) read from that folder using path-safe resolution, so the app does not depend on the current working directory.

## Run the backends

From the repository root:

```powershell
uvicorn client.main:app --reload
```

In a second terminal from the repository root:

```powershell
npm start
```

## Run the frontend

From the `client/` folder:

```powershell
npm start
```

The React app runs on port `3000` and proxies API requests to the backend on port `5000`.

## Quick checks

```powershell
curl http://127.0.0.1:8000/profile
curl http://127.0.0.1:8000/messages
curl http://127.0.0.1:8000/analytics
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/metrics
curl http://127.0.0.1:8000/metrics/prometheus
curl http://127.0.0.1:5000/health
curl http://127.0.0.1:5000/metrics
curl http://127.0.0.1:5000/metrics/prometheus
```

## Prometheus scrape config

This repository includes a starter scrape config at [../prometheus.example.yml](../prometheus.example.yml).

For a full local monitoring stack, use [../docker-compose.monitoring.yml](../docker-compose.monitoring.yml) with the Compose-native Prometheus config at [../prometheus.compose.yml](../prometheus.compose.yml).

It also includes:

- a Grafana dashboard starter at [../grafana.dashboard.json](../grafana.dashboard.json)
- Prometheus alert rules at [../alert.rules.yml](../alert.rules.yml)
- Grafana datasource provisioning at [../monitoring/grafana/provisioning/datasources/prometheus.yml](../monitoring/grafana/provisioning/datasources/prometheus.yml)
- Grafana dashboard provisioning at [../monitoring/grafana/provisioning/dashboards/dashboard.yml](../monitoring/grafana/provisioning/dashboards/dashboard.yml)

It targets both backend metrics endpoints:

- `127.0.0.1:8000/metrics/prometheus`
- `127.0.0.1:5000/metrics/prometheus`

To use it locally:

1. Start FastAPI on port `8000`.
2. Start Node on port `5000`.
3. Reference `alert.rules.yml` from your Prometheus config with `rule_files`.
4. Copy `prometheus.example.yml` into your Prometheus config location, or start Prometheus with it directly.
5. Open the Prometheus UI and confirm both `chatterbate_fastapi` and `chatterbate_node` targets are `UP`.
6. Import `grafana.dashboard.json` into Grafana to view uptime, memory, data integrity, problem count, and backend availability.

## Unified monitoring stack

To launch Prometheus, Grafana, FastAPI, and Node together:

```powershell
docker compose -f docker-compose.monitoring.yml up
```

What this stack does:

- starts FastAPI on `8000`
- starts Node on `5000` with `POLL_EVENTS=false`
- starts Prometheus on `9090`
- starts Grafana on `3001`
- auto-loads the Prometheus datasource in Grafana
- auto-loads the Chatterbate dashboard in Grafana
- loads alert rules from `alert.rules.yml`

Default Grafana login:

- username: `admin`
- password: `admin`

Recommended checks after startup:

1. Open `http://127.0.0.1:9090/targets` and confirm both scrape targets are `UP`.
2. Open `http://127.0.0.1:3001` and confirm the `Chatterbate Backend Overview` dashboard is present.
3. Confirm backend metrics remain available at `/metrics/prometheus` on ports `8000` and `5000`.

Example `rule_files` snippet:

```yaml
rule_files:
	- alert.rules.yml
```

## Runbook

1. Start the FastAPI backend from the repository root:

	```powershell
	uvicorn client.main:app --reload
	```

2. Start the Node backend from the repository root in a second terminal:

	```powershell
	npm start
	```

3. Confirm the shared JSON files are present in `client/data/`.

4. Hit the API endpoints and confirm each returns JSON without errors.

5. If a request fails, check first for one of these issues:

	- missing file in `client/data/`
	- malformed JSON
	- backend started from the wrong working directory
	- stale process still using an old file version

6. Keep `client/data/` as the only writable data location unless a migration explicitly changes that contract.

## Tests

Run the Node checks from the repository root:

```powershell
npm test
```

Run the Python checks from the repository root:

```powershell
python -m unittest discover -s test -p "test_*.py"
```

## CI/CD Starter

This repository includes a GitHub Actions workflow at [../.github/workflows/backend-ci.yml](../.github/workflows/backend-ci.yml).

On each push and pull request to `main`, it:

- installs Python and Node dependencies,
- runs backend Python tests,
- runs backend Node tests,
- boots both backends,
- checks `/health` on ports `8000` and `5000`.
