"""
analytics_service.py — computes KPIs and chart data from loaded DataFrames.
All values are derived from actual dataset columns. Nothing is fabricated.
"""
import math
import logging
from typing import Any

import numpy as np
import pandas as pd

from app.data_loader import get_df

logger = logging.getLogger(__name__)


def _safe(v: Any) -> Any:
    if v is None:
        return None
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return None if math.isnan(float(v)) else round(float(v), 4)
    if isinstance(v, (np.bool_,)):
        return bool(v)
    if isinstance(v, pd.Timestamp):
        return v.isoformat()
    return v


def _top_n(series: pd.Series, n: int = 10) -> list:
    counts = series.dropna().value_counts().head(n)
    return [{"label": str(k), "value": int(v)} for k, v in counts.items()]


# ── Dashboard ─────────────────────────────────────────────────────────────────

def get_dashboard_analytics() -> dict:
    hc = get_df("healthcare")
    er = get_df("emergency")
    hi = get_df("hospital_insights")
    pf = get_df("patient_flow")

    kpis: dict[str, Any] = {}

    if hc is not None:
        kpis["healthcare_records"] = int(len(hc))
        kpis["avg_billing"] = _safe(hc["Billing Amount"].mean()) if "Billing Amount" in hc.columns else None
        if "Date of Admission" in hc.columns and "Discharge Date" in hc.columns:
            try:
                adm = pd.to_datetime(hc["Date of Admission"], errors="coerce")
                dis = pd.to_datetime(hc["Discharge Date"], errors="coerce")
                los = (dis - adm).dt.days
                kpis["avg_los_days"] = _safe(los[los >= 0].mean())
            except Exception:
                kpis["avg_los_days"] = None
    else:
        kpis["healthcare_records"] = None

    if er is not None:
        kpis["emergency_records"] = int(len(er))
        kpis["avg_wait_time"] = _safe(er["Patient Waittime"].mean()) if "Patient Waittime" in er.columns else None
        kpis["avg_satisfaction"] = _safe(er["Patient Satisfaction Score"].dropna().mean()) if "Patient Satisfaction Score" in er.columns else None
    else:
        kpis["emergency_records"] = None

    if hi is not None:
        kpis["insights_records"] = int(len(hi))
        kpis["total_admitted_insights"] = _safe(hi["patients_admitted"].sum()) if "patients_admitted" in hi.columns else None
    else:
        kpis["insights_records"] = None

    kpis["patient_flow_records"] = int(len(pf)) if pf is not None else None

    charts: dict[str, Any] = {}

    # Admissions trend (healthcare, monthly, last 24 months)
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

    if hc is not None and "Medical Condition" in hc.columns:
        charts["medical_conditions"] = _top_n(hc["Medical Condition"], 10)

    if hc is not None and "Admission Type" in hc.columns:
        charts["admission_types"] = _top_n(hc["Admission Type"], 5)

    if er is not None and "Patient Waittime" in er.columns:
        wt = er["Patient Waittime"].dropna()
        bins = [0, 15, 30, 45, 60, 999]
        labels = ["0-15 min", "16-30 min", "31-45 min", "46-60 min", "60+ min"]
        bucketed = pd.cut(wt, bins=bins, labels=labels, right=True)
        counts = bucketed.value_counts().sort_index()
        charts["wait_time_distribution"] = [{"label": str(k), "value": int(v)} for k, v in counts.items()]

    if er is not None and "Department Referral" in er.columns:
        charts["department_referrals"] = _top_n(er["Department Referral"].fillna("Unknown"), 10)

    if hi is not None and "week" in hi.columns and "patients_admitted" in hi.columns:
        weekly = hi.groupby("week")["patients_admitted"].sum().reset_index()
        charts["weekly_admissions"] = weekly.to_dict(orient="records")

    return {"kpis": kpis, "charts": charts}


# ── Patient Analytics ─────────────────────────────────────────────────────────

