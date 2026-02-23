from beanie import Document, PydanticObjectId
from pydantic import Field
from typing import Optional
from datetime import datetime, timezone
from enum import Enum


class AccountStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    BANNED = "banned"


class Account(Document):
    username: str
    password: str
    platform: str
    note: Optional[str] = None
    status: AccountStatus = AccountStatus.ACTIVE
    proxy_id: Optional[PydanticObjectId] = None
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    class Settings:
        name = "accounts"
