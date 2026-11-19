"""
data_loader.py — loads and caches the four PulseNova CSV datasets.
- DataFrames are loaded once at startup and held in memory.
- reload() re-reads files without restarting the server.
- All public functions return plain Python dicts so FastAPI can serialise them.
- NaN / NaT / numpy types are converted to JSON-safe values before returning.
- No data is ever written back to the CSV files.
"""
import math
import logging
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from app.config import DATASET_DIR, DATASET_FILES

logger = logging.getLogger(__name__)

# ── Internal cache ─────────────────────────────────────────────────────────
_dataframes: dict[str, pd.DataFrame | None] = {k: None for k in DATASET_FILES}
_load_errors: dict[str, str | None]         = {k: None for k in DATASET_FILES}


# ── Helpers ────────────────────────────────────────────────────────────────

def _safe_value(v: Any) -> Any:
    """Convert a single value to a JSON-safe Python type."""
    if v is None:
        return None
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    if isinstance(v, np.integer):
        return int(v)
    if isinstance(v, np.floating):
        return None if math.isnan(float(v)) else float(v)
    if isinstance(v, np.bool_):
        return bool(v)
    if isinstance(v, pd.Timestamp):
        return v.isoformat()
    return v


def _safe_row(row: dict) -> dict:
    return {k: _safe_value(v) for k, v in row.items()}


def _load_one(key: str) -> None:
    filename = DATASET_FILES[key]
    path: Path = DATASET_DIR / filename
    if not path.exists():
        msg = f"File not found: {path}"
        logger.warning(msg)
        _dataframes[key] = None
        _load_errors[key] = msg
        return
    try:
        df = pd.read_csv(path, low_memory=False)
        _dataframes[key] = df
        _load_errors[key] = None
        logger.info("Loaded '%s': %d rows x %d cols", key, len(df), len(df.columns))
    except Exception as exc:
        msg = f"Failed to read {filename}: {exc}"
        logger.error(msg)
        _dataframes[key] = None
        _load_errors[key] = msg


# ── Public API ─────────────────────────────────────────────────────────────

def load_all() -> None:
    """Load all four datasets. Called once at application startup."""
    for key in DATASET_FILES:
        _load_one(key)


def reload_all() -> dict[str, dict]:
    """Re-read all CSV files from disk. Returns per-dataset status."""
    results = {}
    for key in DATASET_FILES:
        _load_one(key)
        results[key] = {
            "loaded": _dataframes[key] is not None,
            "error":  _load_errors[key],
            "rows":   len(_dataframes[key]) if _dataframes[key] is not None else 0,
        }
    return results


def get_df(key: str) -> pd.DataFrame | None:
    return _dataframes.get(key)


def is_loaded(key: str) -> bool:
    return _dataframes.get(key) is not None


def get_error(key: str) -> str | None:
    return _load_errors.get(key)


def all_keys() -> list[str]:
    return list(DATASET_FILES.keys())


def get_metadata(key: str) -> dict:
    filename = DATASET_FILES.get(key, "")
    path = DATASET_DIR / filename
    df = _dataframes.get(key)
    error = _load_errors.get(key)
    if df is None:
        return {
            "key": key, "filename": filename, "loaded": False,
            "error": error, "rows": 0, "columns": 0,
            "column_names": [], "missing_values": 0,
            "duplicate_rows": 0, "file_exists": path.exists(),
        }
    return {
        "key":            key,
        "filename":       filename,
        "loaded":         True,
        "error":          None,
        "rows":           int(len(df)),
        "columns":        int(len(df.columns)),
        "column_names":   list(df.columns),
        "missing_values": int(df.isnull().sum().sum()),
        "duplicate_rows": int(df.duplicated().sum()),
        "file_exists":    path.exists(),
    }


def get_all_metadata() -> list[dict]:
    return [get_metadata(k) for k in DATASET_FILES]


def get_preview(key: str, limit: int = 20, offset: int = 0) -> dict:
    df = _dataframes.get(key)
    if df is None:
        return {"error": _load_errors.get(key, "Dataset not loaded")}
    total = len(df)
    records = [_safe_row(r) for r in df.iloc[offset: offset + limit].to_dict(orient="records")]
    return {
        "key": key, "total_rows": total,
        "limit": limit, "offset": offset,
        "columns": list(df.columns), "records": records,
    }


def get_summary(key: str) -> dict:
    df = _dataframes.get(key)
    if df is None:
        return {"error": _load_errors.get(key, "Dataset not loaded")}

    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    cat_cols     = df.select_dtypes(include="object").columns.tolist()

    numeric_stats: dict[str, dict] = {}
    if numeric_cols:
        desc = df[numeric_cols].describe()
        for col in numeric_cols:
            numeric_stats[col] = {stat: _safe_value(desc.loc[stat, col]) for stat in desc.index}

    # Skip high-cardinality columns (>50 unique values)
    cat_counts: dict[str, dict] = {}
    for col in cat_cols:
        if df[col].nunique() <= 50:
            counts = df[col].value_counts().head(20)
            cat_counts[col] = {str(k): int(v) for k, v in counts.items()}

    missing_per_col = {
        col: int(df[col].isnull().sum())
        for col in df.columns if df[col].isnull().sum() > 0
    }

    return {
        "key": key, "rows": int(len(df)), "columns": int(len(df.columns)),
        "numeric_stats": numeric_stats,
        "categorical_counts": cat_counts,
        "missing_per_column": missing_per_col,
    }


def get_project_summary() -> dict:
    datasets = []
    for key in DATASET_FILES:
        df = _dataframes.get(key)
        datasets.append({
            "key": key, "filename": DATASET_FILES[key],
            "loaded": df is not None,
            "rows":    int(len(df)) if df is not None else 0,
            "columns": int(len(df.columns)) if df is not None else 0,
            "error":   _load_errors.get(key),
        })
    return {
        "total_datasets": len(DATASET_FILES),
        "loaded_count":   sum(1 for d in datasets if d["loaded"]),
        "datasets":       datasets,
    }
