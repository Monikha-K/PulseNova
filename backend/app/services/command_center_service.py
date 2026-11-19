"""
command_center_service.py — aggregates KPIs, charts, and operational insights
for the Hospital Command Center page. All values come from loaded DataFrames.
"""
import math
import logging
from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd

from app.data_loader import get_df, is_loaded, get_error, all_keys
from app.services.model_loader import get_all_model_status

logger = logging.getLogger(__name__)


def _safe(v: Any) -> Any:
    if v is None:
        return None
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    if isinstance(v, np.integer):
        return int(v)
    if isinstance(v, np.floating):
        return None if math.isnan(float(v)) else round(float(v), 4)
    if isinstance(v, np.bool_):
        return bool(v)
    if isinstance(v, pd.Timestamp):
        return v.isoformat()
    return v


def _top_n(series: pd.Series, n: int = 5) -> list[dict]:
    counts = series.dropna().value_counts().head(n)
    return [{"label": str(k), "value": int(v)} for k, v in counts.items()]


def get_command_center() -> dict:
    hc = get_df("healthcare")
    er = get_df("emergency")
    hi = get_df("hospital_insights")
    pf = get_df("patient_flow")

    # ── Dataset availability ──────────────────────────────────────────────────
    dataset_status = {
        k: {
            "loaded": is_loaded(k),
            "rows": int(len(get_df(k))) if is_loaded(k) else 0,
            "error": get_error(k),
        }
        for k in all_keys()
    }

    # ── KPIs ─────────────────────────────────────────────────────────────────
    kpis: dict[str, Any] = {}

    kpis["healthcare_records"] = int(len(hc)) if hc is not None else None
    kpis["emergency_records"] = int(len(er)) if er is not None else None
    kpis["patient_flow_records"] = int(len(pf)) if pf is not None else None
    kpis["insights_records"] = int(len(hi)) if hi is not None else None

    if er is not None and "Patient Waittime" in er.columns:
        kpis["avg_wait_time"] = _safe(er["Patient Waittime"].mean())
        kpis["max_wait_time"] = _safe(er["Patient Waittime"].max())
    else:
        kpis["avg_wait_time"] = None
        kpis["max_wait_time"] = None

    if er is not None and "Patient Satisfaction Score" in er.columns:
        kpis["avg_er_satisfaction"] = _safe(er["Patient Satisfaction Score"].dropna().mean())
    else:
        kpis["avg_er_satisfaction"] = None

    if hi is not None and "patients_admitted" in hi.columns:
        kpis["total_admitted_insights"] = _safe(hi["patients_admitted"].sum())
    else:
        kpis["total_admitted_insights"] = None

    if hi is not None and "avg_stay" in hi.columns:
        kpis["avg_stay_days"] = _safe(hi["avg_stay"].mean())
    else:
        kpis["avg_stay_days"] = None

    if hi is not None and "avg_satisfaction" in hi.columns:
        kpis["avg_operational_satisfaction"] = _safe(hi["avg_satisfaction"].mean())
    else:
        kpis["avg_operational_satisfaction"] = None

    if er is not None and "Patient Admission Flag" in er.columns:
        kpis["er_admitted_count"] = int(er["Patient Admission Flag"].sum())
        kpis["er_not_admitted_count"] = int((~er["Patient Admission Flag"]).sum())
    else:
        kpis["er_admitted_count"] = None
        kpis["er_not_admitted_count"] = None

    # ── Charts ────────────────────────────────────────────────────────────────
    charts: dict[str, Any] = {}

    # Admissions trend (healthcare monthly)
    if hc is not None and "Date of Admission" in hc.columns:
        try:
            tmp = hc.copy()
            tmp["adm_date"] = pd.to_datetime(tmp["Date of Admission"], errors="coerce")
            tmp = tmp.dropna(subset=["adm_date"])
            tmp["month"] = tmp["adm_date"].dt.to_period("M").astype(str)
            monthly = tmp.groupby("month").size().reset_index(name="admissions")
            charts["admissions_trend"] = monthly.sort_values("month").tail(24).to_dict(orient="records")
        except Exception as e:
            logger.warning("admissions_trend: %s", e)
            charts["admissions_trend"] = []

    # ER wait time distribution
    if er is not None and "Patient Waittime" in er.columns:
        wt = er["Patient Waittime"].dropna()
        bins = [0, 15, 30, 45, 60, 999]
        labels = ["0-15 min", "16-30 min", "31-45 min", "46-60 min", "60+ min"]
        bucketed = pd.cut(wt, bins=bins, labels=labels, right=True)
        counts = bucketed.value_counts().sort_index()
        charts["wait_time_distribution"] = [{"label": str(k), "value": int(v)} for k, v in counts.items()]

    # Service-wise admissions (hospital_insights)
    if hi is not None and "service" in hi.columns and "patients_admitted" in hi.columns:
        by_svc = hi.groupby("service")["patients_admitted"].sum().reset_index()
        charts["admissions_by_service"] = by_svc.to_dict(orient="records")

    # Avg stay by service
    if hi is not None and "service" in hi.columns and "avg_stay" in hi.columns:
        stay_svc = hi.groupby("service")["avg_stay"].mean().round(2).reset_index()
        charts["avg_stay_by_service"] = stay_svc.to_dict(orient="records")

    # Staff vs recommended by service
    if hi is not None and "service" in hi.columns and "staff_count" in hi.columns and "recommended_staff" in hi.columns:
        staff_svc = hi.groupby("service").agg(
            avg_staff=("staff_count", "mean"),
            avg_recommended=("recommended_staff", "mean"),
        ).round(2).reset_index()
        charts["staff_vs_recommended"] = staff_svc.to_dict(orient="records")

    # Department workload (ER)
    if er is not None and "Department Referral" in er.columns:
        dept = er["Department Referral"].fillna("Unknown").value_counts().head(10).reset_index()
        dept.columns = ["department", "count"]
        charts["department_workload"] = dept.to_dict(orient="records")

    # Dept avg wait
    if er is not None and "Department Referral" in er.columns and "Patient Waittime" in er.columns:
        dept_wait = er.copy()
        dept_wait["Department Referral"] = dept_wait["Department Referral"].fillna("Unknown")
        dw = dept_wait.groupby("Department Referral")["Patient Waittime"].mean().round(2).reset_index()
        dw.columns = ["department", "avg_wait"]
        charts["dept_avg_wait"] = dw.to_dict(orient="records")

    # Patient satisfaction distribution (ER)
    if er is not None and "Patient Satisfaction Score" in er.columns:
        sat = er["Patient Satisfaction Score"].dropna()
        sat_counts = sat.value_counts().sort_index()
        charts["satisfaction_distribution"] = [{"score": _safe(k), "count": int(v)} for k, v in sat_counts.items()]

    # ── Operational Insights ──────────────────────────────────────────────────
    insights: list[dict] = []

    if hi is not None and "service" in hi.columns and "patients_admitted" in hi.columns:
        by_svc = hi.groupby("service")["patients_admitted"].sum()
        top_svc = by_svc.idxmax()
        top_val = int(by_svc.max())
        insights.append({
            "title": "Highest Admission Volume Service",
            "explanation": f"'{top_svc}' has the highest total recorded admissions in the hospital_insights dataset.",
            "metric": f"{top_val} total admissions",
            "source": "hospital_insights_summary.csv",
            "period": "All 52 weeks",
            "severity": "info",
        })

    if er is not None and "Department Referral" in er.columns and "Patient Waittime" in er.columns:
        dept_wait = er.copy()
        dept_wait["Department Referral"] = dept_wait["Department Referral"].fillna("Unknown")
        dw = dept_wait.groupby("Department Referral")["Patient Waittime"].mean()
        top_dept = dw.idxmax()
        top_wait = round(float(dw.max()), 2)
        insights.append({
            "title": "Highest Average Wait Time Department",
            "explanation": f"'{top_dept}' has the highest average recorded wait time in the emergency dataset.",
            "metric": f"{top_wait} min avg wait",
            "source": "Hospital ER_Data.csv",
            "period": "Full dataset",
            "severity": "warning" if top_wait > 40 else "info",
        })

    if hi is not None and "service" in hi.columns and "avg_stay" in hi.columns:
        stay_svc = hi.groupby("service")["avg_stay"].mean()
        top_stay_svc = stay_svc.idxmax()
        top_stay_val = round(float(stay_svc.max()), 2)
        insights.append({
            "title": "Longest Average Stay Service",
            "explanation": f"'{top_stay_svc}' has the highest average recorded length of stay.",
            "metric": f"{top_stay_val} days avg stay",
            "source": "hospital_insights_summary.csv",
            "period": "All 52 weeks",
            "severity": "info",
        })

    if hi is not None and "service" in hi.columns and "staff_count" in hi.columns and "recommended_staff" in hi.columns:
        hi_copy = hi.copy()
        hi_copy["staff_diff"] = hi_copy["staff_count"] - hi_copy["recommended_staff"]
        svc_diff = hi_copy.groupby("service")["staff_diff"].mean().round(2)
        max_diff_svc = svc_diff.abs().idxmax()
        max_diff_val = round(float(svc_diff[max_diff_svc]), 2)
        direction = "above" if max_diff_val > 0 else "below"
        insights.append({
            "title": "Largest Staff Count vs Recommended Difference",
            "explanation": (
                f"'{max_diff_svc}' has the largest average difference between recorded staff_count "
                f"and recommended_staff ({abs(max_diff_val):.2f} units {direction} recommended). "
                "Note: both columns are dataset-defined values, not live staffing data."
            ),
            "metric": f"Avg diff: {max_diff_val:+.2f}",
            "source": "hospital_insights_summary.csv",
            "period": "All 52 weeks",
            "severity": "warning" if abs(max_diff_val) > 1 else "info",
        })

    if hc is not None and "Date of Admission" in hc.columns:
        try:
            tmp = hc.copy()
            tmp["adm_date"] = pd.to_datetime(tmp["Date of Admission"], errors="coerce")
            tmp = tmp.dropna(subset=["adm_date"])
            tmp["month"] = tmp["adm_date"].dt.to_period("M").astype(str)
            monthly = tmp.groupby("month").size()
            overall_avg = monthly.mean()
            last_month_val = int(monthly.iloc[-1])
            last_month_label = str(monthly.index[-1])
            direction = "above" if last_month_val > overall_avg else "below"
            insights.append({
                "title": "Recent Admissions vs Historical Average",
                "explanation": (
                    f"The most recent recorded month ({last_month_label}) had {last_month_val} admissions, "
                    f"which is {direction} the historical monthly average of {overall_avg:.0f}."
                ),
                "metric": f"{last_month_val} vs avg {overall_avg:.0f}",
                "source": "healthcare_dataset.csv",
                "period": last_month_label,
                "severity": "info",
            })
        except Exception as e:
            logger.warning("admissions insight: %s", e)

    # ── Model status ──────────────────────────────────────────────────────────
    model_status = get_all_model_status()

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "note": "All values are derived from static CSV research datasets loaded at server startup.",
        "dataset_status": dataset_status,
        "kpis": kpis,
        "charts": charts,
        "insights": insights,
        "model_status": model_status,
    }
