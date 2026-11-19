"""
anomaly_detection.py — statistical and data-quality anomaly detection
for PulseNova datasets. Uses IQR and Z-score methods only.
No original data is modified.
"""
import math
import logging
from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd

from app.data_loader import get_df

logger = logging.getLogger(__name__)

DISCLAIMER = (
    "Anomaly flags indicate statistical or data-quality deviations in the available dataset. "
    "They are not diagnoses, confirmed incidents, or clinical alerts."
)


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
    return v


def _severity(score: float, low: float = 1.5, high: float = 3.0) -> str:
    if score >= high:
        return "high"
    if score >= low:
        return "medium"
    return "low"


# ── A. High ER Wait Times ─────────────────────────────────────────────────────

def detect_high_wait_times(method: str = "iqr", multiplier: float = 1.5) -> list[dict]:
    er = get_df("emergency")
    if er is None or "Patient Waittime" not in er.columns:
        return []

    wt = er["Patient Waittime"].dropna()
    if len(wt) < 4:
        return []

    anomalies = []
    detected_at = datetime.now(timezone.utc).isoformat()

    if method == "iqr":
        q1, q3 = float(wt.quantile(0.25)), float(wt.quantile(0.75))
        iqr = q3 - q1
        lower = q1 - multiplier * iqr
        upper = q3 + multiplier * iqr
        flagged = er[er["Patient Waittime"].notna() & (er["Patient Waittime"] > upper)].copy()
        baseline = f"IQR upper fence: {upper:.2f} min (Q3={q3:.2f}, IQR={iqr:.2f}, ×{multiplier})"
        for idx, row in flagged.iterrows():
            val = float(row["Patient Waittime"])
            score = (val - upper) / (iqr if iqr > 0 else 1)
            dept = str(row.get("Department Referral", "Unknown") or "Unknown")
            date_raw = row.get("Patient Admission Date", None)
            anomalies.append({
                "id": f"wait_iqr_{idx}",
                "category": "high_wait_time",
                "dataset": "emergency",
                "date": str(date_raw) if date_raw else None,
                "service_or_dept": dept,
                "observed_value": round(val, 2),
                "expected_range": f"≤ {upper:.2f} min",
                "anomaly_score": round(score, 4),
                "severity": _severity(score),
                "explanation": f"Wait time {val:.1f} min exceeds IQR upper fence of {upper:.2f} min.",
                "detection_method": f"IQR (×{multiplier})",
                "supporting_fields": {"q1": round(q1, 2), "q3": round(q3, 2), "iqr": round(iqr, 2), "upper_fence": round(upper, 2)},
                "detected_at": detected_at,
                "baseline": baseline,
            })

    elif method == "zscore":
        mean, std = float(wt.mean()), float(wt.std())
        if std < 1e-9:
            return []
        threshold = multiplier  # multiplier reused as z-threshold
        z_scores = (er["Patient Waittime"] - mean) / std
        flagged = er[er["Patient Waittime"].notna() & (z_scores > threshold)].copy()
        baseline = f"Z-score threshold: {threshold} (mean={mean:.2f}, std={std:.2f})"
        for idx, row in flagged.iterrows():
            val = float(row["Patient Waittime"])
            z = float((val - mean) / std)
            dept = str(row.get("Department Referral", "Unknown") or "Unknown")
            date_raw = row.get("Patient Admission Date", None)
            anomalies.append({
                "id": f"wait_z_{idx}",
                "category": "high_wait_time",
                "dataset": "emergency",
                "date": str(date_raw) if date_raw else None,
                "service_or_dept": dept,
                "observed_value": round(val, 2),
                "expected_range": f"mean ± {threshold}σ ({mean:.2f} ± {threshold*std:.2f})",
                "anomaly_score": round(z, 4),
                "severity": _severity(z, low=threshold, high=threshold * 1.5),
                "explanation": f"Wait time {val:.1f} min has Z-score {z:.2f} (threshold >{threshold}).",
                "detection_method": f"Z-score (threshold={threshold})",
                "supporting_fields": {"mean": round(mean, 2), "std": round(std, 2), "z_score": round(z, 4)},
                "detected_at": detected_at,
                "baseline": baseline,
            })

    return anomalies


# ── B. Unusual Admission Volume (weekly, hospital_insights) ───────────────────

