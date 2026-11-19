"""
main.py — PulseNova FastAPI application entry point.

Start with:
    cd PulseNova/backend
    uvicorn app.main:app --reload --host 127.0.0.1 --port 8001

Swagger UI: http://127.0.0.1:8001/docs
ReDoc:       http://127.0.0.1:8001/redoc
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import ALLOWED_ORIGINS, APP_TITLE, APP_VERSION, APP_DESC
from app import data_loader
from app.services.model_loader import load_models
from app.routers import health, datasets, analytics
from app.routers.predictions import router as predictions_router
from app.routers.models import router as models_router
from app.routers.command_center import router as command_center_router
from app.routers.anomalies import router as anomalies_router
from app.routers.workforce_simulator import router as workforce_router
from app.routers.assistant import router as assistant_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("PulseNova API starting — loading datasets …")
    data_loader.load_all()
    loaded_ds = sum(1 for k in data_loader.all_keys() if data_loader.is_loaded(k))
    logger.info("Datasets ready: %d / %d loaded", loaded_ds, len(data_loader.all_keys()))

    logger.info("Loading ML models …")
    load_models()
    logger.info("Models loaded.")
    yield
    logger.info("PulseNova API shutting down.")


app = FastAPI(
    title=APP_TITLE,
    version=APP_VERSION,
    description=APP_DESC,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ── Existing routers ──────────────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(datasets.router)
app.include_router(analytics.router)
app.include_router(predictions_router)
app.include_router(models_router)

# ── New routers ───────────────────────────────────────────────────────────────
app.include_router(command_center_router)
app.include_router(anomalies_router)
app.include_router(workforce_router)
app.include_router(assistant_router)
