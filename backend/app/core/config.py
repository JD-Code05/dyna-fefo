from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    test_database_url: str
    mqtt_host: str = "mqtt"
    mqtt_port: int = 1883
    cors_origins: list[str] = ["http://localhost:3000"]
    # Dev defaults so `docker compose up` works offline; set real values in .env for anything shared.
    jwt_secret: str = "dev-only-jwt-secret-change-me-before-sharing"  # HS256 wants 32+ bytes
    token_hours: int = 8  # one shift
    demo_supervisor_password: str = "Supervisor-Demo-2026"
    demo_staff_password: str = "Staff-Demo-2026"
    sim_mode: bool = False
    products_path: str = "/data/products.yaml"


@lru_cache
def get_settings() -> Settings:
    return Settings()
