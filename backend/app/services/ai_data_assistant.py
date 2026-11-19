"""
ai_data_assistant.py — deterministic question-answering assistant for PulseNova.
Maps natural-language questions to approved analytics operations.
No LLM required. No arbitrary code execution. No fabricated answers.
"""
import re
import logging
from datetime import datetime, timezone
from typing import Any

import pandas as pd

from app.data_loader import get_df, get_metadata, all_keys
from app.services.model_loader import get_all_model_status, VALID_SERVICES
from app.services.analytics_service import (
    get_dashboard_analytics,
    get_operations_analytics,
    get_emergency_analytics,
    get_patient_analytics,
)
from app.services.evaluation_service import (
    get_classification_evaluation,
    get_arima_evaluation,
    get_feature_importance,
)
from app.services.admissions_forecast import get_forecast

logger = logging.getLogger(__name__)

DISCLAIMER = (
    "PulseNova is an academic healthcare analytics platform. "
    "Its statistics, anomaly flags, and model outputs are exploratory "
    "and are not substitutes for professional clinical or hospital management decisions."
)


# ── Intent patterns ───────────────────────────────────────────────────────────

INTENTS = [
    # Most specific first — model / prediction
    ("arima_forecast",         r"(arima|forecast|predict.*admission|admission.*forecast)"),
    ("feature_importance",     r"(feature importance|important feature|which feature)"),
    ("model_metrics",          r"(accuracy|f1|precision|recall|metric|performance|evaluation)"),
    ("model_status",           r"(model status|model loaded|is.*model|xgboost.*available|random forest.*available)"),

    # Operational — specific patterns before generic
    ("highest_admission",      r"(highest|most|top|maximum).*(admission|admitted)|(admission|admitted).*(highest|most|top|maximum|volume)"),
    ("highest_stay",           r"(highest|longest|most|maximum).*(stay|los)|(stay|los).*(highest|longest|most|maximum)"),
    ("staff_vs_recommended",   r"(staff|staffing).*(recommend|vs|versus|compare|difference)"),
    ("service_comparison",     r"(compare|comparison).*(service|icu|surgery|general)"),
    ("admissions_by_service",  r"(admission|admitted).*(service|icu|surgery|general|by service)"),
    ("avg_stay_by_service",    r"(stay|length of stay|los).*(service|icu|surgery|general|by service)"),

    # Emergency — specific before generic
    ("dept_wait_time",         r"(department|dept).*(wait|waiting)"),
    ("median_wait_time",       r"(median).*(wait|waiting)"),
    ("avg_wait_time",          r"(average|mean|avg).*(wait|waiting|wait time)|(wait time|waiting time)"),
    ("satisfaction_dist",      r"(satisfaction|patient satisfaction|score distribution)"),
    ("er_records",             r"(emergency|er|a&e).*(record|count|total|how many)"),

    # Patient analytics
    ("admission_trend",        r"(admission trend|monthly admission|trend over time)"),
    ("admission_types",        r"(admission type|elective|urgent)"),
    ("condition_distribution", r"(condition|diagnosis|disease|medical condition)"),
    ("billing_stats",          r"(billing|cost|charge|payment|amount)"),
    ("age_distribution",       r"(age group|age distribution|age breakdown)"),

    # Dataset overview — broad patterns last
    ("missing_values",         r"(missing|null|nan|empty).*(value|data|field)"),
    ("dataset_columns",        r"(column|field|variable|feature).*(dataset|data|available)"),
    ("dataset_overview",       r"(how many|count|number of|total).*(record|row|dataset|data)|(overview|summary|describe).*(dataset|data)|show.*dataset|dataset.*overview"),
]


def _match_intent(question: str) -> str:
    q = question.lower()
    for intent, pattern in INTENTS:
        if re.search(pattern, q):
            return intent
    return "unknown"


def _fmt(v: Any, decimals: int = 2) -> str:
    if v is None:
        return "N/A"
    if isinstance(v, float):
        return f"{v:.{decimals}f}"
    return str(v)


# ── Intent handlers ───────────────────────────────────────────────────────────

