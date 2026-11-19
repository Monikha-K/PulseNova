"""
admissions_forecast.py — ARIMA admissions forecasting using the saved artifact.

The saved ARIMAResultsWrapper was trained on daily admissions from 2023-01-04
to 2024-12-10 (707 observations). It supports .forecast(steps=N) for future
daily predictions. Confidence intervals are available via get_forecast().
"""
import warnings
import logging
from typing import Any

import pandas as pd
import numpy as np

from app.services.model_loader import get_model, get_model_error, is_model_loaded

logger = logging.getLogger(__name__)

MAX_HORIZON = 90
DEFAULT_HORIZON = 30

# Last training date (from inspection: 2024-12-10)
LAST_TRAIN_DATE = pd.Timestamp("2024-12-10")


def get_forecast(horizon: int = DEFAULT_HORIZON) -> dict:
    horizon = max(1, min(horizon, MAX_HORIZON))
    model = get_model("arima_admissions")

    if model is None:
        return {
            "available": False,
            "error": get_model_error("arima_admissions"),
            "model": "ARIMA(1,1,1)",
        }

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            fc_result = model.get_forecast(steps=horizon)
            fc_mean = fc_result.predicted_mean
            fc_ci = fc_result.conf_int(alpha=0.05)

        dates = pd.date_range(
            start=LAST_TRAIN_DATE + pd.Timedelta(days=1),
            periods=horizon,
            freq="D",
        )

        forecast_rows = []
        for i, (date, val) in enumerate(zip(dates, fc_mean)):
            row: dict[str, Any] = {
                "date": date.strftime("%Y-%m-%d"),
                "forecast": round(float(val), 4),
            }
            try:
                row["ci_lower"] = round(float(fc_ci.iloc[i, 0]), 4)
                row["ci_upper"] = round(float(fc_ci.iloc[i, 1]), 4)
            except Exception:
                row["ci_lower"] = None
                row["ci_upper"] = None
            forecast_rows.append(row)

        # Historical actuals from the saved result (last 60 non-zero days)
        try:
            endog = model.model.endog
            idx = model.model.data.dates
            # endog may be 2D (707,1) — flatten it
            endog_flat = np.array(endog).flatten()
            hist_df = pd.DataFrame({"actual": endog_flat}, index=idx)
            hist_df = hist_df[hist_df["actual"] > 0].tail(60)
            historical = [
                {"date": str(d.date()), "actual": round(float(v), 2)}
                for d, v in zip(hist_df.index, hist_df["actual"])
            ]
        except Exception as e:
            logger.warning("historical series error: %s", e)
            historical = []

        return {
            "available": True,
            "model": "ARIMA(1,1,1)",
            "horizon": horizon,
            "last_training_date": LAST_TRAIN_DATE.strftime("%Y-%m-%d"),
            "forecast": forecast_rows,
            "historical": historical,
            "confidence_intervals_available": True,
            "note": (
                "Forecast is a model estimate based on historical daily admissions data. "
                "It does not account for unknown future disruptions or seasonal events "
                "not present in the training period."
            ),
        }

    except Exception as exc:
        logger.error("ARIMA forecast error: %s", exc)
        return {
            "available": False,
            "error": str(exc),
            "model": "ARIMA(1,1,1)",
        }


def get_evaluation_data() -> dict:
    """Return actual vs forecast from the saved results CSV."""
    import pathlib
    results_dir = pathlib.Path(__file__).resolve().parent.parent.parent.parent / "results"
    csv_path = results_dir / "arima_admission_forecast.csv"
    metrics_path = results_dir / "arima_metrics.csv"

    result: dict[str, Any] = {"available": False}

    if csv_path.exists():
        try:
            df = pd.read_csv(csv_path)
            # Only rows where actual > 0 (non-zero days)
            df_nonzero = df[df["Actual Admissions"] > 0].copy()
            result["actual_vs_forecast"] = df_nonzero.head(60).to_dict(orient="records")
            result["evaluation_sample_count"] = int(len(df_nonzero))
            result["available"] = True
        except Exception as e:
            result["error"] = str(e)

    if metrics_path.exists():
        try:
            mdf = pd.read_csv(metrics_path)
            result["metrics"] = mdf.to_dict(orient="records")
        except Exception:
            pass

    return result
