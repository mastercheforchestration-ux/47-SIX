# Deployment Guide

This project now includes a production-oriented Compose profile with a reverse proxy and internal-only backend service networking.

## Artifacts

- Production Compose stack: [docker-compose.production.yml](docker-compose.production.yml)
- Node runtime image: [Dockerfile.node](Dockerfile.node)
- FastAPI runtime image: [Dockerfile.fastapi](Dockerfile.fastapi)
- Nginx reverse proxy config: [deployment/nginx/default.conf](deployment/nginx/default.conf)
- Release workflow: [.github/workflows/release.yml](.github/workflows/release.yml)

## Configure Environment

Start with your existing `.env` and ensure these values are present:

- `CB_USERNAME`
- `CB_PASSWORD`
- `CB_EVENT_URL`
- `LOG_LEVEL`
- `AGENTS_DATA_DIR`
- `GRAFANA_ADMIN_USER`
- `GRAFANA_ADMIN_PASSWORD`

You can copy defaults from [.env.example](.env.example).

## Start Production Profile

```powershell
docker compose -f docker-compose.production.yml up --build -d
```

## Verify Health

```powershell
docker compose -f docker-compose.production.yml ps
```

Expected healthy services:

- `fastapi`
- `node`
- `prometheus`
- `grafana`
- `reverse-proxy`

## Routed Endpoints Through Nginx

- Reverse proxy health: `http://127.0.0.1/healthz`
- FastAPI API: `http://127.0.0.1/api/fastapi/health`
- Node API: `http://127.0.0.1/api/node/health`
- Grafana UI: `http://127.0.0.1/grafana/`

## Stop Production Profile

```powershell
docker compose -f docker-compose.production.yml down
```

## Notes

- The reverse proxy is HTTP-only by default. Add TLS termination (Traefik, Nginx certs, or an external load balancer) before internet exposure.
- Grafana uses a persistent volume (`grafana-data`) for durable state.
- Both backends now emit structured JSON logs and include per-request IDs and latency telemetry.
- Container image publishing is automated on version tags (`v*.*.*`) through the release workflow to GHCR.
