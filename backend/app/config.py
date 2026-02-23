from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    MONGODB_URL: str = "mongodb://localhost:27017"
    DB_NAME: str = "proxy_manager"

    model_config = {"env_file": ".env"}


settings = Settings()