def _handle_dataset_overview(question: str) -> dict:
    rows = []
    for k in all_keys():
        m = get_metadata(k)
        rows.append({"dataset": k, "rows": m.get("rows", 0), "columns": m.get("columns", 0), "loaded": m.get("loaded", False)})
    lines = [f"- **{r['dataset']}**: {r['rows']:,} rows × {r['columns']} columns ({'loaded' if r['loaded'] else 'not loaded'})" for r in rows]
    return {
        "answer": "Here are the four PulseNova datasets:\n" + "\n".join(lines),
        "intent": "dataset_overview",
        "sources": ["all datasets"],
        "data": rows,
        "chart": None,
        "limitations": "Row counts reflect the CSV files loaded at server startup.",
        "mode": "deterministic",
    }


def _handle_missing_values(question: str) -> dict:
    rows = []
    for k in all_keys():
        m = get_metadata(k)
        rows.append({"dataset": k, "missing_values": m.get("missing_values", 0), "rows": m.get("rows", 0)})
    lines = [f"- **{r['dataset']}**: {r['missing_values']:,} missing values across {r['rows']:,} rows" for r in rows]
    return {
        "answer": "Missing value counts per dataset:\n" + "\n".join(lines),
        "intent": "missing_values",
        "sources": ["all datasets"],
        "data": rows,
        "chart": None,
        "limitations": "Missing value counts are computed at load time from the CSV files.",
        "mode": "deterministic",
    }


def _handle_dataset_columns(question: str) -> dict:
    rows = []
    for k in all_keys():
        m = get_metadata(k)
        rows.append({"dataset": k, "columns": m.get("column_names", [])})
    lines = [f"- **{r['dataset']}**: {', '.join(r['columns'])}" for r in rows]
    return {
        "answer": "Available columns per dataset:\n" + "\n".join(lines),
        "intent": "dataset_columns",
        "sources": ["all datasets"],
        "data": rows,
        "chart": None,
        "limitations": None,
        "mode": "deterministic",
    }


def _handle_avg_wait_time(question: str) -> dict:
    data = get_emergency_analytics()
    kpis = data.get("kpis", {})
    avg = kpis.get("avg_wait_time")
    med = kpis.get("median_wait_time")
    return {
        "answer": f"The average emergency wait time is **{_fmt(avg)} minutes** (median: {_fmt(med)} min). Source: Hospital ER_Data.csv ({kpis.get('total_records', 'N/A')} records).",
        "intent": "avg_wait_time",
        "sources": ["emergency"],
        "data": {"avg_wait_time": avg, "median_wait_time": med},
        "chart": None,
        "limitations": "Based on the full emergency dataset. Filters can be applied via the Emergency & Patient Flow page.",
        "mode": "deterministic",
    }


def _handle_dept_wait_time(question: str) -> dict:
    data = get_emergency_analytics()
    dept_wait = data.get("charts", {}).get("dept_avg_wait", [])
    if not dept_wait:
        return {"answer": "Department wait time data is not available.", "intent": "dept_wait_time", "sources": ["emergency"], "data": None, "chart": None, "limitations": None, "mode": "deterministic"}
    sorted_depts = sorted(dept_wait, key=lambda x: x.get("avg_wait", 0), reverse=True)
    top = sorted_depts[0]
    lines = [f"- **{d['department']}**: {_fmt(d['avg_wait'])} min" for d in sorted_depts[:8]]
    return {
        "answer": f"**{top['department']}** has the highest average wait time at **{_fmt(top['avg_wait'])} minutes**.\n\nAll departments:\n" + "\n".join(lines),
        "intent": "dept_wait_time",
        "sources": ["emergency"],
        "data": sorted_depts,
        "chart": {"type": "bar", "title": "Avg Wait Time by Department", "data": sorted_depts, "x": "department", "y": "avg_wait"},
        "limitations": "Based on Hospital ER_Data.csv. Department names are as recorded in the dataset.",
        "mode": "deterministic",
    }


def _handle_admissions_by_service(question: str) -> dict:
    data = get_operations_analytics()
    svc_data = data.get("charts", {}).get("admissions_by_service", [])
    if not svc_data:
        return {"answer": "Service admissions data is not available.", "intent": "admissions_by_service", "sources": ["hospital_insights"], "data": None, "chart": None, "limitations": None, "mode": "deterministic"}
    sorted_svc = sorted(svc_data, key=lambda x: x.get("patients_admitted", 0), reverse=True)
    top = sorted_svc[0]
    lines = [f"- **{s['service']}**: {int(s['patients_admitted']):,} total admissions" for s in sorted_svc]
    return {
        "answer": f"**{top['service']}** has the highest total recorded admissions at **{int(top['patients_admitted']):,}**.\n\n" + "\n".join(lines),
        "intent": "admissions_by_service",
        "sources": ["hospital_insights"],
        "data": sorted_svc,
        "chart": {"type": "bar", "title": "Total Admissions by Service", "data": sorted_svc, "x": "service", "y": "patients_admitted"},
        "limitations": "Based on hospital_insights_summary.csv (208 records, 4 services, 52 weeks).",
        "mode": "deterministic",
    }

