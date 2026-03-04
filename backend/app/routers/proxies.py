from fastapi import APIRouter, HTTPException, BackgroundTasks, Query, Depends
from pydantic import BaseModel
from typing import Optional
import re
from datetime import datetime, timezone
from app.models.proxy import Proxy, ProxyProtocol, ProxyStatus
from app.models.user import User, UserRole
from app.routers.auth import get_current_user
from app.services.proxy_checker import check_and_update_proxy, check_all_proxies

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────

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
    auto_check: bool = True  # tự động check sau import


_PROTO_RE = re.compile(r"^(https?|socks[45])://", re.IGNORECASE)


def parse_proxy_line(line: str, protocol: ProxyProtocol, provider_name: Optional[str], cost: Optional[float]) -> Optional[Proxy]:
    line = line.strip()
    if not line or line.startswith("#"):
        return None
    try:
        # Bóc tách protocol prefix: http:// https:// socks4:// socks5://
        cleaned = _PROTO_RE.sub("", line)

        if "@" in cleaned:
            auth, host = cleaned.rsplit("@", 1)
            username, password = auth.split(":", 1)
            ip, port_str = host.rsplit(":", 1)
        else:
            parts = cleaned.split(":")
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


def _owner_filter(current_user: User) -> dict:
    """Return a filter dict: empty for admin (see all), or owner filter for user."""
    if current_user.role == UserRole.ADMIN:
        return {}
    return {"owner": current_user.username}


async def _get_proxy_owned(proxy_id: str, current_user: User) -> Proxy:
    proxy = await Proxy.get(proxy_id)
    if not proxy:
        raise HTTPException(status_code=404, detail="Proxy not found")
    if current_user.role != UserRole.ADMIN and proxy.owner != current_user.username:
        raise HTTPException(status_code=403, detail="Access denied")
    return proxy


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("")
async def list_proxies(
    status: Optional[ProxyStatus] = None,
    provider_name: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
):
    query = _owner_filter(current_user)
    if status:
        query["status"] = status
    if provider_name:
        query["provider_name"] = provider_name

    proxies = await Proxy.find(query).skip(skip).limit(limit).to_list()
    total = await Proxy.find(query).count()
    return {"data": proxies, "total": total, "skip": skip, "limit": limit}


@router.post("", status_code=201)
async def create_proxy(
    body: ProxyCreate,
    current_user: User = Depends(get_current_user),
):
    proxy = Proxy(**body.model_dump(), owner=current_user.username)
    await proxy.insert()
    return proxy


