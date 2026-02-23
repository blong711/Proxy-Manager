from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.routers import proxies, accounts, providers, dashboard


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="Proxy Manager API",
    description="Centralized proxy & account management system",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(proxies.router, prefix="/api/proxies", tags=["Proxies"])
app.include_router(accounts.router, prefix="/api/accounts", tags=["Accounts"])
app.include_router(providers.router, prefix="/api/providers", tags=["Providers"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])


@app.get("/")
async def root():
    return {"message": "Proxy Manager API v1.0 — docs at /docs"}
