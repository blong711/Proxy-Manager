"""
🧪 Proxy Tester — Kiểm tra proxy ngon hay dở

Cách dùng:
    # Test 1 proxy
    python test_proxy.py http://1.2.3.4:8080

    # Test nhiều proxy từ file
    python test_proxy.py proxies.txt

    # Test với giới hạn số lượng
    python test_proxy.py proxies.txt --limit 50

    # Test với timeout tùy chỉnh (giây)
    python test_proxy.py proxies.txt --timeout 15

Yêu cầu:
    pip install httpx rich
"""

import asyncio
import re
import sys
import time
import argparse
from pathlib import Path

try:
    import httpx
except ImportError:
    print("❌ Cần cài httpx: pip install httpx")
    sys.exit(1)

try:
    from rich.console import Console
    from rich.table import Table
    from rich.live import Live
    from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskID
    RICH = True
except ImportError:
    RICH = False

# ── Cấu hình ──────────────────────────────────────────────────────────────────

CHECK_TARGETS = [
    {"url": "http://httpbin.org/ip", "field": "origin"},
    {"url": "https://api.ipify.org?format=json", "field": "ip"},
]

GEO_URL = "http://ip-api.com/json/{ip}?fields=country,countryCode,city,isp,query"

TIMEOUT = 12.0
CONCURRENCY = 30

# Ngưỡng đánh giá
LATENCY_GOOD = 1000    # ms — dưới = tốt
LATENCY_OK = 3000      # ms — dưới = tạm được
LATENCY_BAD = 5000     # ms — trên = dở

# ── Parse proxy ────────────────────────────────────────────────────────────────

LINE_RE = re.compile(r"^(?:(https?|socks[45])://)?(.*)", re.IGNORECASE)

def parse_proxy(line: str) -> dict | None:
    """Parse dòng proxy, hỗ trợ nhiều format."""
    line = line.strip()
    if not line or line.startswith("#"):
        return None

    m = LINE_RE.match(line)
    if not m:
        return None

    protocol = (m.group(1) or "http").lower()
    rest = m.group(2)

    username = password = None

    # user:pass@ip:port
    if "@" in rest:
        auth, host = rest.rsplit("@", 1)
        parts = auth.split(":", 1)
        username = parts[0]
        password = parts[1] if len(parts) > 1 else None
        rest = host

    parts = rest.split(":")

    # ip:port:user:pass
    if len(parts) == 4:
        ip, port_s, username, password = parts
    elif len(parts) == 2:
        ip, port_s = parts
    else:
        return None

    try:
        port = int(port_s)
    except ValueError:
        return None

    proxy_url = f"{protocol}://"
    if username and password:
        proxy_url += f"{username}:{password}@"
    proxy_url += f"{ip}:{port}"

    return {
        "ip": ip, "port": port,
        "protocol": protocol,
        "username": username, "password": password,
        "proxy_url": proxy_url,
        "raw": line,
    }


# ── Kiểm tra 1 proxy ──────────────────────────────────────────────────────────

async def check_proxy(proxy: dict, timeout: float = TIMEOUT) -> dict:
    """Kiểm tra 1 proxy: live/die, latency, quality, geo."""
    result = {
        **proxy,
        "status": "die",
        "quality": "bad",
        "latency": None,
        "exit_ip": None,
        "country": None,
        "city": None,
        "isp": None,
        "error": None,
    }

    # Thử từng target
    for target in CHECK_TARGETS:
        start = time.monotonic()
        try:
            async with httpx.AsyncClient(
                proxy=proxy["proxy_url"],
                timeout=httpx.Timeout(timeout),
                follow_redirects=True,
            ) as client:
                resp = await client.get(target["url"])
                elapsed = round((time.monotonic() - start) * 1000, 1)

                if resp.status_code == 200:
                    data = resp.json()
                    result["status"] = "live"
                    result["latency"] = elapsed
                    result["exit_ip"] = data.get(target["field"], "")

                    # Đánh giá quality
                    if elapsed <= LATENCY_GOOD:
                        result["quality"] = "🟢 good"
                    elif elapsed <= LATENCY_OK:
                        result["quality"] = "🟡 ok"
                    elif elapsed <= LATENCY_BAD:
                        result["quality"] = "🟠 slow"
                    else:
                        result["quality"] = "🔴 bad"
                    break

        except httpx.ProxyError:
            result["error"] = "auth_failed"
            result["status"] = "auth_failed"
        except httpx.TimeoutException:
            result["error"] = "timeout"
            result["status"] = "timeout"
        except Exception as e:
            result["error"] = str(e)[:60]

    # Nếu live, tra cứu geo
    if result["status"] == "live" and result["exit_ip"]:
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
                geo = await client.get(GEO_URL.format(ip=result["exit_ip"]))
                if geo.status_code == 200:
                    g = geo.json()
                    result["country"] = g.get("country", "")
                    result["city"] = g.get("city", "")
                    result["isp"] = g.get("isp", "")
        except Exception:
            pass

    return result


