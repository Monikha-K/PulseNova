from fastapi import APIRouter
from app import data_loader
from app.config import APP_TITLE, APP_VERSION, DATASET_FILES

router = APIRouter()


@router.get("/", tags=["Health"])
def root():
    """Application root — name, version, and dataset load status."""
    return {
        "app":     APP_TITLE,
        "version": APP_VERSION,
        "status":  "running",
        "datasets_loaded": sum(1 for k in DATASET_FILES if data_loader.is_loaded(k)),
        "datasets_total":  len(DATASET_FILES),
    }


@router.get("/health", tags=["Health"])
def health():
    """Detailed health check — per-dataset load status."""
    dataset_status = {}
    for key in DATASET_FILES:
        dataset_status[key] = {
            "loaded":    data_loader.is_loaded(key),
            "rows":      len(data_loader.get_df(key)) if data_loader.is_loaded(key) else 0,
            "error":     data_loader.get_error(key),
        }
    all_ok = all(v["loaded"] for v in dataset_status.values())
    return {
        "status":   "healthy" if all_ok else "degraded",
        "api":      "running",
        "datasets": dataset_status,
    }
