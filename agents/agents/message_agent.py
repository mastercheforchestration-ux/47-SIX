import json
import logging
from typing import Dict, List

import requests
from bs4 import BeautifulSoup

from client.config import settings
from client.schemas import MessageEntry, MessagesPayload

logger = logging.getLogger("agents.message")


class MessageAgent:
	def sync_messages(self) -> Dict[str, int]:
		logger.info("Syncing Chatterbate messages")

		if not settings.cb_password:
			raise ValueError("Missing CB_PASSWORD in .env")

		session = requests.Session()

		login_page = session.get("https://chaturbate.com/auth/login/", timeout=20)
		login_page.raise_for_status()
		soup = BeautifulSoup(login_page.text, "html.parser")

		csrf_input = soup.find("input", {"name": "csrfmiddlewaretoken"})
		if csrf_input is None:
			raise RuntimeError("Unable to find CSRF token on login page")

		csrf = csrf_input.get("value")
		if not csrf:
			raise RuntimeError("CSRF token value missing")

		payload = {
			"username": settings.cb_username,
			"password": settings.cb_password,
			"csrfmiddlewaretoken": csrf,
		}

		headers = {
			"Referer": "https://chaturbate.com/auth/login/",
			"User-Agent": "Mozilla/5.0",
		}
		session.post("https://chaturbate.com/auth/login/", data=payload, headers=headers, timeout=20)

		inbox = session.get("https://chaturbate.com/messages/inbox/", timeout=20)
		inbox.raise_for_status()
		soup = BeautifulSoup(inbox.text, "html.parser")

		messages: List[Dict[str, str]] = []

		for msg in soup.select(".message"):
			username_el = msg.select_one(".username")
			body_el = msg.select_one(".body")
			time_el = msg.select_one(".timestamp")

			if not username_el or not body_el or not time_el:
				continue

			messages.append(
				MessageEntry(
					**{
						"from": username_el.get_text(strip=True),
						"text": body_el.get_text(strip=True),
						"time": time_el.get_text(strip=True),
					}
				).model_dump(by_alias=True, exclude_none=True, exclude_defaults=True)
			)

		payload = MessagesPayload(messages=messages).model_dump(by_alias=True, exclude_none=True, exclude_defaults=True)

		settings.data_dir.mkdir(parents=True, exist_ok=True)
		with open(settings.data_dir / "messages.json", "w", encoding="utf-8") as f:
			json.dump(payload, f, indent=4)

		logger.info("Messages synced")
		return {"synced": len(messages)}
