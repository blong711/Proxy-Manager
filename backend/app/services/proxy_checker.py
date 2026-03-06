import asyncio
import json
import time
import aiohttp
from datetime import datetime, timezone
from app.models.proxy import Proxy, ProxyStatus, ProxyQuality, ProxyAnonymity

# ── Check targets ──────────────────────────────────────────────────────────────
# Use multiple targets for reliability; fall back if one is down.

CHECK_TARGETS = [
    {"url": "http://ip-api.com/json/?fields=query,country,countryCode,regionName,city", "parse": "query"},
    {"url": "http://httpbin.org/ip", "parse": "origin"},
    {"url": "https://api.ipify.org?format=json", "parse": "ip"},
]

TIMEOUT = 12.0
LATENCY_GOOD_THRESHOLD = 2000    # ms — below = good
LATENCY_BAD_THRESHOLD = 5000     # ms — above = bad


# ── Core checker (aiohttp) ─────────────────────────────────────────────────────

async def _try_check(proxy: Proxy, target: dict) -> dict | None:
    """Try a single check target using aiohttp. Returns result dict or None on failure."""
    proxy_url = proxy.connection_string
    start = time.monotonic()

    timeout = aiohttp.ClientTimeout(total=TIMEOUT, connect=8)

    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(target["url"], proxy=proxy_url, ssl=False) as response:
                elapsed_ms = round((time.monotonic() - start) * 1000, 2)

                if response.status == 200:
                    text = await response.text()
                    try:
                        data = json.loads(text)
                    except (json.JSONDecodeError, ValueError):
                        data = {}
                    proxy_ip = data.get(target["parse"], "")
                    country = data.get("country") or data.get("countryCode") or None
                    region = data.get("regionName") or None
                    city = data.get("city") or None
                    # Detect IP version
                    ip_version = "IPv6" if ":" in proxy_ip else "IPv4" if proxy_ip else None
                    return {
                        "alive": True,
                        "latency": elapsed_ms,
                        "proxy_ip": proxy_ip,
                        "country": country,
                        "region": region,
                        "city": city,
                        "ip_version": ip_version,
                    }
                return None

    except aiohttp.ClientProxyConnectionError:
        return {"alive": False, "error": "auth_failed"}
    except asyncio.TimeoutError:
        return {"alive": False, "error": "timeout"}
    except aiohttp.ClientError:
        return {"alive": False, "error": "die"}
    except Exception:
        return {"alive": False, "error": "die"}


async def _get_real_ip() -> str | None:
    """Get our real IP (without proxy) for anonymity comparison."""
    timeout = aiohttp.ClientTimeout(total=5)
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get("https://api.ipify.org?format=json") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("ip")
    except Exception:
        pass
    return None


def _determine_anonymity(real_ip: str | None, proxy_ip: str, proxy_obj: Proxy) -> ProxyAnonymity:
    """Determine proxy anonymity level."""
    if not real_ip:
        return ProxyAnonymity.ANONYMOUS  # can't tell, assume anonymous
    if real_ip == proxy_ip:
        return ProxyAnonymity.TRANSPARENT  # proxy leaks our real IP
    # If proxy_ip is different from real_ip, it's at least anonymous
    # Elite = no detectable proxy headers (we can't check headers from client side,
    # so if it's hiding our IP, we call it elite for simplicity)
    return ProxyAnonymity.ELITE


def _determine_quality(status: ProxyStatus, latency: float | None) -> ProxyQuality:
    """Rate quality based on status and latency."""
    if status != ProxyStatus.LIVE:
        return ProxyQuality.BAD

    if latency is None:
        return ProxyQuality.UNKNOWN

    if latency <= LATENCY_GOOD_THRESHOLD:
        return ProxyQuality.GOOD
    elif latency >= LATENCY_BAD_THRESHOLD:
        return ProxyQuality.BAD
    else:
        # Between 2000-5000ms — acceptable but not great → still good
        return ProxyQuality.GOOD


# ── Public API ─────────────────────────────────────────────────────────────────

async def check_single_proxy(proxy: Proxy, real_ip: str | None = None) -> dict:
    """
    Comprehensive check: try multiple targets, determine status,
    quality, anonymity, country.
    """
    # Try targets in order until one works
    result = None
    for target in CHECK_TARGETS:
        result = await _try_check(proxy, target)
        if result and result.get("alive"):
            break

    if not result or not result.get("alive"):
        # Determine specific failure reason
        error = (result or {}).get("error", "die")
        status = {
            "auth_failed": ProxyStatus.AUTH_FAILED,
            "timeout": ProxyStatus.TIMEOUT,
        }.get(error, ProxyStatus.DIE)

        return {
            "status": status,
            "quality": ProxyQuality.BAD,
            "latency": None,
            "anonymity": None,
            "country": None,
            "region": None,
            "city": None,
            "ip_version": None,
        }

    # Success path
    latency = result["latency"]
    status = ProxyStatus.LIVE
    quality = _determine_quality(status, latency)
    anonymity = _determine_anonymity(real_ip, result.get("proxy_ip", ""), proxy)
    country = result.get("country")

    return {
        "status": status,
        "quality": quality,
        "latency": latency,
        "anonymity": anonymity,
        "country": country,
        "region": result.get("region"),
        "city": result.get("city"),
        "ip_version": result.get("ip_version"),
    }


async def check_and_update_proxy(proxy: Proxy, real_ip: str | None = None) -> Proxy:
    """Check proxy and persist all results to DB."""
    result = await check_single_proxy(proxy, real_ip)

    proxy.status = result["status"]
    proxy.quality = result["quality"]
    proxy.latency = result.get("latency")
    proxy.anonymity = result.get("anonymity")
    proxy.last_check = datetime.now(timezone.utc)
    proxy.check_count = (proxy.check_count or 0) + 1
    if result.get("country"):
        proxy.country = result["country"]

    await proxy.save()
    return proxy


async def check_all_proxies(proxies: list[Proxy]) -> list[Proxy]:
    """Check all proxies concurrently with semaphore limit."""
    # Get our real IP once for anonymity comparison
    real_ip = await _get_real_ip()

    semaphore = asyncio.Semaphore(30)  # max 30 concurrent checks

    async def bounded_check(proxy: Proxy) -> Proxy:
        async with semaphore:
            return await check_and_update_proxy(proxy, real_ip)

    results = await asyncio.gather(
        *[bounded_check(p) for p in proxies], return_exceptions=True
    )
    return [r for r in results if isinstance(r, Proxy)]