def _handle_avg_stay_by_service(question: str) -> dict:
    data = get_operations_analytics()
    stay_data = data.get("charts", {}).get("avg_stay_by_service", [])
    if not stay_data:
        return {"answer": "Average stay by service data is not available.", "intent": "avg_stay_by_service", "sources": ["hospital_insights"], "data": None, "chart": None, "limitations": None, "mode": "deterministic"}
    sorted_stay = sorted(stay_data, key=lambda x: x.get("avg_stay", 0), reverse=True)
    top = sorted_stay[0]
    lines = [f"- **{s['service']}**: {_fmt(s['avg_stay'])} days" for s in sorted_stay]
    return {
        "answer": f"**{top['service']}** has the highest average recorded stay at **{_fmt(top['avg_stay'])} days**.\n\n" + "\n".join(lines),
        "intent": "avg_stay_by_service",
        "sources": ["hospital_insights"],
        "data": sorted_stay,
        "chart": {"type": "bar", "title": "Avg Stay by Service (days)", "data": sorted_stay, "x": "service", "y": "avg_stay"},
        "limitations": "Based on hospital_insights_summary.csv. avg_stay is the mean of the avg_stay column per service.",
        "mode": "deterministic",
    }


def _handle_staff_vs_recommended(question: str) -> dict:
    data = get_operations_analytics()
    staff_data = data.get("charts", {}).get("staff_vs_recommended", [])
    if not staff_data:
        return {"answer": "Staff vs recommended data is not available.", "intent": "staff_vs_recommended", "sources": ["hospital_insights"], "data": None, "chart": None, "limitations": None, "mode": "deterministic"}
    lines = [f"- **{s['service']}**: avg staff_count={_fmt(s['avg_staff'])}, avg recommended={_fmt(s['avg_recommended'])}, diff={_fmt(s['avg_staff']-s['avg_recommended'])}" for s in staff_data]
    return {
        "answer": "Recorded staff_count vs recommended_staff by service (averages):\n" + "\n".join(lines) + "\n\n*Note: Both values are dataset-defined. This is not a live staffing comparison.*",
        "intent": "staff_vs_recommended",
        "sources": ["hospital_insights"],
        "data": staff_data,
        "chart": {"type": "grouped_bar", "title": "Staff Count vs Recommended by Service", "data": staff_data, "x": "service", "y1": "avg_staff", "y2": "avg_recommended"},
        "limitations": "staff_count and recommended_staff are columns in hospital_insights_summary.csv. They are not live staffing data.",
        "mode": "deterministic",
    }


def _handle_model_metrics(question: str) -> dict:
    cls = get_classification_evaluation()
    arima = get_arima_evaluation()
    xgb = (cls.get("xgboost_metrics") or [{}])[0]
    rf = (cls.get("rf_metrics") or [{}])[0]
    arima_m = (arima.get("metrics") or [{}])[0]
    lines = [
        f"- **XGBoost** accuracy: {_fmt(xgb.get('Accuracy', 0)*100 if xgb.get('Accuracy') else None)}%, F1: {_fmt(xgb.get('F1_Score'))}",
        f"- **Random Forest** accuracy: {_fmt(rf.get('Accuracy', 0)*100 if rf.get('Accuracy') else None)}%, F1: {_fmt(rf.get('F1_Score'))}",
        f"- **ARIMA(1,1,1)** MAE: {_fmt(arima_m.get('MAE'))}, RMSE: {_fmt(arima_m.get('RMSE'))}",
    ]
    return {
        "answer": "Verified model evaluation metrics:\n" + "\n".join(lines) + "\n\n*Note: 100% accuracy reflects a deterministic rule in the 208-record dataset, not real-world generalisation.*",
        "intent": "model_metrics",
        "sources": ["results/xgboost_staff_metrics.csv", "results/random_forest_staff_metrics.csv", "results/arima_metrics.csv"],
        "data": {"xgboost": xgb, "random_forest": rf, "arima": arima_m},
        "chart": None,
        "limitations": cls.get("limitation_notice"),
        "mode": "deterministic",
    }


