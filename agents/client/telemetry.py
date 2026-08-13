from __future__ import annotations

from typing import Any

LOG_LEVEL_VALUE = {
    "error": 0,
    "warn": 1,
    "warning": 1,
    "info": 2,
    "debug": 3,
    "critical": 4,
}

HISTOGRAM_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1000]

_state: dict[str, Any] = {
    "log_count_total": 0,
    "log_error_total": 0,
    "request_latency_sum_ms": 0.0,
    "request_latency_count": 0,
    "latency_bucket_counts": {bucket: 0 for bucket in HISTOGRAM_BUCKETS_MS},
}


def record_log_event(level: str) -> None:
    normalized = str(level).lower()
    _state["log_count_total"] += 1
    if normalized in {"error", "critical"}:
        _state["log_error_total"] += 1


def observe_request_latency_ms(value: float) -> None:
    duration_ms = float(value)
    if duration_ms < 0:
        return

    _state["request_latency_sum_ms"] += duration_ms
    _state["request_latency_count"] += 1

    for bucket in HISTOGRAM_BUCKETS_MS:
        if duration_ms <= bucket:
            _state["latency_bucket_counts"][bucket] += 1


def get_log_metrics_snapshot(uptime_seconds: float, log_level: str) -> dict[str, float | int]:
    uptime = float(uptime_seconds) if uptime_seconds > 0 else 0.0
    rate = (_state["log_count_total"] / uptime) if uptime > 0 else 0.0

    return {
        "log_count_total": int(_state["log_count_total"]),
        "log_error_total": int(_state["log_error_total"]),
        "log_latency_count": int(_state["request_latency_count"]),
        "log_latency_sum_ms": round(float(_state["request_latency_sum_ms"]), 3),
        "log_rate_per_second": round(rate, 6),
        "log_level_value": LOG_LEVEL_VALUE.get(str(log_level).lower(), 2),
    }


def render_log_prometheus_metrics(service: str, uptime_seconds: float, log_level: str) -> str:
    uptime = float(uptime_seconds) if uptime_seconds > 0 else 0.0
    rate = (_state["log_count_total"] / uptime) if uptime > 0 else 0.0
    level = str(log_level).lower()
    level_value = LOG_LEVEL_VALUE.get(level, 2)

    lines = [
        "# HELP chatterbate_log_count_total Total number of logs emitted.",
        "# TYPE chatterbate_log_count_total counter",
        f'chatterbate_log_count_total{{service="{service}"}} {_state["log_count_total"]}',
        "# HELP chatterbate_log_error_total Total number of error logs emitted.",
        "# TYPE chatterbate_log_error_total counter",
        f'chatterbate_log_error_total{{service="{service}"}} {_state["log_error_total"]}',
        "# HELP chatterbate_log_latency_ms Latency histogram for handled requests in milliseconds.",
        "# TYPE chatterbate_log_latency_ms histogram",
    ]

    for bucket in HISTOGRAM_BUCKETS_MS:
        lines.append(
            f'chatterbate_log_latency_ms_bucket{{service="{service}",le="{bucket}"}} {_state["latency_bucket_counts"][bucket]}'
        )

    lines.extend(
        [
            f'chatterbate_log_latency_ms_bucket{{service="{service}",le="+Inf"}} {_state["request_latency_count"]}',
            f'chatterbate_log_latency_ms_sum{{service="{service}"}} {round(float(_state["request_latency_sum_ms"]), 3)}',
            f'chatterbate_log_latency_ms_count{{service="{service}"}} {_state["request_latency_count"]}',
            "# HELP chatterbate_log_level Gauge value for active log level.",
            "# TYPE chatterbate_log_level gauge",
            f'chatterbate_log_level{{service="{service}",level="{level}"}} {level_value}',
            "# HELP chatterbate_log_rate Average logs per second since process start.",
            "# TYPE chatterbate_log_rate gauge",
            f'chatterbate_log_rate{{service="{service}"}} {round(rate, 6)}',
        ]
    )

    return "\n".join(lines)