# ── Chạy batch ─────────────────────────────────────────────────────────────────

async def check_batch(proxies: list[dict], timeout: float = TIMEOUT, concurrency: int = CONCURRENCY) -> list[dict]:
    """Kiểm tra nhiều proxy cùng lúc."""
    sem = asyncio.Semaphore(concurrency)
    results = []

    if RICH:
        console = Console()
        progress = Progress(
            SpinnerColumn(),
            TextColumn("[bold blue]{task.description}"),
            BarColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            TextColumn("({task.completed}/{task.total})"),
            console=console,
        )
        task_id = progress.add_task("Đang kiểm tra proxy...", total=len(proxies))

        async def bounded(p: dict) -> dict:
            async with sem:
                r = await check_proxy(p, timeout)
                progress.advance(task_id)
                return r

        with progress:
            results = await asyncio.gather(*[bounded(p) for p in proxies])
    else:
        total = len(proxies)
        done = 0

        async def bounded(p: dict) -> dict:
            nonlocal done
            async with sem:
                r = await check_proxy(p, timeout)
                done += 1
                if done % 10 == 0 or done == total:
                    print(f"  Tiến trình: {done}/{total}", end="\r")
                return r

        results = await asyncio.gather(*[bounded(p) for p in proxies])
        print()

    return list(results)


# ── Hiển thị kết quả ──────────────────────────────────────────────────────────

