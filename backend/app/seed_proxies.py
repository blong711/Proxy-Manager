"""
Seed proxies from a text file into MongoDB.

Usage:
    # 1. Copy the file into the container
    docker cp proxies.txt proxy-backend:/tmp/proxies.txt

    # 2. Run the seeder
    docker compose exec backend python -m app.seed_proxies /tmp/proxies.txt

Or locally (if MongoDB is accessible):
    cd backend && python -m app.seed_proxies ../proxies.txt
"""

import asyncio
import re
import sys
from pathlib import Path
from app.database import init_db
from app.models.proxy import Proxy, ProxyProtocol, ProxyStatus


# Regex: protocol://ip:port
LINE_RE = re.compile(r"^(https?|socks[45])://(.+):(\d+)\s*$", re.IGNORECASE)

PROTOCOL_MAP = {
    "http":   ProxyProtocol.HTTP,
    "https":  ProxyProtocol.HTTPS,
    "socks4": ProxyProtocol.SOCKS5,   # closest match in our enum
    "socks5": ProxyProtocol.SOCKS5,
}


async def seed(filepath: str):
    await init_db()

    # Check if proxies already exist
    existing = await Proxy.count()
    if existing > 0:
        print(f"⚠  Database already has {existing} proxies. Skipping seed.")
        print("   To re-seed, drop the 'proxies' collection first.")
        return

    path = Path(filepath)
    if not path.exists():
        print(f"❌ File not found: {path}")
        return

    lines = path.read_text(encoding="utf-8").splitlines()
    proxies = []
    skipped = 0

    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue

        m = LINE_RE.match(line)
        if not m:
            skipped += 1
            continue

        proto_str = m.group(1).lower()
        ip = m.group(2)
        port_str = m.group(3)
        protocol = PROTOCOL_MAP.get(proto_str, ProxyProtocol.HTTP)

        proxies.append(Proxy(
            ip=ip,
            port=int(port_str),
            protocol=protocol,
            status=ProxyStatus.UNCHECKED,
            owner="admin",
        ))

    if not proxies:
        print("❌ No valid proxies found in file.")
        return

    # Bulk insert
    await Proxy.insert_many(proxies)
    print(f"✅ Seeded {len(proxies)} proxies ({skipped} lines skipped)")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python -m app.seed_proxies <path-to-proxies.txt>")
        print("Example: python -m app.seed_proxies /tmp/proxies.txt")
        sys.exit(1)

    asyncio.run(seed(sys.argv[1]))
