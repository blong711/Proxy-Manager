from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings
from app.models.account import Account
from app.models.proxy import Proxy
from app.models.provider import Provider


async def init_db():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    await init_beanie(
        database=client[settings.DB_NAME],
        document_models=[Account, Proxy, Provider],
    )
