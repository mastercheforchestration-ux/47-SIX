import json
import logging

from client.config import settings
from client.integrity import load_json_file
from client.schemas import AnalyticsPayload

logger = logging.getLogger("agents.analytics")

class AnalyticsAgent:
    def generate_report(self):
        logger.info("Generating analytics report")

        try:
            load_json_file(settings.data_dir, "profile.json")
        except (FileNotFoundError, ValueError):
            pass

        try:
            messages_payload = load_json_file(settings.data_dir, "messages.json")
        except FileNotFoundError:
            messages_payload = {"messages": []}

        report = AnalyticsPayload(
            visits=settings.analytics_default_visits,
            messages=len(messages_payload["messages"]),
            conversion_rate=settings.analytics_default_conversion_rate,
        ).model_dump()

        settings.data_dir.mkdir(parents=True, exist_ok=True)
        with open(settings.data_dir / "analytics.json", "w", encoding="utf-8") as f:
            json.dump(report, f, indent=4)

        logger.info("Analytics report written to client/data/analytics.json")
