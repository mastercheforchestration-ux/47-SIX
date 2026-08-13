import logging
import os
import json
from datetime import datetime, timezone
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from client.telemetry import record_log_event

ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DATA_DIR = ROOT_DIR / "client" / "data"
DEFAULT_EVENT_URL = "https://eventsapi.chaturbate.com/events/47andsix/DAavfieQYdUKCEiF0iWvcjZJ/"
DEFAULT_LOG_LEVEL = "INFO"
VALID_LOG_LEVELS = {"CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"}

load_dotenv(ROOT_DIR / ".env")


def _resolve_data_dir(value: str | None) -> Path:
    if not value:
        return DEFAULT_DATA_DIR

    candidate = Path(value)
    if candidate.is_absolute():
        return candidate

    return ROOT_DIR / candidate


def _resolve_log_level(value: str | None) -> str:
    candidate = (value or DEFAULT_LOG_LEVEL).upper()
    return candidate if candidate in VALID_LOG_LEVELS else DEFAULT_LOG_LEVEL


@dataclass(frozen=True)
class Settings:
    cb_username: str
    cb_password: str | None
    cb_event_url: str
    profile_display_name: str
    profile_role: str
    profile_business: str
    analytics_default_visits: int
    analytics_default_conversion_rate: float
    log_level: str
    data_dir: Path


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    cb_username = os.getenv("CB_USERNAME")
    if not cb_username:
        raise RuntimeError("Missing CB_USERNAME in environment or .env")

    return Settings(
        cb_username=cb_username,
        cb_password=os.getenv("CB_PASSWORD"),
        cb_event_url=os.getenv("CB_EVENT_URL", DEFAULT_EVENT_URL),
        profile_display_name=os.getenv("PROFILE_DISPLAY_NAME", "Jesse"),
        profile_role=os.getenv("PROFILE_ROLE", "Executive Chef"),
        profile_business=os.getenv("PROFILE_BUSINESS", "47-and-SIX"),
        analytics_default_visits=int(os.getenv("ANALYTICS_DEFAULT_VISITS", "120")),
        analytics_default_conversion_rate=float(os.getenv("ANALYTICS_DEFAULT_CONVERSION_RATE", "0.31")),
        log_level=_resolve_log_level(os.getenv("LOG_LEVEL")),
        data_dir=_resolve_data_dir(os.getenv("AGENTS_DATA_DIR")),
    )


settings = get_settings()


class JsonLogFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        for field in ("request_id", "method", "path", "status_code", "duration_ms"):
            value = getattr(record, field, None)
            if value is not None:
                payload[field] = value

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(payload, ensure_ascii=True)


class MetricsJsonStreamHandler(logging.StreamHandler):
    def emit(self, record: logging.LogRecord) -> None:
        record_log_event(record.levelname)
        super().emit(record)


def configure_logging() -> None:
    root_logger = logging.getLogger()
    configured_level = getattr(logging, settings.log_level, logging.INFO)
    formatter = JsonLogFormatter()

    root_logger.handlers.clear()
    handler = MetricsJsonStreamHandler()
    handler.setFormatter(formatter)
    root_logger.addHandler(handler)
    root_logger.setLevel(configured_level)


def get_config_health_report() -> dict:
    return {
        "cb_username_present": bool(settings.cb_username),
        "cb_password_present": bool(settings.cb_password),
        "event_url_present": bool(settings.cb_event_url),
        "log_level": settings.log_level,
        "data_dir": str(settings.data_dir),
    }