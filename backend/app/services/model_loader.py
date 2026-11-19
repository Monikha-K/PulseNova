"""
model_loader.py — loads and caches the three PulseNova ML model artifacts.

Key facts discovered from inspection:
- xgboost_staff.joblib  : sklearn Pipeline (ColumnTransformer + XGBClassifier)
                          classes_ = [0, 1]  →  original labels [1, 2]
                          features: week, service, patients_admitted, avg_stay,
                                    avg_satisfaction, max_occupancy, staff_count
- random_forest_staff.joblib : same Pipeline structure (ColumnTransformer + RandomForestClassifier)
                               classes_ = [1, 2]  →  original labels directly
                               same features
- arima_admissions.joblib : statsmodels ARIMAResultsWrapper
                            daily frequency, trained 2023-01-04 to 2024-12-10
"""
import logging
import warnings
from pathlib import Path
from typing import Any

import joblib

from app.config import PROJECT_ROOT

logger = logging.getLogger(__name__)

MODELS_DIR = PROJECT_ROOT / "models"

MODEL_FILES = {
    "xgboost_staff":        "xgboost_staff.joblib",
    "random_forest_staff":  "random_forest_staff.joblib",
    "arima_admissions":     "arima_admissions.joblib",
}

# XGBoost classes_ = [0,1] → original labels [1,2]
XGBOOST_CLASS_MAP = {0: 1, 1: 2}

# Input feature order expected by both classification pipelines
STAFF_FEATURES = ["week", "service", "patients_admitted", "avg_stay",
                  "avg_satisfaction", "max_occupancy", "staff_count"]

VALID_SERVICES = ["ICU", "emergency", "general_medicine", "surgery"]

_models: dict[str, Any] = {}
_errors: dict[str, str] = {}


def load_models() -> None:
    """Load all model artifacts at startup. Called once from main.py lifespan."""
    for key, filename in MODEL_FILES.items():
        path = MODELS_DIR / filename
        if not path.exists():
            msg = f"Model file not found: {path}"
            logger.warning(msg)
            _errors[key] = msg
            _models[key] = None
            continue
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                obj = joblib.load(path)
            _models[key] = obj
            _errors[key] = None
            logger.info("Loaded model '%s' from %s", key, filename)
        except Exception as exc:
            msg = f"Failed to load {filename}: {exc}"
            logger.error(msg)
            _models[key] = None
            _errors[key] = msg


def get_model(key: str) -> Any:
    return _models.get(key)


def get_model_error(key: str) -> str | None:
    return _errors.get(key)


def is_model_loaded(key: str) -> bool:
    return _models.get(key) is not None


def get_all_model_status() -> dict:
    status = {}
    for key, filename in MODEL_FILES.items():
        path = MODELS_DIR / filename
        status[key] = {
            "loaded": is_model_loaded(key),
            "file_exists": path.exists(),
            "filename": filename,
            "error": _errors.get(key),
        }
    return status
