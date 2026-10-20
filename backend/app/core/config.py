from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    test_database_url: str
    mqtt_host: str = "mqtt"
    mqtt_port: int = 1883
    cors_origins: list[str] = ["http://localhost:3000"]
    auth_mode: Literal["demo"] = "demo"
    sim_mode: bool = False
    products_path: str = "/data/products.yaml"


@lru_cache
def get_settings() -> Settings:
    return Settings()
