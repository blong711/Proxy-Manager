from fastapi import APIRouter
from datetime import datetime, timezone, timedelta
from app.models.proxy import Proxy, ProxyStatus
from app.models.account import Account

router = APIRouter()


@router.get("")
async def get_dashboard():
    """Return aggregated stats for the dashboard."""
    now = datetime.now(timezone.utc)
    expiry_threshold = now + timedelta(days=3)

    all_proxies = await Proxy.find_all().to_list()
    all_accounts = await Account.find_all().to_list()

    # Proxy counts by status
    status_counts = {s.value: 0 for s in ProxyStatus}
    for p in all_proxies:
        status_counts[p.status.value] += 1

    # Proxies expiring within 3 days
    expiring_soon = [
        p for p in all_proxies
        if p.expire_at and now <= p.expire_at.replace(tzinfo=timezone.utc) <= expiry_threshold
    ]

    # Cost calculations
    active_proxies = [p for p in all_proxies if p.status == ProxyStatus.LIVE]
    total_monthly_cost = sum(p.cost or 0 for p in active_proxies)
    renewal_cost = sum(p.cost or 0 for p in expiring_soon)

    # Account counts by status
    account_status_counts = {}
    for a in all_accounts:
        account_status_counts[a.status.value] = account_status_counts.get(a.status.value, 0) + 1

    # Cost breakdown by provider
    provider_costs: dict[str, float] = {}
    for p in all_proxies:
        if p.cost and p.provider_name:
            provider_costs[p.provider_name] = provider_costs.get(p.provider_name, 0) + p.cost

    return {
        "proxies": {
            "total": len(all_proxies),
            "by_status": status_counts,
            "expiring_soon": [
                {
                    "id": str(p.id),
                    "ip": p.ip,
                    "port": p.port,
                    "expire_at": p.expire_at,
                    "provider_name": p.provider_name,
                    "cost": p.cost,
                }
                for p in expiring_soon
            ],
        },
        "accounts": {
            "total": len(all_accounts),
            "by_status": account_status_counts,
        },
        "billing": {
            "total_monthly_cost": round(total_monthly_cost, 2),
            "renewal_needed": round(renewal_cost, 2),
            "by_provider": {k: round(v, 2) for k, v in provider_costs.items()},
        },
    }
