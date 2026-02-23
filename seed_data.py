import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie, Document, PydanticObjectId
from pydantic import Field
from typing import Optional
from datetime import datetime, timezone, timedelta
from enum import Enum

# Sao chép các models để script độc lập
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
    last_check: Optional[datetime] = None
    latency: Optional[float] = None
    note: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    class Settings:
        name = "proxies"

async def seed():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    await init_beanie(database=client.proxy_manager, document_models=[Proxy])
    
    # Xóa dữ liệu cũ nếu có
    await Proxy.find_all().delete()
    
    now = datetime.now(timezone.utc)
    
    proxies = [
        Proxy(ip="45.77.248.10", port=8080, protocol="http", provider_name="Vultr", status="live", latency=120.5, cost=5.0, expire_at=now + timedelta(days=30)),
        Proxy(ip="139.180.130.5", port=3128, protocol="https", provider_name="Vultr", status="live", latency=85.2, cost=5.0, expire_at=now + timedelta(days=1)),
        Proxy(ip="103.153.75.22", port=1080, protocol="socks5", provider_name="Viettel", status="die", cost=2.5, expire_at=now + timedelta(days=15)),
        Proxy(ip="1.55.210.43", port=8000, username="user1", password="pass1", protocol="http", provider_name="Tinsoft", status="unchecked", cost=1.0, expire_at=now + timedelta(hours=5)),
        Proxy(ip="171.244.15.110", port=8888, protocol="http", provider_name="TMProxy", status="timeout", cost=1.5, expire_at=now + timedelta(days=10)),
        Proxy(ip="27.72.105.12", port=9999, protocol="http", provider_name="ProxyViet", status="live", latency=450.0, cost=3.0, expire_at=now + timedelta(days=2)),
    ]
    
    for p in proxies:
        await p.insert()
    
    print(f"✅ Đã seed thành công {len(proxies)} proxies!")

if __name__ == "__main__":
    asyncio.run(seed())
