from beanie import Document
from pydantic import Field
from typing import Optional, Any
from datetime import datetime, timezone


class Provider(Document):
    name: str
    api_url: Optional[str] = None
    api_key: Optional[str] = None
    config: Optional[dict[str, Any]] = None
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    class Settings:
        name = "providers"
