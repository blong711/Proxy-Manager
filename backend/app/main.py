from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.routers import proxies, accounts, providers, dashboard, auth
from app.services.auth_service import ensure_default_users


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await ensure_default_users()
    yield


app = FastAPI(
    title="Proxy Manager API",
    description="Centralized proxy & account management system",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://0.0.0.0:3000"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=[
        "Accept",
        "Accept-Language",
        "Content-Language",
        "Content-Type",
        "Authorization",
        "X-Requested-With",
    ],
)

app.include_router(proxies.router, prefix="/api/proxies", tags=["Proxies"])
app.include_router(accounts.router, prefix="/api/accounts", tags=["Accounts"])
app.include_router(providers.router, prefix="/api/providers", tags=["Providers"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])


@app.get("/")
async def root():
    return {"message": "Proxy Manager API v1.0 — docs at /docs"}
