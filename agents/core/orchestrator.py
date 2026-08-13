from typing import Any, Dict, List, Optional


class EventBus:
    def __init__(self) -> None:
        self.events: List[Dict[str, Any]] = []

    def emit(self, event_type: str, payload: Optional[Dict[str, Any]] = None) -> None:
        self.events.append({"type": event_type, "payload": payload})

    def get_events(self) -> List[Dict[str, Any]]:
        return self.events
