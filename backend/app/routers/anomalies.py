"""routers/anomalies.py — Anomaly Detection endpoints."""
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.services.anomaly_detection import run_detection, get_summary, DISCLAIMER

router = APIRouter(prefix="/anomalies", tags=["Anomaly Detection"])

VALID_DATASETS = ["emergency", "hospital_insights", "healthcare", "patient_flow"]
VALID_CATEGORIES = ["high_wait_time", "unusual_admission_volume", "operational_workload", "staffing_discrepancy", "data_quality"]
VALID_SEVERITIES = ["low", "medium", "high"]
VALID_METHODS = ["iqr", "zscore"]


class DetectionConfig(BaseModel):
    dataset: str | None = Field(None, description="Filter by dataset key")
    category: str | None = Field(None, description="Filter by anomaly category")
    method: str = Field("iqr", description="Detection method: iqr or zscore")
    multiplier: float = Field(1.5, ge=0.5, le=5.0, description="IQR multiplier or Z-score threshold (0.5–5.0)")

    @field_validator("dataset")
    @classmethod
    def validate_dataset(cls, v):
        if v is not None and v not in VALID_DATASETS:
            raise ValueError(f"dataset must be one of {VALID_DATASETS}")
        return v

    @field_validator("category")
    @classmethod
    def validate_category(cls, v):
        if v is not None and v not in VALID_CATEGORIES:
            raise ValueError(f"category must be one of {VALID_CATEGORIES}")
        return v

    @field_validator("method")
    @classmethod
    def validate_method(cls, v):
        if v not in VALID_METHODS:
            raise ValueError(f"method must be one of {VALID_METHODS}")
        return v


@router.get("/summary", summary="Anomaly counts by category and severity")
def anomaly_summary():
    """Returns total anomaly counts grouped by category and severity using default IQR detection."""
    return get_summary()


@router.get("", summary="List anomalies with optional filters")
def list_anomalies(
    dataset: str | None = Query(None, description=f"Filter by dataset: {VALID_DATASETS}"),
    category: str | None = Query(None, description=f"Filter by category: {VALID_CATEGORIES}"),
    severity: str | None = Query(None, description=f"Filter by severity: {VALID_SEVERITIES}"),
    method: str = Query("iqr", description="Detection method: iqr or zscore"),
    multiplier: float = Query(1.5, ge=0.5, le=5.0, description="IQR multiplier or Z-score threshold"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    if dataset and dataset not in VALID_DATASETS:
        raise HTTPException(400, f"dataset must be one of {VALID_DATASETS}")
    if category and category not in VALID_CATEGORIES:
        raise HTTPException(400, f"category must be one of {VALID_CATEGORIES}")
    if severity and severity not in VALID_SEVERITIES:
        raise HTTPException(400, f"severity must be one of {VALID_SEVERITIES}")
    if method not in VALID_METHODS:
        raise HTTPException(400, f"method must be one of {VALID_METHODS}")

    result = run_detection(dataset=dataset, category=category, method=method, multiplier=multiplier)
    anomalies = result["anomalies"]

    if severity:
        anomalies = [a for a in anomalies if a.get("severity") == severity]

    total = len(anomalies)
    paginated = anomalies[offset: offset + limit]

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "anomalies": paginated,
        "by_category": result["by_category"],
        "by_severity": result["by_severity"],
        "detection_config": result["detection_config"],
        "detected_at": result["detected_at"],
        "disclaimer": DISCLAIMER,
    }


@router.post("/detect", summary="Run anomaly detection with custom configuration")
def detect_anomalies(config: DetectionConfig):
    """Run detection with a custom configuration. Returns all detected anomalies."""
    result = run_detection(
        dataset=config.dataset,
        category=config.category,
        method=config.method,
        multiplier=config.multiplier,
    )
    return result
