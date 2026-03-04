from beanie import Document, PydanticObjectId
from pydantic import Field
from typing import Optional
from datetime import datetime, timezone
from enum import Enum


class ProxyProtocol(str, Enum):
    HTTP = "http"
    HTTPS = "https"
    SOCKS5 = "socks5"


class ProxyStatus(str, Enum):
    LIVE = "live"
    DIE = "die"
    TIMEOUT = "timeout"
    AUTH_FAILED = "auth_failed"
    UNCHECKED = "unchecked"


class ProxyQuality(str, Enum):
    GOOD = "good"       # live + latency < 2000ms
    BAD = "bad"         # die / timeout / slow > 5000ms
    UNKNOWN = "unknown" # unchecked


class ProxyAnonymity(str, Enum):
    TRANSPARENT = "transparent"  # leaks real IP
    ANONYMOUS = "anonymous"      # hides IP but detectable
    ELITE = "elite"              # fully anonymous


class Proxy(Document):
    ip: str
    port: int
    username: Optional[str] = None
    password: Optional[str] = None
    protocol: ProxyProtocol = ProxyProtocol.HTTP
    provider_name: Optional[str] = None
    expire_at: Optional[datetime] = None
    cost: Optional[float] = None
    status: ProxyStatus = ProxyStatus.UNCHECKED
    quality: ProxyQuality = ProxyQuality.UNKNOWN
    last_check: Optional[datetime] = None
    latency: Optional[float] = None  # milliseconds
    check_count: int = 0
    anonymity: Optional[ProxyAnonymity] = None
    country: Optional[str] = None
    note: Optional[str] = None
    provider_id: Optional[PydanticObjectId] = None
    owner: str = ""  # username of the creator
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    @property
    def connection_string(self) -> str:
        if self.username and self.password:
            return f"{self.protocol}://{self.username}:{self.password}@{self.ip}:{self.port}"
        return f"{self.protocol}://{self.ip}:{self.port}"

    class Settings:
        name = "proxies"