@router.post("/import")
async def import_proxies(
    body: ImportBody,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    lines = body.text.strip().splitlines()
    created = []
    failed_lines = 0

    for line in lines:
        proxy = parse_proxy_line(line, body.protocol, body.provider_name, body.cost)
        if proxy:
            proxy.owner = current_user.username
            await proxy.insert()
            created.append(proxy)
        else:
            failed_lines += 1

    # Auto-check proxy vừa import trong background
    if body.auto_check and created:
        async def run_check():
            await check_all_proxies(created)

        background_tasks.add_task(run_check)

    return {
        "imported": len(created),
        "failed": failed_lines,
        "proxies": created,
        "checking": body.auto_check and len(created) > 0,
    }

class CheckRawBody(BaseModel):
    proxy_url: str  # format: protocol://ip:port hoặc ip:port


class CheckBatchItem(BaseModel):
    proxy_url: str
    username: Optional[str] = None
    password: Optional[str] = None


class CheckBatchBody(BaseModel):
    proxies: list[CheckBatchItem]


@router.post("/check-batch")
async def check_batch_proxies(
    body: CheckBatchBody,
    current_user: User = Depends(get_current_user),
):
    """Check a batch of raw proxies (not saved to DB) — dùng cho preview."""
    import asyncio
    from app.services.proxy_checker import check_single_proxy, _get_real_ip

    real_ip = await _get_real_ip()
    semaphore = asyncio.Semaphore(30)

    async def check_one(item: CheckBatchItem) -> dict:
        async with semaphore:
            proxy_url = item.proxy_url
            # Parse proxy_url
            cleaned = _PROTO_RE.sub("", proxy_url)
            parts = cleaned.split(":")
            if len(parts) != 2:
                return {"proxy_url": proxy_url, "status": "die", "quality": "bad",
                        "latency": None, "anonymity": None, "country": None}

            ip, port_str = parts
            try:
                port = int(port_str)
            except ValueError:
                return {"proxy_url": proxy_url, "status": "die", "quality": "bad",
                        "latency": None, "anonymity": None, "country": None}

            # Detect protocol
            proto_match = re.match(r"^(https?|socks[45])://", proxy_url, re.IGNORECASE)
            protocol = ProxyProtocol.HTTP
            if proto_match:
                p = proto_match.group(1).lower()
                protocol = {"http": ProxyProtocol.HTTP, "https": ProxyProtocol.HTTPS,
                            "socks4": ProxyProtocol.SOCKS5, "socks5": ProxyProtocol.SOCKS5
                            }.get(p, ProxyProtocol.HTTP)

            temp_proxy = Proxy(
                ip=ip.strip(), port=port, protocol=protocol,
                username=item.username, password=item.password,
                owner=current_user.username,
            )
            result = await check_single_proxy(temp_proxy, real_ip)

            return {
                "proxy_url": proxy_url,
                "ip": ip.strip(),
                "port": port,
                "status": result["status"].value,
                "quality": result["quality"].value,
                "latency": result.get("latency"),
                "anonymity": result["anonymity"].value if result.get("anonymity") else None,
                "country": result.get("country"),
            }

    tasks = [check_one(item) for item in body.proxies]
    raw_results = await asyncio.gather(*tasks, return_exceptions=True)

    final_results = []
    for i, r in enumerate(raw_results):
        if isinstance(r, Exception):
            final_results.append({
                "proxy_url": body.proxies[i].proxy_url,
                "status": "die", "quality": "bad",
                "latency": None, "anonymity": None, "country": None,
            })
        else:
            final_results.append(r)

    return {"results": final_results}


@router.post("/check-raw")
async def check_raw_proxy(
    body: CheckRawBody,
    current_user: User = Depends(get_current_user),
):
    """Check 1 proxy chưa import — dùng cho preview."""
    from app.services.proxy_checker import check_single_proxy, _get_real_ip

    # Parse proxy_url
    cleaned = _PROTO_RE.sub("", body.proxy_url)
    parts = cleaned.split(":")
    if len(parts) != 2:
        raise HTTPException(400, "Invalid proxy format")

    ip, port_str = parts
    try:
        port = int(port_str)
    except ValueError:
        raise HTTPException(400, "Invalid port")

    # Detect protocol from URL
    proto_match = re.match(r"^(https?|socks[45])://", body.proxy_url, re.IGNORECASE)
    protocol = ProxyProtocol.HTTP
    if proto_match:
        p = proto_match.group(1).lower()
        protocol = {"http": ProxyProtocol.HTTP, "https": ProxyProtocol.HTTPS,
                     "socks4": ProxyProtocol.SOCKS5, "socks5": ProxyProtocol.SOCKS5}.get(p, ProxyProtocol.HTTP)

    # Tạo proxy tạm (không lưu DB)
    temp_proxy = Proxy(ip=ip, port=port, protocol=protocol, owner=current_user.username)
    real_ip = await _get_real_ip()
    result = await check_single_proxy(temp_proxy, real_ip)

    return {
        "ip": ip,
        "port": port,
        "status": result["status"].value,
        "quality": result["quality"].value,
        "latency": result.get("latency"),
        "anonymity": result["anonymity"].value if result.get("anonymity") else None,
        "country": result.get("country"),
    }


@router.get("/{proxy_id}")
async def get_proxy(
    proxy_id: str,
    current_user: User = Depends(get_current_user),
):
    return await _get_proxy_owned(proxy_id, current_user)


@router.put("/{proxy_id}")
async def update_proxy(
    proxy_id: str,
    body: ProxyUpdate,
    current_user: User = Depends(get_current_user),
):
    proxy = await _get_proxy_owned(proxy_id, current_user)
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(proxy, key, value)
    await proxy.save()
    return proxy


@router.delete("/{proxy_id}")
async def delete_proxy(
    proxy_id: str,
    current_user: User = Depends(get_current_user),
):
    proxy = await _get_proxy_owned(proxy_id, current_user)
    await proxy.delete()
    return {"message": "Proxy deleted"}


@router.post("/{proxy_id}/check")
async def check_proxy(
    proxy_id: str,
    current_user: User = Depends(get_current_user),
):
    proxy = await _get_proxy_owned(proxy_id, current_user)
    updated = await check_and_update_proxy(proxy)
    return updated


@router.post("/check-all/run")
async def check_all(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    query = _owner_filter(current_user)
    proxies = await Proxy.find(query).to_list()

    async def run_check():
        await check_all_proxies(proxies)

    background_tasks.add_task(run_check)
    return {"message": f"Started checking {len(proxies)} proxies in background"}
