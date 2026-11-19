"""
workforce_simulator.py — workforce planning simulator service.
Reuses existing staffing prediction services. Does not retrain models.
"""
import logging
from typing import Any

import pandas as pd

from app.data_loader import get_df
from app.services.model_loader import STAFF_FEATURES, VALID_SERVICES, is_model_loaded
from app.services.staffing_prediction import predict_xgboost, predict_random_forest, predict_compare

logger = logging.getLogger(__name__)

LIMITATION_WARNING = (
    "The staffing dataset (hospital_insights_summary.csv) contains 208 records across 4 services and 52 weeks. "
    "The target variable (recommended_staff) follows a deterministic rule: "
    "1–5 admissions → level 1, 6–10 → level 2. "
    "Perfect classification accuracy reflects this rule, not generalisation to other hospitals. "
    "Predictions are experimental outputs and are not clinical or managerial orders. "
    "Independent validation is required before any operational use."
)


def get_simulator_options() -> dict:
    """Return available services, feature metadata, and baseline stats from actual data."""
    hi = get_df("hospital_insights")

    feature_meta = {
        "week":              {"type": "int",   "min": 1,   "max": 52,  "description": "Week number (1–52)"},
        "service":           {"type": "str",   "options": VALID_SERVICES, "description": "Hospital service"},
        "patients_admitted": {"type": "float", "min": 0,   "max": 20,  "description": "Number of patients admitted"},
        "avg_stay":          {"type": "float", "min": 0,   "max": 30,  "description": "Average length of stay (days)"},
        "avg_satisfaction":  {"type": "float", "min": 0,   "max": 100, "description": "Average satisfaction score (0–100)"},
        "max_occupancy":     {"type": "float", "min": 0,   "max": 20,  "description": "Maximum occupancy count (integer count, not %)"},
        "staff_count":       {"type": "float", "min": 0,   "max": 50,  "description": "Recorded staff count"},
    }

    baseline_by_service: dict[str, dict] = {}
    if hi is not None:
        for svc in VALID_SERVICES:
            svc_df = hi[hi["service"] == svc] if "service" in hi.columns else pd.DataFrame()
            if len(svc_df) == 0:
                continue
            row: dict[str, Any] = {}
            for col in ["patients_admitted", "avg_stay", "avg_satisfaction", "max_occupancy", "staff_count"]:
                if col in svc_df.columns:
                    row[f"avg_{col}"] = round(float(svc_df[col].mean()), 2)
                    row[f"min_{col}"] = round(float(svc_df[col].min()), 2)
                    row[f"max_{col}"] = round(float(svc_df[col].max()), 2)
            if "recommended_staff" in svc_df.columns:
                row["mode_recommended_staff"] = int(svc_df["recommended_staff"].mode().iloc[0])
            baseline_by_service[svc] = row

    # Default scenario from first real record
    default_scenario = None
    if hi is not None and len(hi) > 0:
        first = hi.iloc[0]
        default_scenario = {
            "week": int(first.get("week", 1)),
            "service": str(first.get("service", "ICU")),
            "patients_admitted": float(first.get("patients_admitted", 5)),
            "avg_stay": float(first.get("avg_stay", 7)),
            "avg_satisfaction": float(first.get("avg_satisfaction", 79)),
            "max_occupancy": float(first.get("max_occupancy", 11)),
            "staff_count": float(first.get("staff_count", 31)),
            "_source": "First record of hospital_insights_summary.csv",
        }

    return {
        "valid_services": VALID_SERVICES,
        "staff_features": STAFF_FEATURES,
        "feature_metadata": feature_meta,
        "baseline_by_service": baseline_by_service,
        "default_scenario": default_scenario,
        "model_availability": {
            "xgboost": is_model_loaded("xgboost_staff"),
            "random_forest": is_model_loaded("random_forest_staff"),
        },
        "limitation_warning": LIMITATION_WARNING,
    }


def simulate_single(scenario: dict) -> dict:
    """Run both models on a single scenario."""
    result = predict_compare(scenario)
    result["limitation_warning"] = LIMITATION_WARNING
    return result


def simulate_compare(scenarios: list[dict]) -> dict:
    """Run both models on multiple named scenarios."""
    results = []
    for s in scenarios:
        name = s.pop("_name", f"Scenario {len(results)+1}")
        pred = predict_compare(s)
        results.append({
            "name": name,
            "inputs": {f: s.get(f) for f in STAFF_FEATURES},
            "xgboost": pred.get("xgboost"),
            "random_forest": pred.get("random_forest"),
            "models_agree": pred.get("models_agree"),
        })
    return {
        "scenarios": results,
        "limitation_warning": LIMITATION_WARNING,
    }


def get_historical_context(service: str) -> dict:
    """Return descriptive historical stats for a given service from hospital_insights."""
    hi = get_df("hospital_insights")
    if hi is None or "service" not in hi.columns:
        return {"error": "hospital_insights dataset not loaded"}

    svc_df = hi[hi["service"].str.lower() == service.lower()]
    if len(svc_df) == 0:
        return {"error": f"No records found for service '{service}'"}

    context: dict[str, Any] = {"service": service, "record_count": int(len(svc_df))}
    for col in ["patients_admitted", "avg_stay", "avg_satisfaction", "max_occupancy", "staff_count", "recommended_staff"]:
        if col in svc_df.columns:
            context[col] = {
                "mean": round(float(svc_df[col].mean()), 2),
                "min":  round(float(svc_df[col].min()), 2),
                "max":  round(float(svc_df[col].max()), 2),
                "std":  round(float(svc_df[col].std()), 2),
            }
    context["note"] = "These are descriptive statistics from the hospital_insights_summary.csv dataset. They are not live operational data."
    return context
