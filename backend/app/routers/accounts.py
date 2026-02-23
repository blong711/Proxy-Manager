from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from app.models.account import Account, AccountStatus

router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────────

class AccountCreate(BaseModel):
    username: str
    password: str
    platform: str
    note: Optional[str] = None
    status: AccountStatus = AccountStatus.ACTIVE
    proxy_id: Optional[str] = None


class AccountUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    platform: Optional[str] = None
    note: Optional[str] = None
    status: Optional[AccountStatus] = None
    proxy_id: Optional[str] = None


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("")
async def list_accounts(
    platform: Optional[str] = None,
    status: Optional[AccountStatus] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    query = {}
    if platform:
        query["platform"] = platform
    if status:
        query["status"] = status

    accounts = await Account.find(query).skip(skip).limit(limit).to_list()
    total = await Account.find(query).count()
    return {"data": accounts, "total": total, "skip": skip, "limit": limit}


@router.post("", status_code=201)
async def create_account(body: AccountCreate):
    account = Account(**body.model_dump())
    await account.insert()
    return account


@router.get("/{account_id}")
async def get_account(account_id: str):
    account = await Account.get(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.put("/{account_id}")
async def update_account(account_id: str, body: AccountUpdate):
    account = await Account.get(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    update_data = body.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(account, key, value)
    await account.save()
    return account


@router.delete("/{account_id}")
async def delete_account(account_id: str):
    account = await Account.get(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    await account.delete()
    return {"message": "Account deleted"}
