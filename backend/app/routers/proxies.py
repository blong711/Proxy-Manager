from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from beanie.operators import In
from app.models.proxy import Proxy, ProxyProtocol, ProxyStatus
from app.services.proxy_checker import check_and_update_proxy, check_all_proxies

router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────────

class ProxyCreate(BaseModel):
    ip: str
    port: int
    username: Optional[str] = None
    password: Optional[str] = None
    protocol: ProxyProtocol = ProxyProtocol.HTTP
    provider_name: Optional[str] = None
    expire_at: Optional[datetime] = None
    cost: Optional[float] = None
    note: Optional[str] = None


class ProxyUpdate(BaseModel):
    ip: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    protocol: Optional[ProxyProtocol] = None
    provider_name: Optional[str] = None
    expire_at: Optional[datetime] = None
    cost: Optional[float] = None
    note: Optional[str] = None


class ImportBody(BaseModel):
    text: str
    protocol: ProxyProtocol = ProxyProtocol.HTTP
    provider_name: Optional[str] = None
    cost: Optional[float] = None


def parse_proxy_line(line: str, protocol: ProxyProtocol, provider_name: Optional[str], cost: Optional[float]) -> Optional[Proxy]:
    """Parse lines like: ip:port, ip:port:user:pass, user:pass@ip:port"""
    line = line.strip()
    if not line or line.startswith("#"):
        return None

    try:
        # Format: user:pass@ip:port
        if "@" in line:
            auth, host = line.rsplit("@", 1)
            username, password = auth.split(":", 1)
            ip, port_str = host.rsplit(":", 1)
        else:
            parts = line.split(":")
            if len(parts) == 2:
                ip, port_str = parts
                username, password = None, None
            elif len(parts) == 4:
                ip, port_str, username, password = parts
            else:
                return None

        return Proxy(
            ip=ip.strip(),
            port=int(port_str.strip()),
            username=username.strip() if username else None,
            password=password.strip() if password else None,
            protocol=protocol,
            provider_name=provider_name,
            cost=cost,
        )
    except Exception:
        return None


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("")
async def list_proxies(
    status: Optional[ProxyStatus] = None,
    provider_name: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    query = {}
    if status:
        query["status"] = status
    if provider_name:
        query["provider_name"] = provider_name

    proxies = await Proxy.find(query).skip(skip).limit(limit).to_list()
    total = await Proxy.find(query).count()
    return {"data": proxies, "total": total, "skip": skip, "limit": limit}


@router.post("", status_code=201)
async def create_proxy(body: ProxyCreate):
    proxy = Proxy(**body.model_dump())
    await proxy.insert()
    return proxy


@router.post("/import")
async def import_proxies(body: ImportBody):
    lines = body.text.strip().splitlines()
    created = []
    failed_lines = 0

    for line in lines:
        proxy = parse_proxy_line(line, body.protocol, body.provider_name, body.cost)
        if proxy:
            await proxy.insert()
            created.append(proxy)
        else:
            failed_lines += 1

    return {
        "imported": len(created),
        "failed": failed_lines,
        "proxies": created,
    }


@router.get("/{proxy_id}")
async def get_proxy(proxy_id: str):
    proxy = await Proxy.get(proxy_id)
    if not proxy:
        raise HTTPException(status_code=404, detail="Proxy not found")
    return proxy


@router.put("/{proxy_id}")
async def update_proxy(proxy_id: str, body: ProxyUpdate):
    proxy = await Proxy.get(proxy_id)
    if not proxy:
        raise HTTPException(status_code=404, detail="Proxy not found")

    update_data = body.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(proxy, key, value)
    await proxy.save()
    return proxy


@router.delete("/{proxy_id}")
async def delete_proxy(proxy_id: str):
    proxy = await Proxy.get(proxy_id)
    if not proxy:
        raise HTTPException(status_code=404, detail="Proxy not found")
    await proxy.delete()
    return {"message": "Proxy deleted"}


@router.post("/{proxy_id}/check")
async def check_proxy(proxy_id: str):
    proxy = await Proxy.get(proxy_id)
    if not proxy:
        raise HTTPException(status_code=404, detail="Proxy not found")
    updated = await check_and_update_proxy(proxy)
    return updated


@router.post("/check-all/run")
async def check_all(background_tasks: BackgroundTasks):
    proxies = await Proxy.find_all().to_list()

    async def run_check():
        await check_all_proxies(proxies)

    background_tasks.add_task(run_check)
    return {"message": f"Started checking {len(proxies)} proxies in background"}
