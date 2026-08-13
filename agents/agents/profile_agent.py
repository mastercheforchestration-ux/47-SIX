import json
import logging

import requests
from bs4 import BeautifulSoup

from client.config import settings
from client.schemas import ProfilePayload

logger = logging.getLogger("agents.profile")

class ProfileAgent:
    def update_profile(self):
        logger.info("Updating Chatterbate public profile")

        url = f"https://chaturbate.com/{settings.cb_username}/"
        response = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})

        soup = BeautifulSoup(response.text, "html.parser")

        data = ProfilePayload(
            name=settings.profile_display_name,
            role=settings.profile_role,
            business=settings.profile_business,
            username=settings.cb_username,
            bio=soup.find("div", {"class": "bio"}).text.strip() if soup.find("div", {"class": "bio"}) else None,
            tags=[tag.text for tag in soup.select(".tag")],
            status="online" if "Offline" not in response.text else "offline",
        ).model_dump(by_alias=True, exclude_none=True, exclude_defaults=True)

        settings.data_dir.mkdir(parents=True, exist_ok=True)
        with open(settings.data_dir / "profile.json", "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4)

        logger.info("Public profile updated")