def get_patient_analytics(
    gender: str | None = None,
    admission_type: str | None = None,
    medical_condition: str | None = None,
    age_min: int | None = None,
    age_max: int | None = None,
) -> dict:
    hc = get_df("healthcare")
    if hc is None:
        return {"error": "Healthcare dataset not loaded"}

    df = hc.copy()
    if gender:
        df = df[df["Gender"].str.lower() == gender.lower()]
    if admission_type:
        df = df[df["Admission Type"].str.lower() == admission_type.lower()]
    if medical_condition:
        df = df[df["Medical Condition"].str.lower() == medical_condition.lower()]
    if age_min is not None:
        df = df[df["Age"] >= age_min]
    if age_max is not None:
        df = df[df["Age"] <= age_max]

    kpis: dict[str, Any] = {
        "total_records": int(len(df)),
        "avg_age": _safe(df["Age"].mean()) if "Age" in df.columns else None,
        "avg_billing": _safe(df["Billing Amount"].mean()) if "Billing Amount" in df.columns else None,
        "top_condition": str(df["Medical Condition"].mode().iloc[0]) if "Medical Condition" in df.columns and len(df) > 0 else None,
    }

    if "Date of Admission" in df.columns and "Discharge Date" in df.columns:
        try:
            adm = pd.to_datetime(df["Date of Admission"], errors="coerce")
            dis = pd.to_datetime(df["Discharge Date"], errors="coerce")
            los = (dis - adm).dt.days
            kpis["avg_los_days"] = _safe(los[los >= 0].mean())
        except Exception:
            kpis["avg_los_days"] = None

    charts: dict[str, Any] = {}

    if "Age" in df.columns:
        bins = [0, 17, 34, 54, 74, 200]
        labels = ["0-17", "18-34", "35-54", "55-74", "75+"]
        df2 = df.copy()
        df2["age_group"] = pd.cut(df2["Age"], bins=bins, labels=labels, right=True)
        ag = df2["age_group"].value_counts().sort_index()
        charts["age_groups"] = [{"label": str(k), "value": int(v)} for k, v in ag.items()]

    if "Gender" in df.columns:
        charts["gender"] = _top_n(df["Gender"], 5)
    if "Medical Condition" in df.columns:
        charts["medical_conditions"] = _top_n(df["Medical Condition"], 10)
    if "Admission Type" in df.columns:
        charts["admission_types"] = _top_n(df["Admission Type"], 5)
    if "Medication" in df.columns:
        charts["medications"] = _top_n(df["Medication"], 10)
    if "Test Results" in df.columns:
        charts["test_results"] = _top_n(df["Test Results"], 5)
    if "Insurance Provider" in df.columns:
        charts["insurance_providers"] = _top_n(df["Insurance Provider"], 10)

    if "Medical Condition" in df.columns and "Billing Amount" in df.columns:
        billing = df.groupby("Medical Condition")["Billing Amount"].mean().round(2).reset_index()
        billing.columns = ["condition", "avg_billing"]
        charts["billing_by_condition"] = billing.to_dict(orient="records")

    if "Date of Admission" in df.columns:
        try:
            tmp = df.copy()
            tmp["adm_date"] = pd.to_datetime(tmp["Date of Admission"], errors="coerce")
            tmp = tmp.dropna(subset=["adm_date"])
            tmp["month"] = tmp["adm_date"].dt.to_period("M").astype(str)
            monthly = tmp.groupby("month").size().reset_index(name="admissions")
            charts["admission_trend"] = monthly.sort_values("month").tail(24).to_dict(orient="records")
        except Exception:
            charts["admission_trend"] = []

    filter_options = {
        "genders": sorted(hc["Gender"].dropna().unique().tolist()) if "Gender" in hc.columns else [],
        "admission_types": sorted(hc["Admission Type"].dropna().unique().tolist()) if "Admission Type" in hc.columns else [],
        "medical_conditions": sorted(hc["Medical Condition"].dropna().unique().tolist()) if "Medical Condition" in hc.columns else [],
    }

    return {"kpis": kpis, "charts": charts, "filter_options": filter_options}


# ── Emergency & Patient Flow ──────────────────────────────────────────────────

