# PulseNova — Healthcare Operational Intelligence Platform

A full-stack healthcare analytics platform combining operational data and predictive analytics.
Built with React + Vite (frontend) and FastAPI + Python (backend).

**Completed Stages:** Stage 1 (Frontend foundation), Stage 2 (Backend + datasets), Stage 3 (Analytics pages), Stage 4 (ML model integration), Stage 5 (Evaluation + Data Explorer + Reports)

---

## Technology Stack

| Layer      | Technology                                                        |
|------------|-------------------------------------------------------------------|
| Frontend   | React 19, Vite 8, React Router DOM, Plain CSS                     |
| Charts     | Recharts                                                          |
| Icons      | Lucide React                                                      |
| HTTP       | Axios                                                             |
| Backend    | FastAPI, Uvicorn, Pandas, NumPy, Pydantic                         |
| ML         | XGBoost, scikit-learn 1.6.1, statsmodels (ARIMA), joblib          |
| Config     | python-dotenv                                                     |

---

## Folder Structure

```
PulseNova/
├── dataset/
│   ├── healthcare_dataset.csv                        (55,500 rows, 15 cols)
│   ├── Hospital ER_Data.csv                          (9,216 rows, 12 cols)
│   ├── hospital_insights_summary.csv                 (208 rows, 8 cols)
│   └── healthcare_analytics_patient_flow_data.csv    (9,216 rows, 11 cols)
├── models/
│   ├── xgboost_staff.joblib       ← sklearn Pipeline (ColumnTransformer + XGBClassifier)
│   ├── random_forest_staff.joblib ← sklearn Pipeline (ColumnTransformer + RandomForestClassifier)
│   └── arima_admissions.joblib    ← statsmodels ARIMAResultsWrapper (daily, 2023-01-04 to 2024-12-10)
├── results/                       ← 21 result CSV files + PNG charts
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── data_loader.py
│   │   ├── routers/
│   │   │   ├── health.py
│   │   │   ├── datasets.py
│   │   │   ├── analytics.py
│   │   │   ├── predictions.py
│   │   │   └── models.py
│   │   └── services/
│   │       ├── analytics_service.py
│   │       ├── model_loader.py
│   │       ├── staffing_prediction.py
│   │       ├── admissions_forecast.py
│   │       └── evaluation_service.py
│   ├── .env
│   ├── requirements.txt
│   └── venv/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Topbar.jsx
│   │   │   ├── KpiCard.jsx
│   │   │   ├── ChartCard.jsx
│   │   │   └── common/States.jsx
│   │   ├── hooks/useApi.js
│   │   ├── pages/
│   │   │   ├── Landing.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Patients.jsx
│   │   │   ├── Emergency.jsx
│   │   │   ├── Operational.jsx
│   │   │   ├── Predictive.jsx
│   │   │   ├── Evaluation.jsx
│   │   │   ├── Explorer.jsx
│   │   │   └── System.jsx
│   │   ├── services/api.js
│   │   └── index.css
│   ├── .env
│   └── package.json
└── README.md
```

---

## Datasets

| Key                | File                                            | Rows   | Cols |
|--------------------|-------------------------------------------------|--------|------|
| `healthcare`       | `healthcare_dataset.csv`                        | 55,500 | 15   |
| `emergency`        | `Hospital ER_Data.csv`                          | 9,216  | 12   |
| `hospital_insights`| `hospital_insights_summary.csv`                 | 208    | 8    |
| `patient_flow`     | `healthcare_analytics_patient_flow_data.csv`    | 9,216  | 11   |

**Note:** The emergency and patient_flow datasets have the same row count and overlapping fields. They are analyzed separately to avoid double-counting.

---

## Model Artifacts

| File                        | Type                          | Task                              | Classes / Output     |
|-----------------------------|-------------------------------|-----------------------------------|----------------------|
| `xgboost_staff.joblib`      | sklearn Pipeline + XGBoost    | Staff level classification        | 0→1, 1→2 (mapped)   |
| `random_forest_staff.joblib`| sklearn Pipeline + RandomForest| Staff level classification       | 1, 2 (direct)        |
| `arima_admissions.joblib`   | statsmodels ARIMAResultsWrapper| Daily admissions forecasting     | Float (admissions/day)|

**Required:** scikit-learn==1.6.1 (models were saved with this version)

**Limitation:** The hospital_insights dataset has 208 records. The target `recommended_staff` follows a deterministic rule (1–5 admissions → level 1, 6–10 → level 2). Perfect accuracy reflects this rule, not generalisation to other hospitals.

---

## Setup

### 1. Python / Backend

```cmd
cd PulseNova\backend

python -m venv venv

REM Windows cmd.exe:
venv\Scripts\activate

pip install -r requirements.txt
```

**Important:** Use `cmd.exe`, not PowerShell, to activate the venv. Or in PowerShell run:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 2. Frontend

```cmd
cd PulseNova\frontend
npm install
```

### 3. Environment Variables

`backend/.env` (already configured):
```
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
DATASET_DIR=../dataset
API_HOST=127.0.0.1
API_PORT=8001
```

`frontend/.env` (already configured):
```
VITE_API_BASE_URL=http://localhost:8001
```

---

## Running the Project

Open **two separate terminals**.

### Terminal 1 — Backend

