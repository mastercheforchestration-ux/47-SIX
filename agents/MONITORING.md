# Monitoring Guide

This repository includes a complete local monitoring stack for the FastAPI backend, Node backend, Prometheus, and Grafana.

## Artifacts

- Docker Compose stack: [docker-compose.monitoring.yml](docker-compose.monitoring.yml)
- Compose Prometheus config: [prometheus.compose.yml](prometheus.compose.yml)
- Prometheus alert rules: [alert.rules.yml](alert.rules.yml)
- Grafana dashboard: [grafana.dashboard.json](grafana.dashboard.json)
- Grafana datasource provisioning: [monitoring/grafana/provisioning/datasources/prometheus.yml](monitoring/grafana/provisioning/datasources/prometheus.yml)
- Grafana dashboard provisioning: [monitoring/grafana/provisioning/dashboards/dashboard.yml](monitoring/grafana/provisioning/dashboards/dashboard.yml)

## Services

The monitoring stack starts these services:

- FastAPI on `8000`
- Node on `5000`
- Prometheus on `9090`
- Grafana on `3001`

Node is forced into safe local mode with `POLL_EVENTS=false` in the Compose stack.

## Start The Stack

Run from the repository root:

```powershell
docker compose -f docker-compose.monitoring.yml up --build
```

To run in detached mode:

```powershell
docker compose -f docker-compose.monitoring.yml up --build -d
```

To stop the stack:

```powershell
docker compose -f docker-compose.monitoring.yml down
```

## Healthchecks

The Compose stack includes healthchecks for:

- FastAPI via `/health`
- Node via `/health`
- Prometheus via `/-/healthy`
- Grafana via `/api/health`

Check container health with:

```powershell
docker compose -f docker-compose.monitoring.yml ps
```

## Verification

After startup, verify these URLs:

- FastAPI health: `http://127.0.0.1:8000/health`
- Node health: `http://127.0.0.1:5000/health`
- Prometheus targets: `http://127.0.0.1:9090/targets`
- Grafana: `http://127.0.0.1:3001`

Metrics endpoints:

- FastAPI JSON metrics: `http://127.0.0.1:8000/metrics`
- FastAPI Prometheus metrics: `http://127.0.0.1:8000/metrics/prometheus`
- Node JSON metrics: `http://127.0.0.1:5000/metrics`
- Node Prometheus metrics: `http://127.0.0.1:5000/metrics/prometheus`

Log telemetry metrics now exported by both backends:

- `chatterbate_log_count_total`
- `chatterbate_log_error_total`
- `chatterbate_log_latency_ms` (histogram)
- `chatterbate_log_level` (gauge)
- `chatterbate_log_rate` (gauge)

## Grafana Provisioning

Grafana is provisioned automatically at startup.

Provisioned items:

- Prometheus datasource
- Chatterbate dashboard from [grafana.dashboard.json](grafana.dashboard.json)
- Provisioning directories for `datasources`, `dashboards`, `alerting`, and `plugins`

Default Grafana login:

- Username: `admin`
- Password: `admin`

## Prometheus Rules

Prometheus loads alert rules from [alert.rules.yml](alert.rules.yml).

Current rules include:

- `BackendDown`
- `DataIntegrityFailure`
- `ProblemCountNonZero`
- `MemorySpike`
- `UptimeReset`

## Troubleshooting

If `docker` is not recognized in PowerShell:

1. Install Docker Desktop.
2. Start Docker Desktop.
3. Open a new PowerShell window.
4. Re-run the Compose command.

If FastAPI fails to start:

- confirm `.env` contains required values like `CB_USERNAME`
- confirm [requirements.txt](requirements.txt) includes `uvicorn`

If Prometheus targets stay down:

- run `docker compose -f docker-compose.monitoring.yml ps`
- inspect logs with `docker compose -f docker-compose.monitoring.yml logs -f`
- confirm ports `8000` and `5000` are not already occupied by host processes

If Grafana starts without the dashboard:

- confirm [grafana.dashboard.json](grafana.dashboard.json) exists
- confirm provisioning files exist under [monitoring/grafana/provisioning](monitoring/grafana/provisioning)
- restart the stack after provisioning changes
