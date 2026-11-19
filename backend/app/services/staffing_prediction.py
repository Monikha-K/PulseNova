"""
staffing_prediction.py — staffing level prediction using saved classification models.

XGBoost pipeline classes_ = [0, 1] → original labels [1, 2] (XGBOOST_CLASS_MAP).
Random Forest pipeline classes_ = [1, 2] → labels used directly.
"""
import warnings
from typing import Any

import numpy as np
import pandas as pd

from app.services.model_loader import (
    get_model, is_model_loaded, get_model_error,
    STAFF_FEATURES, VALID_SERVICES, XGBOOST_CLASS_MAP,
)

DISCLAIMER = (
    "This is an experimental model prediction for research purposes only. "
    "It is not a clinical staffing order or operational recommendation."
)

LIMITATION = (
    "The hospital_insights dataset has 208 records. The target (recommended_staff) "
    "follows a deterministic rule: 1-5 admissions → level 1, 6+ → level 2. "
    "Perfect accuracy reflects this rule, not generalisation to other hospitals."
)


def _build_input(data: dict) -> pd.DataFrame:
    return pd.DataFrame([{f: data[f] for f in STAFF_FEATURES}])


def predict_xgboost(data: dict) -> dict:
    model = get_model("xgboost_staff")
    if model is None:
        return {
            "model": "XGBoost",
            "available": False,
            "error": get_model_error("xgboost_staff"),
        }
    try:
        df = _build_input(data)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            raw_pred = int(model.predict(df)[0])
            proba = model.predict_proba(df)[0].tolist()
        # XGBoost classes_ = [0,1] → map back to original [1,2]
        original_label = XGBOOST_CLASS_MAP.get(raw_pred, raw_pred)
        classes_original = [XGBOOST_CLASS_MAP.get(c, c) for c in [0, 1]]
        return {
            "model": "XGBoost",
            "available": True,
            "predicted_class": original_label,
            "predicted_label": f"Staff Level {original_label}",
            "class_probabilities": {
                f"Level {classes_original[i]}": round(float(p), 4)
                for i, p in enumerate(proba)
            },
            "input_features": {f: data[f] for f in STAFF_FEATURES},
            "disclaimer": DISCLAIMER,
            "limitation": LIMITATION,
        }
    except Exception as exc:
        return {"model": "XGBoost", "available": False, "error": str(exc)}


def predict_random_forest(data: dict) -> dict:
    model = get_model("random_forest_staff")
    if model is None:
        return {
            "model": "Random Forest",
            "available": False,
            "error": get_model_error("random_forest_staff"),
        }
    try:
        df = _build_input(data)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            raw_pred = int(model.predict(df)[0])
            proba = model.predict_proba(df)[0].tolist()
        # RF classes_ = [1,2] → labels are already original
        classes = [1, 2]
        return {
            "model": "Random Forest",
            "available": True,
            "predicted_class": raw_pred,
            "predicted_label": f"Staff Level {raw_pred}",
            "class_probabilities": {
                f"Level {classes[i]}": round(float(p), 4)
                for i, p in enumerate(proba)
            },
            "input_features": {f: data[f] for f in STAFF_FEATURES},
            "disclaimer": DISCLAIMER,
            "limitation": LIMITATION,
        }
    except Exception as exc:
        return {"model": "Random Forest", "available": False, "error": str(exc)}


def predict_compare(data: dict) -> dict:
    xgb = predict_xgboost(data)
    rf = predict_random_forest(data)
    agree = (
        xgb.get("available") and rf.get("available") and
        xgb.get("predicted_class") == rf.get("predicted_class")
    )
    return {
        "xgboost": xgb,
        "random_forest": rf,
        "models_agree": agree,
        "input_features": {f: data[f] for f in STAFF_FEATURES},
        "disclaimer": DISCLAIMER,
    }