```cmd
cd PulseNova\backend
venv\Scripts\activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

### Terminal 2 — Frontend

```cmd
cd PulseNova\frontend
npm run dev
```

---

## Local URLs

| Service              | URL                               |
|----------------------|-----------------------------------|
| Frontend             | http://localhost:5173             |
| Backend API root     | http://localhost:8001             |
| Swagger UI           | http://localhost:8001/docs        |
| ReDoc                | http://localhost:8001/redoc       |

---

## API Endpoints

### Health & Root
| Method | Path       | Description                        |
|--------|------------|------------------------------------|
| GET    | `/`        | App name, version, dataset count   |
| GET    | `/health`  | Per-dataset load status            |

### Datasets
| Method | Path                            | Description                        |
|--------|---------------------------------|------------------------------------|
| GET    | `/datasets`                     | Metadata for all four datasets     |
| GET    | `/datasets/{key}`               | Metadata for one dataset           |
| GET    | `/datasets/{key}/preview`       | Paginated rows (limit, offset)     |
| GET    | `/datasets/{key}/summary`       | Descriptive statistics             |
| GET    | `/datasets/{key}/export`        | CSV download (up to 10,000 rows)   |
| POST   | `/datasets/reload`              | Reload CSV files from disk         |

### Analytics
| Method | Path                            | Description                        |
|--------|---------------------------------|------------------------------------|
| GET    | `/analytics/dashboard`          | Dashboard KPIs and charts          |
| GET    | `/analytics/patients`           | Patient analytics (filterable)     |
| GET    | `/analytics/emergency-flow`     | Emergency analytics (filterable)   |
| GET    | `/analytics/operations`         | Operational analytics (filterable) |
| GET    | `/stats/summary`                | Per-dataset row/column counts      |

### Models & Predictions
| Method | Path                                  | Description                        |
|--------|---------------------------------------|------------------------------------|
| GET    | `/models/status`                      | Model load status and metadata     |
| POST   | `/predictions/staffing/xgboost`       | XGBoost staffing prediction        |
| POST   | `/predictions/staffing/random-forest` | Random Forest staffing prediction  |
| POST   | `/predictions/staffing/compare`       | Compare both models                |
| GET    | `/predictions/admissions-forecast`    | ARIMA forecast (horizon param)     |
| GET    | `/models/evaluation`                  | Classification + ARIMA metrics     |
| GET    | `/models/feature-importance`          | XGBoost + RF feature importance    |

### Reports & Exports
| Method | Path                                    | Description                        |
|--------|-----------------------------------------|------------------------------------|
| GET    | `/reports/model-metrics`                | All model metrics JSON             |
| GET    | `/reports/model-metrics/export`         | Model metrics CSV download         |
| GET    | `/reports/admissions-forecast/export`   | Forecast CSV download              |
| GET    | `/reports/dashboard-summary`            | Dashboard summary JSON             |
| GET    | `/reports/dashboard-summary/export`     | Dashboard summary CSV download     |

---

## Using the Staffing Prediction

1. Navigate to **Predictive Analytics** (`/predictions`)
2. Fill in the form fields:
   - **Week**: 1–52
   - **Service**: ICU, emergency, general_medicine, surgery
   - **Patients Admitted**: number of patients (1–10 in training data)
   - **Avg Stay**: average length of stay in days
   - **Avg Satisfaction**: 0–100 scale
   - **Max Occupancy**: integer count (not a percentage)
   - **Staff Count**: recorded staff count
3. Click **Predict — XGBoost**, **Predict — Random Forest**, or **Compare Both**
4. Results show predicted staff level (1 or 2) with class probabilities

## Using the Admissions Forecast

The ARIMA(1,1,1) model was trained on daily admissions from 2023-01-04 to 2024-12-10.
The forecast starts from 2024-12-11. Use the `horizon` parameter (1–90 days).

```
GET /predictions/admissions-forecast?horizon=30
```

## Exporting CSV Reports

- **Dataset export**: Click "Export CSV" on the Data Explorer page, or call `/datasets/{key}/export`
- **Forecast export**: Click "Export CSV" on the Predictive Analytics page
- **Model metrics**: Call `/reports/model-metrics/export`
- **Dashboard summary**: Call `/reports/dashboard-summary/export`

---

## Evaluation Metrics

| Model         | Task                    | Metric   | Value    | Source                          |
|---------------|-------------------------|----------|----------|---------------------------------|
| XGBoost       | Staff level (1 vs 2)    | Accuracy | 100.00%  | xgboost_staff_metrics.csv       |
| Random Forest | Staff level (1 vs 2)    | Accuracy | 100.00%  | random_forest_staff_metrics.csv |
| ARIMA(1,1,1)  | Daily admissions        | MAE      | 5.7912   | arima_metrics.csv               |
| ARIMA(1,1,1)  | Daily admissions        | RMSE     | 10.0057  | arima_metrics.csv               |

**Important limitation:** Perfect classification accuracy is expected because the target variable follows a deterministic rule in the 208-record dataset. These results do not establish real-world generalisation.

---

## Troubleshooting

**Backend won't start**
- Activate the venv before running uvicorn: `venv\Scripts\activate`
- Run from inside the `backend/` folder
- Check packages: `pip install -r requirements.txt`

**"API Offline" in header**
- Start the FastAPI backend on port 8001
- Check `frontend/.env` has `VITE_API_BASE_URL=http://localhost:8001`

**Model loading error**
- scikit-learn must be version 1.6.1: `pip install scikit-learn==1.6.1`
- xgboost and statsmodels must be installed: `pip install xgboost statsmodels`

**Port already in use**
- Use a different port: `uvicorn app.main:app --reload --port 8002`
- Update `frontend/.env` to match

**Dataset not found**
- Confirm CSV files exist in `dataset/` at the project root
- Check `backend/.env` has `DATASET_DIR=../dataset`

---

## Notes

- Models in `models/` are preserved as-is. No retraining is performed.
- Patient-level access controls and production security are not implemented.
  This platform is for local research and development only.
- The frontend works independently when the backend is offline — only live API features (dashboard counts, analytics charts, predictions) require the backend.