def get_emergency_analytics(
    department: str | None = None,
    gender: str | None = None,
    age_min: int | None = None,
    age_max: int | None = None,
    wait_min: float | None = None,
    wait_max: float | None = None,
) -> dict:
    er = get_df("emergency")
    pf = get_df("patient_flow")

    if er is None and pf is None:
        return {"error": "Emergency and patient flow datasets not loaded"}

    df = er.copy() if er is not None else pd.DataFrame()

    if len(df) > 0:
        if department:
            df = df[df["Department Referral"].fillna("Unknown").str.lower() == department.lower()]
        if gender:
            df = df[df["Patient Gender"].str.upper() == gender.upper()]
        if age_min is not None:
            df = df[df["Patient Age"] >= age_min]
        if age_max is not None:
            df = df[df["Patient Age"] <= age_max]
        if wait_min is not None:
            df = df[df["Patient Waittime"] >= wait_min]
        if wait_max is not None:
            df = df[df["Patient Waittime"] <= wait_max]

    kpis: dict[str, Any] = {"total_records": int(len(df))}

    if len(df) > 0:
        if "Patient Waittime" in df.columns:
            kpis["avg_wait_time"] = _safe(df["Patient Waittime"].mean())
            kpis["median_wait_time"] = _safe(df["Patient Waittime"].median())
            kpis["max_wait_time"] = _safe(df["Patient Waittime"].max())
        if "Patient Satisfaction Score" in df.columns:
            kpis["avg_satisfaction"] = _safe(df["Patient Satisfaction Score"].dropna().mean())
        if "Patient Admission Flag" in df.columns:
            admitted = int(df["Patient Admission Flag"].sum())
            kpis["admitted_count"] = admitted
            kpis["not_admitted_count"] = int(len(df) - admitted)

    charts: dict[str, Any] = {}

    if len(df) > 0:
        if "Patient Waittime" in df.columns:
            wt = df["Patient Waittime"].dropna()
            bins = [0, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 999]
            labels = ["≤15", "16-20", "21-25", "26-30", "31-35", "36-40", "41-45", "46-50", "51-55", "56-60", "60+"]
            bucketed = pd.cut(wt, bins=bins, labels=labels, right=True)
            counts = bucketed.value_counts().sort_index()
            charts["wait_time_distribution"] = [{"label": str(k), "value": int(v)} for k, v in counts.items()]

        if "Department Referral" in df.columns and "Patient Waittime" in df.columns:
            df2 = df.copy()
            df2["Department Referral"] = df2["Department Referral"].fillna("Unknown")
            dept_avg = df2.groupby("Department Referral")["Patient Waittime"].mean().round(2).reset_index()
            dept_avg.columns = ["department", "avg_wait"]
            charts["dept_avg_wait"] = dept_avg.to_dict(orient="records")
            dept_cnt = df2.groupby("Department Referral").size().reset_index(name="count")
            dept_cnt.columns = ["department", "count"]
            charts["dept_record_count"] = dept_cnt.to_dict(orient="records")

        if "Patient Satisfaction Score" in df.columns:
            sat = df["Patient Satisfaction Score"].dropna()
            sat_counts = sat.value_counts().sort_index()
            charts["satisfaction_distribution"] = [{"score": _safe(k), "count": int(v)} for k, v in sat_counts.items()]

        if "Patient Admission Date" in df.columns:
            try:
                tmp = df.copy()
                tmp["adm_date"] = pd.to_datetime(tmp["Patient Admission Date"], errors="coerce", dayfirst=True)
                tmp = tmp.dropna(subset=["adm_date"])
                tmp["month"] = tmp["adm_date"].dt.to_period("M").astype(str)
                monthly = tmp.groupby("month").size().reset_index(name="count")
                charts["admission_volume_by_month"] = monthly.sort_values("month").to_dict(orient="records")
            except Exception as e:
                logger.warning("emergency monthly: %s", e)
                charts["admission_volume_by_month"] = []

        if "Patient Age" in df.columns:
            bins = [0, 17, 34, 54, 74, 200]
            labels = ["0-17", "18-34", "35-54", "55-74", "75+"]
            df3 = df.copy()
            df3["age_group"] = pd.cut(df3["Patient Age"], bins=bins, labels=labels, right=True)
            ag = df3["age_group"].value_counts().sort_index()
            charts["age_distribution"] = [{"label": str(k), "value": int(v)} for k, v in ag.items()]

        if "Patient Gender" in df.columns:
            charts["gender_distribution"] = _top_n(df["Patient Gender"], 5)
        if "Patient Race" in df.columns:
            charts["race_distribution"] = _top_n(df["Patient Race"], 10)
        if "Patient Admission Flag" in df.columns:
            charts["admission_flag"] = [
                {"label": "Admitted", "value": int(df["Patient Admission Flag"].sum())},
                {"label": "Not Admitted", "value": int((~df["Patient Admission Flag"]).sum())},
            ]

    # Time of day from patient_flow (separate, not merged)
    if pf is not None and "Patient Admission Time" in pf.columns:
        try:
            tmp = pf.copy()
            tmp["time"] = pd.to_datetime(tmp["Patient Admission Time"], errors="coerce", format="%I:%M:%S %p")
            tmp = tmp.dropna(subset=["time"])
            tmp["hour"] = tmp["time"].dt.hour
            hourly = tmp.groupby("hour").size().reset_index(name="count")
            charts["admissions_by_hour"] = hourly.to_dict(orient="records")
        except Exception as e:
            logger.warning("admissions_by_hour: %s", e)

    filter_options = {}
    if er is not None:
        if "Department Referral" in er.columns:
            filter_options["departments"] = sorted(er["Department Referral"].dropna().unique().tolist())
        if "Patient Gender" in er.columns:
            filter_options["genders"] = sorted(er["Patient Gender"].dropna().unique().tolist())

    return {"kpis": kpis, "charts": charts, "filter_options": filter_options}


