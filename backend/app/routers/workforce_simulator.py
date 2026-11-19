"""routers/workforce_simulator.py — Workforce Planning Simulator endpoints."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.services.model_loader import VALID_SERVICES, STAFF_FEATURES
from app.services.workforce_simulator import (
    get_simulator_options,
    simulate_single,
    simulate_compare,
    get_historical_context,
)

router = APIRouter(prefix="/workforce-simulator", tags=["Workforce Simulator"])


class SimulatorScenario(BaseModel):
    week: int = Field(..., ge=1, le=52)
    service: str = Field(...)
    patients_admitted: float = Field(..., ge=0, le=20)
    avg_stay: float = Field(..., ge=0, le=30)
    avg_satisfaction: float = Field(..., ge=0, le=100)
    max_occupancy: float = Field(..., ge=0, le=20)
    staff_count: float = Field(..., ge=0, le=50)

    @field_validator("service")
    @classmethod
    def validate_service(cls, v):
        if v not in VALID_SERVICES:
            raise ValueError(f"service must be one of {VALID_SERVICES}")
        return v


class CompareRequest(BaseModel):
    scenarios: list[dict] = Field(..., min_length=1, max_length=10)


@router.get("/options", summary="Available services, feature metadata, and baseline stats")
def simulator_options():
    return get_simulator_options()


@router.post("/predict", summary="Run both models on a single scenario")
def predict_scenario(scenario: SimulatorScenario):
    return simulate_single(scenario.model_dump())


@router.post("/compare", summary="Run both models on multiple named scenarios")
def compare_scenarios(request: CompareRequest):
    if len(request.scenarios) > 10:
        raise HTTPException(400, "Maximum 10 scenarios per comparison request")
    # Validate each scenario has required fields
    for i, s in enumerate(request.scenarios):
        for f in STAFF_FEATURES:
            if f not in s:
                raise HTTPException(400, f"Scenario {i+1} is missing required field '{f}'")
    return simulate_compare(request.scenarios)


@router.get("/historical-context/{service}", summary="Historical stats for a service")
def historical_context(service: str):
    if service not in VALID_SERVICES:
        raise HTTPException(400, f"service must be one of {VALID_SERVICES}")
    return get_historical_context(service)