def _handle_arima_forecast(question: str) -> dict:
    forecast = get_forecast(horizon=7)
    if not forecast.get("available"):
        return {"answer": f"ARIMA forecast is not available: {forecast.get('error', 'unknown error')}", "intent": "arima_forecast", "sources": ["arima_admissions.joblib"], "data": None, "chart": None, "limitations": None, "mode": "deterministic"}
    rows = forecast.get("forecast", [])[:7]
    lines = [f"- {r['date']}: {_fmt(r['forecast'])} (CI: {_fmt(r.get('ci_lower'))}–{_fmt(r.get('ci_upper'))})" for r in rows]
    return {
        "answer": f"ARIMA(1,1,1) 7-day admissions forecast (from {forecast.get('last_training_date')}):\n" + "\n".join(lines),
        "intent": "arima_forecast",
        "sources": ["arima_admissions.joblib"],
        "data": rows,
        "chart": {"type": "line", "title": "7-Day ARIMA Forecast", "data": rows, "x": "date", "y": "forecast"},
        "limitations": forecast.get("note"),
        "mode": "deterministic",
    }


def _handle_feature_importance(question: str) -> dict:
    fi = get_feature_importance()
    xgb_fi = fi.get("xgboost_feature_importance", [])[:5]
    rf_fi = fi.get("rf_feature_importance", [])[:5]
    xgb_lines = [f"- {f['Feature']}: {_fmt(f['Importance']*100)}%" for f in xgb_fi]
    rf_lines = [f"- {f['Feature']}: {_fmt(f['Importance']*100)}%" for f in rf_fi]
    return {
        "answer": "Top 5 feature importances:\n\n**XGBoost:**\n" + "\n".join(xgb_lines) + "\n\n**Random Forest:**\n" + "\n".join(rf_lines),
        "intent": "feature_importance",
        "sources": ["results/xgboost_feature_importance.csv", "random_forest_staff.joblib"],
        "data": {"xgboost": xgb_fi, "random_forest": rf_fi},
        "chart": None,
        "limitations": "Feature importance indicates which inputs most influenced model decisions. It does not establish causal relationships.",
        "mode": "deterministic",
    }


def _handle_model_status(question: str) -> dict:
    status = get_all_model_status()
    lines = [f"- **{k}**: {'✓ Loaded' if v['loaded'] else '✗ Not loaded'} ({v['filename']})" for k, v in status.items()]
    return {
        "answer": "Model loading status:\n" + "\n".join(lines),
        "intent": "model_status",
        "sources": ["models/"],
        "data": status,
        "chart": None,
        "limitations": None,
        "mode": "deterministic",
    }


def _handle_satisfaction_dist(question: str) -> dict:
    data = get_emergency_analytics()
    kpis = data.get("kpis", {})
    avg = kpis.get("avg_satisfaction")
    return {
        "answer": f"The average patient satisfaction score in the emergency dataset is **{_fmt(avg)}** (scale 0–10). Note: {kpis.get('total_records', 'N/A')} records; many satisfaction scores are missing in this dataset.",
        "intent": "satisfaction_dist",
        "sources": ["emergency"],
        "data": {"avg_satisfaction": avg},
        "chart": None,
        "limitations": "Patient Satisfaction Score has significant missing values in the emergency dataset (~72%).",
        "mode": "deterministic",
    }


def _handle_billing_stats(question: str) -> dict:
    data = get_patient_analytics()
    kpis = data.get("kpis", {})
    avg = kpis.get("avg_billing")
    return {
        "answer": f"The average billing amount in the healthcare dataset is **{_fmt(avg)}** billing units. Note: some billing values are negative (may represent adjustments).",
        "intent": "billing_stats",
        "sources": ["healthcare"],
        "data": {"avg_billing": avg},
        "chart": None,
        "limitations": "Billing Amount includes negative values. These are labeled as 'billing units', not confirmed currency amounts.",
        "mode": "deterministic",
    }


def _handle_er_records(question: str) -> dict:
    data = get_emergency_analytics()
    kpis = data.get("kpis", {})
    return {
        "answer": f"The emergency dataset contains **{kpis.get('total_records', 'N/A'):,} records**. Average wait time: {_fmt(kpis.get('avg_wait_time'))} min. Admitted: {kpis.get('er_admitted_count', 'N/A') or kpis.get('admitted_count', 'N/A')}.",
        "intent": "er_records",
        "sources": ["emergency"],
        "data": kpis,
        "chart": None,
        "limitations": None,
        "mode": "deterministic",
    }