def print_results(results: list[dict]):
    live = [r for r in results if r["status"] == "live"]
    dead = [r for r in results if r["status"] != "live"]

    print()
    print(f"{'='*60}")
    print(f"📊 KẾT QUẢ KIỂM TRA PROXY")
    print(f"{'='*60}")
    print(f"  Tổng:        {len(results)}")
    print(f"  ✅ Live:      {len(live)}")
    print(f"  ❌ Die:       {len([r for r in dead if r['status'] == 'die'])}")
    print(f"  ⏱  Timeout:   {len([r for r in dead if r['status'] == 'timeout'])}")
    print(f"  🔒 Auth fail: {len([r for r in dead if r['status'] == 'auth_failed'])}")
    print(f"{'='*60}")

    # ── Bảng proxy LIVE ──
    if live:
        live.sort(key=lambda r: r["latency"] or 99999)

        if RICH:
            console = Console()
            table = Table(title="✅ PROXY LIVE — Sắp xếp theo tốc độ", show_lines=False)
            table.add_column("#", style="dim", width=4)
            table.add_column("Proxy", style="cyan")
            table.add_column("Protocol", style="blue")
            table.add_column("Status", style="green")
            table.add_column("Latency", justify="right")
            table.add_column("Quality")
            table.add_column("Exit IP", style="dim")
            table.add_column("Country")
            table.add_column("ISP", style="dim", max_width=25)

            for i, r in enumerate(live, 1):
                lat = f"{r['latency']}ms"
                if r["latency"] <= LATENCY_GOOD:
                    lat_style = "bold green"
                elif r["latency"] <= LATENCY_OK:
                    lat_style = "yellow"
                else:
                    lat_style = "red"

                table.add_row(
                    str(i),
                    f"{r['ip']}:{r['port']}",
                    r["protocol"].upper(),
                    "🟢 LIVE",
                    f"[{lat_style}]{lat}[/{lat_style}]",
                    r["quality"],
                    r.get("exit_ip", ""),
                    r.get("country", "") or "",
                    r.get("isp", "") or "",
                )

            console.print(table)
        else:
            print(f"\n✅ PROXY LIVE ({len(live)}):")
            print(f"{'#':<4} {'Proxy':<25} {'Proto':<8} {'Latency':<10} {'Quality':<12} {'Country':<15}")
            print("-" * 80)
            for i, r in enumerate(live, 1):
                print(f"{i:<4} {r['ip']}:{r['port']:<15} {r['protocol'].upper():<8} {r['latency']}ms{'':<5} {r['quality']:<12} {r.get('country',''):<15}")
    else:
        print("\n😢 Không có proxy nào live!")

    # ── Bảng proxy DEAD ──
    if dead:
        if RICH:
            console = Console()
            dead_table = Table(title="❌ PROXY DEAD", show_lines=False)
            dead_table.add_column("#", style="dim", width=4)
            dead_table.add_column("Proxy", style="dim")
            dead_table.add_column("Protocol", style="dim")
            dead_table.add_column("Status")
            dead_table.add_column("Lý do", style="dim", max_width=40)

            status_style = {
                "die": "[red]💀 DIE[/red]",
                "timeout": "[yellow]⏱ TIMEOUT[/yellow]",
                "auth_failed": "[magenta]🔒 AUTH FAIL[/magenta]",
            }

            for i, r in enumerate(dead, 1):
                dead_table.add_row(
                    str(i),
                    f"{r['ip']}:{r['port']}",
                    r["protocol"].upper(),
                    status_style.get(r["status"], r["status"]),
                    r.get("error", "") or "",
                )

            console.print(dead_table)
        else:
            print(f"\n❌ PROXY DEAD ({len(dead)}):")
            print(f"{'#':<4} {'Proxy':<25} {'Proto':<8} {'Status':<15} {'Lý do'}")
            print("-" * 70)
            for i, r in enumerate(dead, 1):
                status_label = {"die": "💀 DIE", "timeout": "⏱ TIMEOUT", "auth_failed": "🔒 AUTH FAIL"}.get(r["status"], r["status"])
                print(f"{i:<4} {r['ip']}:{r['port']:<15} {r['protocol'].upper():<8} {status_label:<15} {r.get('error','')}")

    # Top 5 nhanh nhất
    if live:
        print(f"\n🚀 TOP 5 NHANH NHẤT:")
        for i, r in enumerate(live[:5], 1):
            print(f"  {i}. {r['proxy_url']}  —  {r['latency']}ms  ({r.get('country', '?')})")

    # Xuất file
    if live:
        with open("proxies_live.txt", "w", encoding="utf-8") as f:
            for r in live:
                f.write(r["raw"] + "\n")
        print(f"\n💾 Đã lưu {len(live)} proxy live vào: proxies_live.txt")

    if dead:
        with open("proxies_dead.txt", "w", encoding="utf-8") as f:
            for r in dead:
                f.write(r["raw"] + "\n")
        print(f"💾 Đã lưu {len(dead)} proxy dead vào: proxies_dead.txt")


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="🧪 Proxy Tester — Kiểm tra proxy ngon hay dở")
    parser.add_argument("target", help="Proxy URL (http://ip:port) hoặc file chứa danh sách proxy")
    parser.add_argument("--limit", type=int, default=0, help="Giới hạn số proxy test (0 = tất cả)")
    parser.add_argument("--timeout", type=float, default=TIMEOUT, help=f"Timeout mỗi proxy (giây, mặc định {TIMEOUT})")
    parser.add_argument("--concurrency", type=int, default=CONCURRENCY, help=f"Số proxy test song song (mặc định {CONCURRENCY})")
    args = parser.parse_args()

    concurrency = args.concurrency

    # Kiểm tra target là file hay proxy URL
    target_path = Path(args.target)
    proxies = []

    if target_path.exists() and target_path.is_file():
        # Đọc file
        lines = target_path.read_text(encoding="utf-8").splitlines()
        for line in lines:
            p = parse_proxy(line)
            if p:
                proxies.append(p)
        print(f"📂 Đọc file: {target_path.name}")
        print(f"   Tổng dòng: {len(lines)}, proxy hợp lệ: {len(proxies)}")
    else:
        # Coi là 1 proxy URL
        p = parse_proxy(args.target)
        if p:
            proxies.append(p)
        else:
            print(f"❌ Không parse được: {args.target}")
            sys.exit(1)

    if not proxies:
        print("❌ Không tìm thấy proxy hợp lệ!")
        sys.exit(1)

    if args.limit > 0:
        proxies = proxies[:args.limit]
        print(f"   Giới hạn test: {args.limit} proxy")

    print(f"\n🔍 Bắt đầu kiểm tra {len(proxies)} proxy (timeout={args.timeout}s, concurrency={concurrency})...\n")

    results = asyncio.run(check_batch(proxies, args.timeout, concurrency))
    print_results(results)


if __name__ == "__main__":
    main()
