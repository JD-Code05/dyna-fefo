from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import health, me, products
from app.core.config import get_settings
from app.core.errors import register_error_handlers


def create_app() -> FastAPI:
    app = FastAPI(title="dyna-fefo")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_settings().cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_error_handlers(app)
    for r in (health, me, products):
        app.include_router(r.router, prefix="/api/v1")
    return app


app = create_app()