def _handle_service_comparison(question: str) -> dict:
    data = get_operations_analytics()
    svc_table = data.get("charts", {}).get("service_comparison", [])
    if not svc_table:
        return {"answer": "Service comparison data is not available.", "intent": "service_comparison", "sources": ["hospital_insights"], "data": None, "chart": None, "limitations": None, "mode": "deterministic"}
    lines = [f"- **{s['service']}**: {int(s['total_admitted'])} admitted, avg stay {_fmt(s['avg_stay'])}d, avg satisfaction {_fmt(s['avg_satisfaction'])}" for s in svc_table]
    return {
        "answer": "Service-level comparison (hospital_insights_summary.csv):\n" + "\n".join(lines),
        "intent": "service_comparison",
        "sources": ["hospital_insights"],
        "data": svc_table,
        "chart": None,
        "limitations": "Based on 208 records across 4 services and 52 weeks.",
        "mode": "deterministic",
    }


def _handle_condition_distribution(question: str) -> dict:
    data = get_patient_analytics()
    conditions = data.get("charts", {}).get("medical_conditions", [])
    if not conditions:
        return {"answer": "Medical condition data is not available.", "intent": "condition_distribution", "sources": ["healthcare"], "data": None, "chart": None, "limitations": None, "mode": "deterministic"}
    lines = [f"- **{c['label']}**: {c['value']:,} records" for c in conditions[:8]]
    return {
        "answer": "Top medical conditions in the healthcare dataset:\n" + "\n".join(lines),
        "intent": "condition_distribution",
        "sources": ["healthcare"],
        "data": conditions,
        "chart": {"type": "bar", "title": "Medical Condition Distribution", "data": conditions, "x": "label", "y": "value"},
        "limitations": "Based on healthcare_dataset.csv (55,500 records).",
        "mode": "deterministic",
    }


def _handle_age_distribution(question: str) -> dict:
    data = get_patient_analytics()
    age_groups = data.get("charts", {}).get("age_groups", [])
    kpis = data.get("kpis", {})
    if not age_groups:
        return {"answer": "Age distribution data is not available.", "intent": "age_distribution", "sources": ["healthcare"], "data": None, "chart": None, "limitations": None, "mode": "deterministic"}
    lines = [f"- **{a['label']}**: {a['value']:,} patients" for a in age_groups]
    return {
        "answer": f"Age distribution (avg age: {_fmt(kpis.get('avg_age'))} years):\n" + "\n".join(lines),
        "intent": "age_distribution",
        "sources": ["healthcare"],
        "data": age_groups,
        "chart": {"type": "bar", "title": "Age Group Distribution", "data": age_groups, "x": "label", "y": "value"},
        "limitations": "Based on healthcare_dataset.csv.",
        "mode": "deterministic",
    }


def _handle_admission_types(question: str) -> dict:
    data = get_patient_analytics()
    types = data.get("charts", {}).get("admission_types", [])
    if not types:
        return {"answer": "Admission type data is not available.", "intent": "admission_types", "sources": ["healthcare"], "data": None, "chart": None, "limitations": None, "mode": "deterministic"}
    lines = [f"- **{t['label']}**: {t['value']:,} records" for t in types]
    return {
        "answer": "Admission type distribution:\n" + "\n".join(lines),
        "intent": "admission_types",
        "sources": ["healthcare"],
        "data": types,
        "chart": None,
        "limitations": "Based on healthcare_dataset.csv.",
        "mode": "deterministic",
    }


def _handle_admission_trend(question: str) -> dict:
    data = get_dashboard_analytics()
    trend = data.get("charts", {}).get("admissions_trend", [])
    if not trend:
        return {"answer": "Admission trend data is not available.", "intent": "admission_trend", "sources": ["healthcare"], "data": None, "chart": None, "limitations": None, "mode": "deterministic"}
    recent = trend[-3:]
    lines = [f"- {t['month']}: {t['admissions']:,} admissions" for t in recent]
    return {
        "answer": f"Monthly admission trend (last 3 months shown):\n" + "\n".join(lines) + f"\n\nFull trend covers {len(trend)} months.",
        "intent": "admission_trend",
        "sources": ["healthcare"],
        "data": trend,
        "chart": {"type": "line", "title": "Monthly Admissions Trend", "data": trend, "x": "month", "y": "admissions"},
        "limitations": "Based on healthcare_dataset.csv Date of Admission column.",
        "mode": "deterministic",
    }