def detect_unusual_admissions(method: str = "iqr", multiplier: float = 1.5) -> list[dict]:
    hi = get_df("hospital_insights")
    if hi is None or "patients_admitted" not in hi.columns or "week" not in hi.columns:
        return []

    weekly = hi.groupby("week")["patients_admitted"].sum()
    if len(weekly) < 4:
        return []

    anomalies = []
    detected_at = datetime.now(timezone.utc).isoformat()

    if method == "iqr":
        q1, q3 = float(weekly.quantile(0.25)), float(weekly.quantile(0.75))
        iqr = q3 - q1
        upper = q3 + multiplier * iqr
        lower = q1 - multiplier * iqr
        baseline = f"IQR bounds: [{lower:.1f}, {upper:.1f}]"
        for week, val in weekly.items():
            val = float(val)
            if val > upper or val < lower:
                score = max(abs(val - upper), abs(val - lower)) / (iqr if iqr > 0 else 1)
                direction = "high" if val > upper else "low"
                anomalies.append({
                    "id": f"admissions_iqr_w{week}",
                    "category": "unusual_admission_volume",
                    "dataset": "hospital_insights",
                    "date": f"Week {week}",
                    "service_or_dept": "All services",
                    "observed_value": round(val, 2),
                    "expected_range": f"[{lower:.1f}, {upper:.1f}]",
                    "anomaly_score": round(score, 4),
                    "severity": _severity(score),
                    "explanation": f"Week {week} total admissions ({val:.0f}) is unusually {direction} (IQR bounds: {lower:.1f}–{upper:.1f}).",
                    "detection_method": f"IQR (×{multiplier})",
                    "supporting_fields": {"week": int(week), "q1": round(q1, 2), "q3": round(q3, 2), "iqr": round(iqr, 2)},
                    "detected_at": detected_at,
                    "baseline": baseline,
                })

    elif method == "zscore":
        mean, std = float(weekly.mean()), float(weekly.std())
        if std < 1e-9:
            return []
        threshold = multiplier
        for week, val in weekly.items():
            val = float(val)
            z = (val - mean) / std
            if abs(z) > threshold:
                anomalies.append({
                    "id": f"admissions_z_w{week}",
                    "category": "unusual_admission_volume",
                    "dataset": "hospital_insights",
                    "date": f"Week {week}",
                    "service_or_dept": "All services",
                    "observed_value": round(val, 2),
                    "expected_range": f"mean ± {threshold}σ ({mean:.2f} ± {threshold*std:.2f})",
                    "anomaly_score": round(abs(z), 4),
                    "severity": _severity(abs(z), low=threshold, high=threshold * 1.5),
                    "explanation": f"Week {week} admissions Z-score {z:.2f} exceeds threshold ±{threshold}.",
                    "detection_method": f"Z-score (threshold={threshold})",
                    "supporting_fields": {"week": int(week), "mean": round(mean, 2), "std": round(std, 2), "z_score": round(z, 4)},
                    "detected_at": detected_at,
                    "baseline": f"mean={mean:.2f}, std={std:.2f}",
                })

    return anomalies


# ── C. Operational Workload Anomalies ─────────────────────────────────────────

def detect_operational_anomalies(method: str = "iqr", multiplier: float = 1.5) -> list[dict]:
    hi = get_df("hospital_insights")
    if hi is None:
        return []

    cols_to_check = ["avg_stay", "avg_satisfaction", "max_occupancy"]
    anomalies = []
    detected_at = datetime.now(timezone.utc).isoformat()

    for col in cols_to_check:
        if col not in hi.columns:
            continue
        series = hi[col].dropna()
        if len(series) < 4:
            continue

        if method == "iqr":
            q1, q3 = float(series.quantile(0.25)), float(series.quantile(0.75))
            iqr = q3 - q1
            upper = q3 + multiplier * iqr
            lower = q1 - multiplier * iqr
            flagged = hi[(hi[col].notna()) & ((hi[col] > upper) | (hi[col] < lower))].copy()
            for idx, row in flagged.iterrows():
                val = float(row[col])
                score = max(abs(val - upper), abs(val - lower)) / (iqr if iqr > 0 else 1)
                svc = str(row.get("service", "Unknown"))
                week = row.get("week", None)
                anomalies.append({
                    "id": f"ops_{col}_iqr_{idx}",
                    "category": "operational_workload",
                    "dataset": "hospital_insights",
                    "date": f"Week {week}" if week is not None else None,
                    "service_or_dept": svc,
                    "observed_value": round(val, 4),
                    "expected_range": f"[{lower:.2f}, {upper:.2f}]",
                    "anomaly_score": round(score, 4),
                    "severity": _severity(score),
                    "explanation": f"{col} value {val:.2f} for {svc} (week {week}) is outside IQR bounds [{lower:.2f}, {upper:.2f}].",
                    "detection_method": f"IQR (×{multiplier})",
                    "supporting_fields": {"column": col, "q1": round(q1, 2), "q3": round(q3, 2), "iqr": round(iqr, 2)},
                    "detected_at": detected_at,
                    "baseline": f"IQR bounds: [{lower:.2f}, {upper:.2f}]",
                })

        elif method == "zscore":
            mean, std = float(series.mean()), float(series.std())
            if std < 1e-9:
                continue
            threshold = multiplier
            flagged = hi[(hi[col].notna()) & (((hi[col] - mean) / std).abs() > threshold)].copy()
            for idx, row in flagged.iterrows():
                val = float(row[col])
                z = (val - mean) / std
                svc = str(row.get("service", "Unknown"))
                week = row.get("week", None)
                anomalies.append({
                    "id": f"ops_{col}_z_{idx}",
                    "category": "operational_workload",
                    "dataset": "hospital_insights",
                    "date": f"Week {week}" if week is not None else None,
                    "service_or_dept": svc,
                    "observed_value": round(val, 4),
                    "expected_range": f"mean ± {threshold}σ ({mean:.2f} ± {threshold*std:.2f})",
                    "anomaly_score": round(abs(z), 4),
                    "severity": _severity(abs(z), low=threshold, high=threshold * 1.5),
                    "explanation": f"{col} Z-score {z:.2f} for {svc} (week {week}) exceeds threshold ±{threshold}.",
                    "detection_method": f"Z-score (threshold={threshold})",
                    "supporting_fields": {"column": col, "mean": round(mean, 2), "std": round(std, 2), "z_score": round(z, 4)},
                    "detected_at": detected_at,
                    "baseline": f"mean={mean:.2f}, std={std:.2f}",
                })

    return anomalies


