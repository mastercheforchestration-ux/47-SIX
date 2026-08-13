import logging
import time
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.responses import PlainTextResponse

from client.config import configure_logging, get_config_health_report, settings
from client.integrity import get_data_health_report, load_json_file, validate_data_directory
from client.telemetry import (
    get_log_metrics_snapshot,
    observe_request_latency_ms,
    render_log_prometheus_metrics,
)

configure_logging()

app = FastAPI()
DATA_DIR = settings.data_dir
logger = logging.getLogger("client.api")
START_TIME = time.time()


@app.on_event("startup")
def startup_validate_data() -> None:
    validate_data_directory(DATA_DIR)
    logger.info("Startup data validation complete")


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or f"req-{uuid4().hex[:12]}"
    start = time.perf_counter()

    try:
        response = await call_next(request)
    except Exception:
        duration_ms = round((time.perf_counter() - start) * 1000, 3)
        observe_request_latency_ms(duration_ms)
        logger.exception(
            "HTTP request failed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "duration_ms": duration_ms,
            },
        )
        raise

    duration_ms = round((time.perf_counter() - start) * 1000, 3)
    observe_request_latency_ms(duration_ms)
    response.headers["x-request-id"] = request_id

    logger.info(
        "HTTP request completed",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
        },
    )

    return response


def load_json(name: str):
    logger.debug("Loading JSON file %s", name)
    return load_json_file(DATA_DIR, name)


def get_runtime_metrics() -> dict:
    config = get_config_health_report()
    data = get_data_health_report(DATA_DIR)
    uptime_seconds = round(time.time() - START_TIME, 3)
    log_metrics = get_log_metrics_snapshot(uptime_seconds, config["log_level"])

    return {
        "service": "fastapi",
        "uptime_seconds": uptime_seconds,
        "status": "ok" if data["ok"] else "error",
        "data_ok": data["ok"],
        "problem_count": len(data["problems"]),
        "log_level": config["log_level"],
        **log_metrics,
        "timestamp": int(time.time()),
    }


@app.get("/profile")
def get_profile():
    return load_json("profile.json")


@app.get("/messages")
def get_messages():
    return load_json("messages.json")


@app.get("/analytics")
def get_analytics():
    return load_json("analytics.json")


@app.get("/health")
def get_health():
    config = get_config_health_report()
    data = get_data_health_report(DATA_DIR)
    healthy = data["ok"] and config["cb_username_present"] and config["event_url_present"]

    logger.debug("Health check computed status=%s", "ok" if healthy else "error")

    return {
        "status": "ok" if healthy else "error",
        "service": "fastapi",
        "config": config,
        "data": data,
    }


@app.get("/metrics")
def get_metrics():
    return get_runtime_metrics()


@app.get("/metrics/prometheus", response_class=PlainTextResponse)
def get_metrics_prometheus():
    metrics = get_runtime_metrics()
    up_value = 1 if metrics["status"] == "ok" else 0
    data_ok_value = 1 if metrics["data_ok"] else 0
    log_level = metrics["log_level"].lower()

    body = "\n".join(
        [
            "# HELP chatterbate_up Service health status where 1=ok and 0=error.",
            "# TYPE chatterbate_up gauge",
            f'chatterbate_up{{service="fastapi"}} {up_value}',
            "# HELP chatterbate_data_ok Data integrity status where 1=ok and 0=error.",
            "# TYPE chatterbate_data_ok gauge",
            f'chatterbate_data_ok{{service="fastapi"}} {data_ok_value}',
            "# HELP chatterbate_problem_count Number of data integrity problems.",
            "# TYPE chatterbate_problem_count gauge",
            f'chatterbate_problem_count{{service="fastapi"}} {metrics["problem_count"]}',
            "# HELP chatterbate_uptime_seconds Service uptime in seconds.",
            "# TYPE chatterbate_uptime_seconds gauge",
            f'chatterbate_uptime_seconds{{service="fastapi"}} {metrics["uptime_seconds"]}',
            "# HELP chatterbate_log_level_info Active log level marker metric with value 1.",
            "# TYPE chatterbate_log_level_info gauge",
            f'chatterbate_log_level_info{{service="fastapi",level="{log_level}"}} 1',
            render_log_prometheus_metrics("fastapi", metrics["uptime_seconds"], log_level),
            "# HELP chatterbate_timestamp_seconds Current UNIX timestamp.",
            "# TYPE chatterbate_timestamp_seconds gauge",
            f'chatterbate_timestamp_seconds{{service="fastapi"}} {metrics["timestamp"]}',
            "",
        ]
    )

    return body
