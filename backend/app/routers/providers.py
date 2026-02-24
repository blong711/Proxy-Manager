from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Any
from app.models.provider import Provider

router = APIRouter()


class ProviderCreate(BaseModel):
    name: str
    api_url: Optional[str] = None
    api_key: Optional[str] = None
    config: Optional[dict[str, Any]] = None


class ProviderUpdate(BaseModel):
    name: Optional[str] = None
    api_url: Optional[str] = None
    api_key: Optional[str] = None
    config: Optional[dict[str, Any]] = None


@router.get("")
async def list_providers():
    providers = await Provider.find_all().to_list()
    return providers


@router.post("", status_code=201)
async def create_provider(body: ProviderCreate):
    provider = Provider(**body.model_dump())
    await provider.insert()
    return provider


@router.get("/{provider_id}")
async def get_provider(provider_id: str):
    provider = await Provider.get(provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return provider


@router.put("/{provider_id}")
async def update_provider(provider_id: str, body: ProviderUpdate):
    provider = await Provider.get(provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    update_data = body.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(provider, key, value)
    await provider.save()
    return provider


@router.delete("/{provider_id}")
async def delete_provider(provider_id: str):
    provider = await Provider.get(provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    await provider.delete()
    return {"message": "Provider deleted"}
