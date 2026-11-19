"""
routers/predictions.py — ML prediction endpoints.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from app.services.model_loader import get_all_model_status, VALID_SERVICES, STAFF_FEATURES
from app.services.staffing_prediction import predict_xgboost, predict_random_forest, predict_compare
from app.services.admissions_forecast import get_forecast, MAX_HORIZON, DEFAULT_HORIZON

router = APIRouter(tags=["Predictions"])


class StaffingInput(BaseModel):
    week: int = Field(..., ge=1, le=52, description="Week number (1-52)")
    service: str = Field(..., description="Service name: ICU, emergency, general_medicine, surgery")
    patients_admitted: float = Field(..., ge=0, description="Number of patients admitted")
    avg_stay: float = Field(..., ge=0, description="Average length of stay (days)")
    avg_satisfaction: float = Field(..., ge=0, le=100, description="Average satisfaction score (0-100)")
    max_occupancy: float = Field(..., ge=0, description="Maximum occupancy count")
    staff_count: float = Field(..., ge=0, description="Recorded staff count")

    @field_validator("service")
    @classmethod
    def validate_service(cls, v: str) -> str:
        if v not in VALID_SERVICES:
            raise ValueError(f"service must be one of {VALID_SERVICES}")
        return v


@router.get("/models/status")
def model_status():
    return {
        "models": get_all_model_status(),
        "staff_features": STAFF_FEATURES,
        "valid_services": VALID_SERVICES,
        "tasks": {
            "xgboost_staff": "Binary classification: recommended_staff level (1 or 2)",
            "random_forest_staff": "Binary classification: recommended_staff level (1 or 2)",
            "arima_admissions": "Daily patient admissions time-series forecasting",
        },
    }


@router.post("/predictions/staffing/xgboost")
def staffing_xgboost(payload: StaffingInput):
    return predict_xgboost(payload.model_dump())


@router.post("/predictions/staffing/random-forest")
def staffing_rf(payload: StaffingInput):
    return predict_random_forest(payload.model_dump())


@router.post("/predictions/staffing/compare")
def staffing_compare(payload: StaffingInput):
    return predict_compare(payload.model_dump())


@router.get("/predictions/admissions-forecast")
def admissions_forecast(
    horizon: int = Query(default=DEFAULT_HORIZON, ge=1, le=MAX_HORIZON,
                         description=f"Forecast horizon in days (1-{MAX_HORIZON})")
):
    return get_forecast(horizon=horizon)
