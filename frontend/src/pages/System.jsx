import { Info, Brain, FileText, Code } from 'lucide-react';
import ChartCard from '../components/ChartCard';
import { PROJECT_META, FINAL_SUMMARY } from '../data/researchData';

const RESULT_FILES = [
  'arima_30_day_forecast.csv','arima_admission_forecast.csv','arima_metrics.csv',
  'final_ml_comparison.csv','HealthPulse_XAR_final_summary.csv','overall_algorithm_results.csv',
  'PowerBI_ARIMA_Forecast.csv','PowerBI_Emergency_Analysis.csv','PowerBI_Healthcare_Analysis.csv',
  'PowerBI_Patient_Flow.csv','PowerBI_Staffing_Analysis.csv','random_forest_staff_metrics.csv',
  'random_forest_staff_predictions.csv','xgboost_feature_importance.csv','xgboost_improved_predictions.csv',
  'xgboost_metrics.csv','xgboost_model_comparison.csv','xgboost_staff_metrics.csv',
  'xgboost_staff_predictions.csv','xgboost_vs_random_forest.csv','xgboost_waittime_predictions.csv',
];

const MODEL_FILES = [
  { file: 'xgboost_staff.joblib',       desc: 'XGBoost staffing level classifier' },
  { file: 'random_forest_staff.joblib', desc: 'Random Forest staffing level classifier' },
  { file: 'arima_admissions.joblib',    desc: 'ARIMA(1,1,1) admission forecaster' },
];

const TECH_STACK = [
  'Python','XGBoost','scikit-learn','statsmodels','pandas','numpy',
  'joblib','Google Colab','React 19','Vite 8','Recharts','Lucide React','Axios','Plain CSS',
];

export default function System() {
  return (
    <div className="page-content">
      <div className="page-header">
        <h1>System &amp; Project Information</h1>
        <p>Architecture, datasets, model files, and technology stack for HealthPulse-XAR</p>
      </div>

      <div className="info-grid mb-24">
        <ChartCard title="Project Overview" subtitle="HealthPulse-XAR research project details">
          <div className="metric-row"><span className="metric-name">Project Name</span><span className="metric-value">{PROJECT_META.fullName}</span></div>
          <div className="metric-row"><span className="metric-name">Platform</span><span className="metric-value">{PROJECT_META.name}</span></div>
          <div className="metric-row"><span className="metric-name">Version</span><span className="metric-value">{PROJECT_META.version}</span></div>
          <div className="metric-row"><span className="metric-name">Purpose</span><span className="metric-value" style={{ fontSize: 12 }}>{PROJECT_META.subtitle}</span></div>
          <div className="metric-row"><span className="metric-name">Algorithms</span><span className="metric-value">{PROJECT_META.algorithms.join(', ')}</span></div>
          <div className="metric-row"><span className="metric-name">Training Environment</span><span className="metric-value">Google Colab</span></div>
          <div className="metric-row"><span className="metric-name">Frontend</span><span className="metric-value">React + Vite + Plain CSS</span></div>
          <div className="metric-row"><span className="metric-name">Backend</span><span className="metric-value">FastAPI + Python + Uvicorn</span></div>
        </ChartCard>

        <ChartCard title="Research Summary" subtitle="From HealthPulse_XAR_final_summary.csv">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Component</th><th>Objective</th><th>Result</th></tr></thead>
              <tbody>
                {FINAL_SUMMARY.map(r => (
                  <tr key={r.component}>
                    <td><span className="badge badge-teal">{r.component}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.objective}</td>
                    <td><strong style={{ fontSize: 12 }}>{r.result}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>

      <div className="info-grid mb-24">
        <ChartCard title="Kaggle Datasets" subtitle="Source datasets used for model training">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Dataset</th><th>File</th><th>Size</th></tr></thead>
              <tbody>
                {PROJECT_META.datasets.map(d => (
                  <tr key={d.file}>
                    <td>{d.name}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{d.file}</td>
                    <td><span className="badge badge-gray">{d.rows}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>

        <ChartCard title="Saved Model Files" subtitle="Stored in models/ directory as .joblib">
          {MODEL_FILES.map(m => (
            <div className="stat-pill" key={m.file}>
              <Brain size={14} style={{ color: 'var(--teal)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{m.file}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.desc}</div>
              </div>
              <span className="badge badge-teal">Saved</span>
            </div>
          ))}
          <div className="info-box note" style={{ marginTop: 12 }}>
            <Info size={14} className="info-box-icon" />
            <div className="info-box-text">
              Models are preserved as-is. No retraining is performed by this platform.
              FastAPI integration will serve predictions in the next development stage.
            </div>
          </div>
        </ChartCard>
      </div>

      <div className="info-grid mb-24">
        <ChartCard title="Result CSV Files" subtitle={`${RESULT_FILES.length} files in results/ directory`}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {RESULT_FILES.map(f => (
              <span key={f} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 10px', background: '#f1f5f9',
                border: '1px solid var(--border)', borderRadius: 4,
                fontSize: 11, fontFamily: 'monospace', color: 'var(--text)'
              }}>
                <FileText size={10} style={{ color: 'var(--text-muted)' }} />
                {f}
              </span>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Technology Stack" subtitle="Libraries and tools used in this project">
          <div className="tech-stack">
            {TECH_STACK.map(t => (
              <span key={t} className="tech-tag">
                <Code size={11} style={{ color: 'var(--teal)' }} />
                {t}
              </span>
            ))}
          </div>
        </ChartCard>
      </div>

      <ChartCard title="Project Folder Structure" subtitle="Current workspace layout">
        <pre style={{
          background: '#f8fafc', border: '1px solid var(--border)',
          borderRadius: 6, padding: '16px 20px',
          fontSize: 12, lineHeight: 1.8, color: 'var(--text)',
          fontFamily: 'ui-monospace, Consolas, monospace', overflowX: 'auto'
        }}>{`PulseNova/
├── dataset/          ← 4 Kaggle CSV datasets
├── models/           ← xgboost_staff.joblib, random_forest_staff.joblib, arima_admissions.joblib
├── results/          ← 21 result CSV files + 3 PNG charts
├── backend/          ← FastAPI (next stage)
└── frontend/         ← React + Vite (this application)
    └── src/
        ├── components/   Sidebar, Topbar, KpiCard, ChartCard
        ├── pages/        Landing, Dashboard, Patients, Emergency,
        │                 Operational, Predictive, Evaluation,
        │                 Explorer, System
        └── data/
            └── researchData.js  ← All CSV data loaded here`}</pre>
      </ChartCard>
    </div>
  );
}