INTENT_HANDLERS = {
    "dataset_overview":       _handle_dataset_overview,
    "missing_values":         _handle_missing_values,
    "dataset_columns":        _handle_dataset_columns,
    "avg_wait_time":          _handle_avg_wait_time,
    "median_wait_time":       _handle_avg_wait_time,
    "dept_wait_time":         _handle_dept_wait_time,
    "admissions_by_service":  _handle_admissions_by_service,
    "highest_admission":      _handle_admissions_by_service,
    "avg_stay_by_service":    _handle_avg_stay_by_service,
    "highest_stay":           _handle_avg_stay_by_service,
    "staff_vs_recommended":   _handle_staff_vs_recommended,
    "service_comparison":     _handle_service_comparison,
    "model_metrics":          _handle_model_metrics,
    "arima_forecast":         _handle_arima_forecast,
    "feature_importance":     _handle_feature_importance,
    "model_status":           _handle_model_status,
    "satisfaction_dist":      _handle_satisfaction_dist,
    "billing_stats":          _handle_billing_stats,
    "er_records":             _handle_er_records,
    "condition_distribution": _handle_condition_distribution,
    "age_distribution":       _handle_age_distribution,
    "admission_types":        _handle_admission_types,
    "admission_trend":        _handle_admission_trend,
}


def ask(question: str) -> dict:
    question = question.strip()
    if len(question) < 3:
        return {"answer": "Please enter a more specific question.", "intent": "unknown", "sources": [], "data": None, "chart": None, "limitations": None, "mode": "deterministic"}
    if len(question) > 500:
        return {"answer": "Question is too long. Please keep it under 500 characters.", "intent": "unknown", "sources": [], "data": None, "chart": None, "limitations": None, "mode": "deterministic"}

    intent = _match_intent(question)
    handler = INTENT_HANDLERS.get(intent)

    if handler:
        try:
            result = handler(question)
            result["disclaimer"] = DISCLAIMER
            return result
        except Exception as e:
            logger.error("Assistant handler error for intent '%s': %s", intent, e)
            return {
                "answer": "An error occurred while computing the answer. Please try again.",
                "intent": intent,
                "sources": [],
                "data": None,
                "chart": None,
                "limitations": None,
                "mode": "deterministic",
                "disclaimer": DISCLAIMER,
            }

    return {
        "answer": (
            "I can answer questions about the PulseNova datasets and models. "
            "Try asking about: wait times, admissions by service, average stay, "
            "staffing vs recommended, model accuracy, ARIMA forecast, feature importance, "
            "missing values, or dataset overviews. "
            "Use the suggested questions below for examples."
        ),
        "intent": "unknown",
        "sources": [],
        "data": None,
        "chart": None,
        "limitations": None,
        "mode": "deterministic",
        "disclaimer": DISCLAIMER,
    }


def get_suggestions() -> list[str]:
    return [
        "Which service has the highest recorded admission volume?",
        "What is the average emergency wait time?",
        "Which department has the highest average wait time?",
        "Which service has the highest average stay?",
        "Compare recorded staffing and recommended staffing",
        "What are the model evaluation metrics?",
        "What is the current ARIMA admissions forecast?",
        "Which features have the highest importance?",
        "How many missing values exist in each dataset?",
        "Show me the dataset overview",
        "What is the average billing amount?",
        "Show the medical condition distribution",
        "What are the admission types?",
        "How many emergency records are there?",
        "Show the monthly admission trend",
    ]


def get_capabilities() -> dict:
    model_status = get_all_model_status()
    dataset_status = {k: {"loaded": True} for k in all_keys()}
    return {
        "supported_categories": [
            "Dataset overview (row counts, columns, missing values)",
            "Patient analytics (age, conditions, admission types, billing, trends)",
            "Emergency analytics (wait times, departments, satisfaction)",
            "Operational analytics (admissions by service, avg stay, staffing)",
            "Model metrics (XGBoost, Random Forest accuracy, ARIMA MAE/RMSE)",
            "ARIMA forecast (7-day ahead)",
            "Feature importance",
            "Model loading status",
        ],
        "dataset_status": dataset_status,
        "model_status": model_status,
        "mode": "deterministic",
        "llm_enabled": False,
        "note": "This assistant uses deterministic analytics queries. No LLM is required.",
    }
