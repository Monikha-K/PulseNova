from fastapi import APIRouter, HTTPException, Query
from app import data_loader
from app.config import DATASET_FILES

router = APIRouter(prefix="/datasets", tags=["Datasets"])

VALID_KEYS = set(DATASET_FILES.keys())
MAX_LIMIT  = 500
DEFAULT_LIMIT = 20


def _require_key(key: str):
    if key not in VALID_KEYS:
        raise HTTPException(
            status_code=404,
            detail=f"Dataset '{key}' not found. Valid keys: {sorted(VALID_KEYS)}",
        )


def _require_loaded(key: str):
    if not data_loader.is_loaded(key):
        raise HTTPException(
            status_code=503,
            detail=f"Dataset '{key}' is not loaded: {data_loader.get_error(key)}",
        )


@router.get("", summary="All dataset metadata")
def list_datasets():
    """Return metadata for all four datasets."""
    return {"datasets": data_loader.get_all_metadata()}


@router.get("/{dataset_name}", summary="Single dataset metadata")
def get_dataset(dataset_name: str):
    _require_key(dataset_name)
    return data_loader.get_metadata(dataset_name)


@router.get("/{dataset_name}/preview", summary="Paginated row preview")
def preview_dataset(
    dataset_name: str,
    limit:  int = Query(default=DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: int = Query(default=0, ge=0),
):
    _require_key(dataset_name)
    _require_loaded(dataset_name)
    return data_loader.get_preview(dataset_name, limit=limit, offset=offset)


@router.get("/{dataset_name}/summary", summary="Descriptive statistics")
def summarise_dataset(dataset_name: str):
    _require_key(dataset_name)
    _require_loaded(dataset_name)
    return data_loader.get_summary(dataset_name)


@router.post("/reload", summary="Reload all CSV files from disk")
def reload_datasets():
    """Re-read all CSV files. Does not modify any files."""
    results = data_loader.reload_all()
    all_ok  = all(v["loaded"] for v in results.values())
    return {
        "status":  "ok" if all_ok else "partial",
        "results": results,
    }