# ── D. Staffing Discrepancy ───────────────────────────────────────────────────

def detect_staffing_discrepancy(threshold: float = 2.0) -> list[dict]:
    hi = get_df("hospital_insights")
    if hi is None or "staff_count" not in hi.columns or "recommended_staff" not in hi.columns:
        return []

    anomalies = []
    detected_at = datetime.now(timezone.utc).isoformat()
    hi_copy = hi.copy()
    hi_copy["diff"] = hi_copy["staff_count"] - hi_copy["recommended_staff"]
    flagged = hi_copy[hi_copy["diff"].abs() > threshold]

    for idx, row in flagged.iterrows():
        diff = float(row["diff"])
        svc = str(row.get("service", "Unknown"))
        week = row.get("week", None)
        recorded = float(row["staff_count"])
        recommended = float(row["recommended_staff"])
        anomalies.append({
            "id": f"staff_disc_{idx}",
            "category": "staffing_discrepancy",
            "dataset": "hospital_insights",
            "date": f"Week {week}" if week is not None else None,
            "service_or_dept": svc,
            "observed_value": recorded,
            "expected_range": f"recommended_staff = {recommended}",
            "anomaly_score": round(abs(diff), 4),
            "severity": "high" if abs(diff) > 5 else "medium" if abs(diff) > 3 else "low",
            "explanation": (
                f"Recorded staff_count ({recorded:.0f}) differs from recommended_staff ({recommended:.0f}) "
                f"by {diff:+.0f} for {svc} in week {week}. "
                "Both values are dataset-defined; this is not a confirmed staffing shortage."
            ),
            "detection_method": f"Absolute difference > {threshold}",
            "supporting_fields": {
                "staff_count": recorded,
                "recommended_staff": recommended,
                "difference": round(diff, 2),
            },
            "detected_at": detected_at,
            "baseline": f"recommended_staff = {recommended}",
        })

    return anomalies


# ── E. Data Quality Anomalies ─────────────────────────────────────────────────

