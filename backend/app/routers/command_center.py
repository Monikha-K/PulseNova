"""routers/command_center.py — Hospital Command Center endpoint."""
from fastapi import APIRouter
from app.services.command_center_service import get_command_center

router = APIRouter(tags=["Command Center"])


@router.get("/analytics/command-center", summary="Hospital Command Center aggregated data")
def command_center():
    """
    Returns aggregated KPIs, charts, operational insights, dataset status,
    and model availability for the Hospital Command Center page.
    All values are derived from static CSV datasets loaded at startup.
    """
    return get_command_center()
