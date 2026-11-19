from fastapi import APIRouter, Query
from app import data_loader
from app.services.analytics_service import (
    get_dashboard_analytics,
    get_patient_analytics,
    get_emergency_analytics,
    get_operations_analytics,
)

router = APIRouter(tags=["Analytics"])


@router.get("/stats/summary", summary="Project-level dataset overview")
def stats_summary():
    return data_loader.get_project_summary()


@router.get("/analytics/dashboard", summary="Dashboard KPIs and charts")
def dashboard():
    return get_dashboard_analytics()


@router.get("/analytics/patients", summary="Patient analytics with optional filters")
def patients(
    gender: str | None = Query(None),
    admission_type: str | None = Query(None),
    medical_condition: str | None = Query(None),
    age_min: int | None = Query(None),
    age_max: int | None = Query(None),
):
    return get_patient_analytics(gender, admission_type, medical_condition, age_min, age_max)


@router.get("/analytics/emergency-flow", summary="Emergency and patient flow analytics")
def emergency_flow(
    department: str | None = Query(None),
    gender: str | None = Query(None),
    age_min: int | None = Query(None),
    age_max: int | None = Query(None),
    wait_min: float | None = Query(None),
    wait_max: float | None = Query(None),
):
    return get_emergency_analytics(department, gender, age_min, age_max, wait_min, wait_max)


@router.get("/analytics/operations", summary="Operational efficiency analytics")
def operations(
    service: str | None = Query(None),
    week_min: int | None = Query(None),
    week_max: int | None = Query(None),
):
    return get_operations_analytics(service, week_min, week_max)