def detect_data_quality() -> list[dict]:
    anomalies = []
    detected_at = datetime.now(timezone.utc).isoformat()

    # Healthcare: negative billing
    hc = get_df("healthcare")
    if hc is not None and "Billing Amount" in hc.columns:
        neg = hc[hc["Billing Amount"] < 0]
        if len(neg) > 0:
            anomalies.append({
                "id": "dq_negative_billing",
                "category": "data_quality",
                "dataset": "healthcare",
                "date": None,
                "service_or_dept": None,
                "observed_value": int(len(neg)),
                "expected_range": "Billing Amount ≥ 0",
                "anomaly_score": None,
                "severity": "medium",
                "explanation": f"{len(neg)} records have negative Billing Amount values. These may be adjustments or data entry errors.",
                "detection_method": "Rule: Billing Amount < 0",
                "supporting_fields": {"count": int(len(neg)), "min_value": round(float(neg["Billing Amount"].min()), 2)},
                "detected_at": detected_at,
                "baseline": "Billing Amount should be ≥ 0",
            })

    # Healthcare: missing required fields
    if hc is not None:
        for col in ["Age", "Gender", "Medical Condition", "Date of Admission"]:
            if col in hc.columns:
                missing = int(hc[col].isnull().sum())
                if missing > 0:
                    anomalies.append({
                        "id": f"dq_missing_{col.lower().replace(' ', '_')}",
                        "category": "data_quality",
                        "dataset": "healthcare",
                        "date": None,
                        "service_or_dept": None,
                        "observed_value": missing,
                        "expected_range": "0 missing values",
                        "anomaly_score": None,
                        "severity": "low",
                        "explanation": f"{missing} records have missing '{col}' values.",
                        "detection_method": "Null check",
                        "supporting_fields": {"column": col, "missing_count": missing},
                        "detected_at": detected_at,
                        "baseline": "No missing values expected",
                    })

    # Emergency: missing satisfaction scores
    er = get_df("emergency")
    if er is not None and "Patient Satisfaction Score" in er.columns:
        missing_sat = int(er["Patient Satisfaction Score"].isnull().sum())
        if missing_sat > 0:
            pct = round(missing_sat / len(er) * 100, 1)
            anomalies.append({
                "id": "dq_missing_satisfaction",
                "category": "data_quality",
                "dataset": "emergency",
                "date": None,
                "service_or_dept": None,
                "observed_value": missing_sat,
                "expected_range": "0 missing values",
                "anomaly_score": None,
                "severity": "medium" if pct > 50 else "low",
                "explanation": f"{missing_sat} records ({pct}%) have missing Patient Satisfaction Score.",
                "detection_method": "Null check",
                "supporting_fields": {"missing_count": missing_sat, "pct_missing": pct},
                "detected_at": detected_at,
                "baseline": "No missing values expected",
            })

    # Hospital insights: duplicate rows
    hi = get_df("hospital_insights")
    if hi is not None:
        dups = int(hi.duplicated().sum())
        if dups > 0:
            anomalies.append({
                "id": "dq_duplicates_insights",
                "category": "data_quality",
                "dataset": "hospital_insights",
                "date": None,
                "service_or_dept": None,
                "observed_value": dups,
                "expected_range": "0 duplicate rows",
                "anomaly_score": None,
                "severity": "low",
                "explanation": f"{dups} duplicate rows detected in hospital_insights dataset.",
                "detection_method": "Duplicate row check",
                "supporting_fields": {"duplicate_count": dups},
                "detected_at": detected_at,
                "baseline": "No duplicate rows expected",
            })

    return anomalies


# ── Main detection entry point ────────────────────────────────────────────────

def run_detection(
    dataset: str | None = None,
    category: str | None = None,
    method: str = "iqr",
    multiplier: float = 1.5,
) -> dict:
    all_anomalies: list[dict] = []

    run_wait = (dataset in (None, "emergency")) and (category in (None, "high_wait_time"))
    run_admissions = (dataset in (None, "hospital_insights")) and (category in (None, "unusual_admission_volume"))
    run_ops = (dataset in (None, "hospital_insights")) and (category in (None, "operational_workload"))
    run_staff = (dataset in (None, "hospital_insights")) and (category in (None, "staffing_discrepancy"))
    run_dq = category in (None, "data_quality")

    if run_wait:
        all_anomalies.extend(detect_high_wait_times(method=method, multiplier=multiplier))
    if run_admissions:
        all_anomalies.extend(detect_unusual_admissions(method=method, multiplier=multiplier))
    if run_ops:
        all_anomalies.extend(detect_operational_anomalies(method=method, multiplier=multiplier))
    if run_staff:
        all_anomalies.extend(detect_staffing_discrepancy())
    if run_dq:
        all_anomalies.extend(detect_data_quality())

    # Summary
    by_category: dict[str, int] = {}
    by_severity: dict[str, int] = {}
    for a in all_anomalies:
        by_category[a["category"]] = by_category.get(a["category"], 0) + 1
        sev = a.get("severity") or "unknown"
        by_severity[sev] = by_severity.get(sev, 0) + 1

    return {
        "total": len(all_anomalies),
        "by_category": by_category,
        "by_severity": by_severity,
        "anomalies": all_anomalies,
        "detection_config": {
            "method": method,
            "multiplier": multiplier,
            "dataset_filter": dataset,
            "category_filter": category,
        },
        "detected_at": datetime.now(timezone.utc).isoformat(),
        "disclaimer": DISCLAIMER,
    }


def get_summary() -> dict:
    result = run_detection()
    return {
        "total": result["total"],
        "by_category": result["by_category"],
        "by_severity": result["by_severity"],
        "disclaimer": DISCLAIMER,
    }
