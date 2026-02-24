import asyncio
import time
import httpx
from datetime import datetime, timezone
from app.models.proxy import Proxy, ProxyStatus

CHECK_URL = "http://httpbin.org/ip"
TIMEOUT = 10.0


async def check_single_proxy(proxy: Proxy) -> dict:
    """Check a single proxy and return status + latency."""
    proxy_url = proxy.connection_string
    start = time.monotonic()

    try:
        async with httpx.AsyncClient(
            proxy=proxy_url,
            timeout=httpx.Timeout(TIMEOUT),
            follow_redirects=True,
        ) as client:
            response = await client.get(CHECK_URL)
            elapsed_ms = round((time.monotonic() - start) * 1000, 2)

            if response.status_code == 200:
                return {"status": ProxyStatus.LIVE, "latency": elapsed_ms}
            else:
                return {"status": ProxyStatus.DIE, "latency": None}

    except httpx.ProxyError:
        return {"status": ProxyStatus.AUTH_FAILED, "latency": None}
    except httpx.TimeoutException:
        return {"status": ProxyStatus.TIMEOUT, "latency": None}
    except Exception:
        return {"status": ProxyStatus.DIE, "latency": None}


async def check_and_update_proxy(proxy: Proxy) -> Proxy:
    """Check proxy status and persist result to DB."""
    result = await check_single_proxy(proxy)
    proxy.status = result["status"]
    proxy.latency = result.get("latency")
    proxy.last_check = datetime.now(timezone.utc)
    await proxy.save()
    return proxy


async def check_all_proxies(proxies: list[Proxy]) -> list[Proxy]:
    """Check all proxies concurrently with semaphore limit."""
    semaphore = asyncio.Semaphore(20)  # max 20 concurrent checks

    async def bounded_check(proxy: Proxy) -> Proxy:
        async with semaphore:
            return await check_and_update_proxy(proxy)

    results = await asyncio.gather(
        *[bounded_check(p) for p in proxies], return_exceptions=True
    )
    return [r for r in results if isinstance(r, Proxy)]