# ── Operational Efficiency ────────────────────────────────────────────────────

def get_operations_analytics(
    service: str | None = None,
    week_min: int | None = None,
    week_max: int | None = None,
) -> dict:
    hi = get_df("hospital_insights")
    if hi is None:
        return {"error": "Hospital insights dataset not loaded"}

    df = hi.copy()
    if service:
        df = df[df["service"].str.lower() == service.lower()]
    if week_min is not None:
        df = df[df["week"] >= week_min]
    if week_max is not None:
        df = df[df["week"] <= week_max]

    kpis: dict[str, Any] = {
        "total_records": int(len(df)),
        "total_patients_admitted": _safe(df["patients_admitted"].sum()) if "patients_admitted" in df.columns else None,
        "avg_stay": _safe(df["avg_stay"].mean()) if "avg_stay" in df.columns else None,
        "avg_satisfaction": _safe(df["avg_satisfaction"].mean()) if "avg_satisfaction" in df.columns else None,
        "avg_staff_count": _safe(df["staff_count"].mean()) if "staff_count" in df.columns else None,
        "avg_recommended_staff": _safe(df["recommended_staff"].mean()) if "recommended_staff" in df.columns else None,
        "max_occupancy_observed": _safe(df["max_occupancy"].max()) if "max_occupancy" in df.columns else None,
    }

    charts: dict[str, Any] = {}

    if "week" in df.columns and "patients_admitted" in df.columns:
        weekly = df.groupby("week")["patients_admitted"].sum().reset_index()
        charts["admissions_by_week"] = weekly.to_dict(orient="records")

    if "service" in df.columns and "patients_admitted" in df.columns:
        by_svc = df.groupby("service")["patients_admitted"].sum().reset_index()
        charts["admissions_by_service"] = by_svc.to_dict(orient="records")

    if "service" in df.columns and "avg_stay" in df.columns:
        stay_svc = df.groupby("service")["avg_stay"].mean().round(2).reset_index()
        charts["avg_stay_by_service"] = stay_svc.to_dict(orient="records")

    if "service" in df.columns and "avg_satisfaction" in df.columns:
        sat_svc = df.groupby("service")["avg_satisfaction"].mean().round(2).reset_index()
        charts["avg_satisfaction_by_service"] = sat_svc.to_dict(orient="records")

    if "service" in df.columns and "staff_count" in df.columns and "recommended_staff" in df.columns:
        staff_svc = df.groupby("service").agg(
            avg_staff=("staff_count", "mean"),
            avg_recommended=("recommended_staff", "mean")
        ).round(2).reset_index()
        charts["staff_vs_recommended"] = staff_svc.to_dict(orient="records")

    if "service" in df.columns and "max_occupancy" in df.columns:
        occ_svc = df.groupby("service")["max_occupancy"].mean().round(2).reset_index()
        charts["occupancy_by_service"] = occ_svc.to_dict(orient="records")

    if "week" in df.columns and "max_occupancy" in df.columns:
        occ_week = df.groupby("week")["max_occupancy"].mean().round(2).reset_index()
        charts["occupancy_by_week"] = occ_week.to_dict(orient="records")

    if "service" in df.columns:
        svc_table = df.groupby("service").agg(
            total_admitted=("patients_admitted", "sum"),
            avg_stay=("avg_stay", "mean"),
            avg_satisfaction=("avg_satisfaction", "mean"),
            avg_staff=("staff_count", "mean"),
            avg_recommended=("recommended_staff", "mean"),
            avg_occupancy=("max_occupancy", "mean"),
        ).round(2).reset_index()
        charts["service_comparison"] = svc_table.to_dict(orient="records")

    filter_options = {
        "services": sorted(hi["service"].dropna().unique().tolist()) if "service" in hi.columns else [],
        "week_min": int(hi["week"].min()) if "week" in hi.columns else 1,
        "week_max": int(hi["week"].max()) if "week" in hi.columns else 52,
    }

    return {"kpis": kpis, "charts": charts, "filter_options": filter_options}
