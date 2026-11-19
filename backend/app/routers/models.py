"""
routers/models.py — model evaluation, feature importance, and report endpoints.
"""
import csv
import io
from datetime import datetime

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.services.evaluation_service import (
    get_classification_evaluation,
    get_feature_importance,
    get_arima_evaluation,
    get_model_metrics_report,
)
from app.services.admissions_forecast import get_forecast
from app.data_loader import get_project_summary

router = APIRouter(tags=["Models & Reports"])


@router.get("/models/evaluation")
def model_evaluation():
    return {
        "classification": get_classification_evaluation(),
        "arima": get_arima_evaluation(),
    }


@router.get("/models/feature-importance")
def feature_importance():
    return get_feature_importance()


@router.get("/reports/model-metrics")
def model_metrics_report():
    return {"metrics": get_model_metrics_report()}


@router.get("/reports/model-metrics/export")
def export_model_metrics():
    rows = get_model_metrics_report()
    if not rows:
        return {"error": "No metrics available"}
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(rows)
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=pulsenova_model_metrics.csv"},
    )


@router.get("/reports/admissions-forecast/export")
def export_forecast():
    data = get_forecast(horizon=30)
    if not data.get("available"):
        return {"error": data.get("error", "Forecast unavailable")}
    rows = data["forecast"]
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(rows)
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=pulsenova_admissions_forecast.csv"},
    )


@router.get("/reports/dashboard-summary")
def dashboard_summary_report():
    summary = get_project_summary()
    from app.services.analytics_service import get_dashboard_analytics
    analytics = get_dashboard_analytics()
    return {
        "report_title": "PulseNova Dashboard Summary",
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "datasets": summary["datasets"],
        "kpis": analytics.get("kpis", {}),
        "note": "All values derived from static CSV research datasets.",
    }


@router.get("/reports/dashboard-summary/export")
def export_dashboard_summary():
    summary = get_project_summary()
    from app.services.analytics_service import get_dashboard_analytics
    analytics = get_dashboard_analytics()
    kpis = analytics.get("kpis", {})

    rows = [
        {"metric": "Report Title", "value": "PulseNova Dashboard Summary", "source": ""},
        {"metric": "Generated At", "value": datetime.utcnow().isoformat() + "Z", "source": ""},
    ]
    for ds in summary["datasets"]:
        rows.append({
            "metric": f"Dataset: {ds['key']} rows",
            "value": ds["rows"],
            "source": ds["filename"],
        })
    for k, v in kpis.items():
        rows.append({"metric": k, "value": v if v is not None else "N/A", "source": "computed"})

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["metric", "value", "source"])
    writer.writeheader()
    writer.writerows(rows)
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=pulsenova_dashboard_summary.csv"},
    )
