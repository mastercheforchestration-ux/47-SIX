from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ProfilePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    role: str
    business: str
    username: str | None = None
    bio: str | None = None
    tags: list[str] = Field(default_factory=list)
    status: Literal["online", "offline"] | None = None


class MessageEntry(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    from_name: str = Field(alias="from")
    text: str
    time: str | None = None


class MessagesPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    messages: list[MessageEntry]


class AnalyticsPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    visits: int = Field(ge=0)
    messages: int = Field(ge=0)
    conversion_rate: float = Field(ge=0, le=1)


FILE_MODELS = {
    "profile.json": ProfilePayload,
    "messages.json": MessagesPayload,
    "analytics.json": AnalyticsPayload,
}