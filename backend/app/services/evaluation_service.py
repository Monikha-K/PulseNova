"""
evaluation_service.py — loads verified model evaluation data from results/ CSVs.
All metrics come from saved result files, not recomputed on the fly.
"""
import pathlib
import logging
import warnings
from typing import Any

import pandas as pd
import numpy as np

from app.services.model_loader import get_model, is_model_loaded

logger = logging.getLogger(__name__)

RESULTS_DIR = pathlib.Path(__file__).resolve().parent.parent.parent.parent / "results"

LIMITATION_NOTICE = (
    "The hospital_insights dataset contains 208 records. "
    "The target variable (recommended_staff) follows a deterministic rule: "
    "records with 1-5 patients_admitted are labelled 1, records with 6-10 are labelled 2. "
    "Perfect classification accuracy reflects this recoverable rule, not generalisation "
    "to unseen hospitals or real-world staffing complexity. "
    "Independent external validation is required before any operational use."
)


def _read_csv(filename: str) -> pd.DataFrame | None:
    path = RESULTS_DIR / filename
    if not path.exists():
        return None
    try:
        return pd.read_csv(path)
    except Exception as e:
        logger.warning("Could not read %s: %s", filename, e)
        return None


def get_classification_evaluation() -> dict:
    result: dict[str, Any] = {"limitation_notice": LIMITATION_NOTICE}

    # XGBoost metrics
    xgb_metrics = _read_csv("xgboost_staff_metrics.csv")
    if xgb_metrics is not None:
        result["xgboost_metrics"] = xgb_metrics.to_dict(orient="records")

    # RF metrics
    rf_metrics = _read_csv("random_forest_staff_metrics.csv")
    if rf_metrics is not None:
        result["rf_metrics"] = rf_metrics.to_dict(orient="records")

    # Combined comparison
    comparison = _read_csv("final_ml_comparison.csv")
    if comparison is not None:
        result["comparison"] = comparison.to_dict(orient="records")

    # XGBoost predictions (actual vs predicted)
    xgb_preds = _read_csv("xgboost_staff_predictions.csv")
    if xgb_preds is not None:
        result["xgboost_predictions"] = xgb_preds.to_dict(orient="records")
        # Confusion matrix from predictions
        actual = xgb_preds["Actual Staff Level"].tolist()
        predicted = xgb_preds["Predicted Staff Level"].tolist()
        result["xgboost_confusion_matrix"] = _build_confusion(actual, predicted, [1, 2])
        result["evaluation_sample_count"] = len(xgb_preds)

    # RF predictions
    rf_preds = _read_csv("random_forest_staff_predictions.csv")
    if rf_preds is not None:
        result["rf_predictions"] = rf_preds.to_dict(orient="records")
        actual = rf_preds["Actual Staff Level"].tolist()
        predicted = rf_preds["Predicted Staff Level"].tolist()
        result["rf_confusion_matrix"] = _build_confusion(actual, predicted, [1, 2])

    return result


def _build_confusion(actual: list, predicted: list, labels: list) -> dict:
    matrix = [[0] * len(labels) for _ in labels]
    label_idx = {l: i for i, l in enumerate(labels)}
    for a, p in zip(actual, predicted):
        if a in label_idx and p in label_idx:
            matrix[label_idx[a]][label_idx[p]] += 1
    return {
        "labels": [str(l) for l in labels],
        "matrix": matrix,
        "total": len(actual),
    }


def get_feature_importance() -> dict:
    result: dict[str, Any] = {}

    # From saved CSV (verified)
    fi_csv = _read_csv("xgboost_feature_importance.csv")
    if fi_csv is not None:
        fi_csv = fi_csv.sort_values("Importance", ascending=False)
        result["xgboost_feature_importance"] = fi_csv.to_dict(orient="records")
        result["source"] = "results/xgboost_feature_importance.csv"

    # Also try to get from loaded model directly
    model = get_model("xgboost_staff")
    if model is not None and is_model_loaded("xgboost_staff"):
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                preprocessor = model.named_steps["preprocessor"]
                feature_names = list(preprocessor.get_feature_names_out())
                importances = model.named_steps["model"].feature_importances_
            fi_live = [
                {"Feature": name, "Importance": round(float(imp), 7)}
                for name, imp in sorted(zip(feature_names, importances), key=lambda x: -x[1])
            ]
            result["xgboost_feature_importance_live"] = fi_live
        except Exception as e:
            logger.warning("Live feature importance error: %s", e)

    # RF feature importance from loaded model
    rf_model = get_model("random_forest_staff")
    if rf_model is not None and is_model_loaded("random_forest_staff"):
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                preprocessor = rf_model.named_steps["preprocessor"]
                feature_names = list(preprocessor.get_feature_names_out())
                importances = rf_model.named_steps["model"].feature_importances_
            fi_rf = [
                {"Feature": name, "Importance": round(float(imp), 7)}
                for name, imp in sorted(zip(feature_names, importances), key=lambda x: -x[1])
            ]
            result["rf_feature_importance"] = fi_rf
        except Exception as e:
            logger.warning("RF feature importance error: %s", e)

    return result


def get_arima_evaluation() -> dict:
    from app.services.admissions_forecast import get_evaluation_data
    return get_evaluation_data()


def get_model_metrics_report() -> list[dict]:
    """Flat list of all verified metrics for CSV export."""
    rows = []
    for fname, model_name in [
        ("xgboost_staff_metrics.csv", "XGBoost"),
        ("random_forest_staff_metrics.csv", "Random Forest"),
        ("arima_metrics.csv", "ARIMA"),
    ]:
        df = _read_csv(fname)
        if df is not None:
            for _, row in df.iterrows():
                rows.append(row.to_dict())
    return rows
