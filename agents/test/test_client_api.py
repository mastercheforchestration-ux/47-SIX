import json
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from client import main


class ClientApiTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.data_dir = Path(self.tempdir.name)
        self.original_data_dir = main.DATA_DIR
        main.DATA_DIR = self.data_dir

    def tearDown(self):
        main.DATA_DIR = self.original_data_dir
        self.tempdir.cleanup()

    def write_json(self, filename, payload):
        (self.data_dir / filename).write_text(json.dumps(payload), encoding="utf-8")

    def test_startup_rejects_malformed_json(self):
        self.write_json("profile.json", {"name": "Jesse"})
        self.write_json("messages.json", {"messages": []})
        (self.data_dir / "analytics.json").write_text("{", encoding="utf-8")

        with self.assertRaises(RuntimeError):
            with TestClient(main.app):
                pass

    def test_startup_rejects_schema_mismatch(self):
        self.write_json("profile.json", {"name": "Jesse", "role": "Executive Chef", "business": "47-and-SIX"})
        self.write_json("messages.json", [{"from": "client", "text": "Hello"}])
        self.write_json("analytics.json", {"visits": 120, "messages": 42, "conversion_rate": 0.31})

        with self.assertRaises(RuntimeError):
            with TestClient(main.app):
                pass

    def test_endpoints_return_shared_json(self):
        self.write_json("profile.json", {"name": "Jesse", "role": "Executive Chef", "business": "47-and-SIX"})
        self.write_json("messages.json", {"messages": [{"from": "client", "text": "Hello"}]})
        self.write_json("analytics.json", {"visits": 120, "messages": 42, "conversion_rate": 0.31})

        with TestClient(main.app) as client:
            self.assertEqual(client.get("/profile").json(), {"name": "Jesse", "role": "Executive Chef", "business": "47-and-SIX"})
            self.assertEqual(client.get("/messages").json(), {"messages": [{"from": "client", "text": "Hello"}]})
            self.assertEqual(client.get("/analytics").json(), {"visits": 120, "messages": 42, "conversion_rate": 0.31})

    def test_health_reports_ok(self):
        self.write_json("profile.json", {"name": "Jesse", "role": "Executive Chef", "business": "47-and-SIX"})
        self.write_json("messages.json", {"messages": [{"from": "client", "text": "Hello"}]})
        self.write_json("analytics.json", {"visits": 120, "messages": 42, "conversion_rate": 0.31})

        with TestClient(main.app) as client:
            response = client.get("/health")
            self.assertEqual(response.status_code, 200)
            payload = response.json()
            self.assertEqual(payload["status"], "ok")
            self.assertTrue(payload["data"]["ok"])

    def test_metrics_reports_runtime_state(self):
        self.write_json("profile.json", {"name": "Jesse", "role": "Executive Chef", "business": "47-and-SIX"})
        self.write_json("messages.json", {"messages": [{"from": "client", "text": "Hello"}]})
        self.write_json("analytics.json", {"visits": 120, "messages": 42, "conversion_rate": 0.31})

        with TestClient(main.app) as client:
            response = client.get("/metrics")
            self.assertEqual(response.status_code, 200)
            payload = response.json()
            self.assertEqual(payload["service"], "fastapi")
            self.assertIn("uptime_seconds", payload)
            self.assertIn("log_level", payload)
            self.assertTrue(payload["data_ok"])

    def test_prometheus_metrics_endpoint(self):
        self.write_json("profile.json", {"name": "Jesse", "role": "Executive Chef", "business": "47-and-SIX"})
        self.write_json("messages.json", {"messages": [{"from": "client", "text": "Hello"}]})
        self.write_json("analytics.json", {"visits": 120, "messages": 42, "conversion_rate": 0.31})

        with TestClient(main.app) as client:
            response = client.get("/metrics/prometheus")
            self.assertEqual(response.status_code, 200)
            self.assertIn("text/plain", response.headers.get("content-type", ""))
            self.assertIn("# HELP chatterbate_up", response.text)
            self.assertIn('chatterbate_up{service="fastapi"}', response.text)
