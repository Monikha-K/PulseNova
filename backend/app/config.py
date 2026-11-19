"""
config.py — centralised configuration for PulseNova backend.
Reads values from .env (or environment variables) and resolves
all file paths relative to the project root so the app works
regardless of which directory uvicorn is launched from.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# The backend/ folder sits one level below the project root.
BACKEND_DIR = Path(__file__).resolve().parent.parent   # .../PulseNova/backend
PROJECT_ROOT = BACKEND_DIR.parent                       # .../PulseNova

# Load .env from the backend directory
load_dotenv(BACKEND_DIR / ".env")

# ── CORS ────────────────────────────────────────────────────────────────────
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
ALLOWED_ORIGINS: list[str] = [o.strip() for o in _raw_origins.split(",") if o.strip()]

# ── Dataset paths ────────────────────────────────────────────────────────────
# DATASET_DIR in .env is relative to the backend/ directory
_dataset_dir_env = os.getenv("DATASET_DIR", "../dataset")
DATASET_DIR: Path = (BACKEND_DIR / _dataset_dir_env).resolve()

# Exact filenames as found on disk
DATASET_FILES: dict[str, str] = {
    "healthcare":        "healthcare_dataset.csv",
    "emergency":         "Hospital ER_Data.csv",
    "hospital_insights": "hospital_insights_summary.csv",
    "patient_flow":      "healthcare_analytics_patient_flow_data.csv",
}

# ── API metadata ─────────────────────────────────────────────────────────────
APP_TITLE   = "PulseNova API"
APP_VERSION = "1.0.0"
APP_DESC    = (
    "Healthcare Operational Intelligence API — "
    "serves dataset metadata, previews, and summaries "
    "for the PulseNova analytics platform."
)
