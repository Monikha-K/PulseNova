import { useState } from 'react';
import { Brain, AlertCircle, CheckCircle, Download } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import ChartCard from '../components/ChartCard';
import { LoadingState, ErrorState } from '../components/common/States';
import { useApi } from '../hooks/useApi';
import {
  fetchModelStatus, fetchAdmissionForecast,
  predictXGBoost, predictRandomForest, predictCompare,
  getForecastExportUrl,
} from '../services/api';

const SERVICES = ['ICU', 'emergency', 'general_medicine', 'surgery'];

const DEFAULT_FORM = {
  week: 26, service: 'ICU', patients_admitted: 5,
  avg_stay: 7, avg_satisfaction: 79, max_occupancy: 11, staff_count: 31,
};

function ResultCard({ result }) {
  if (!result) return null;
  if (!result.available) {
    return (
      <div className="info-box warning">
        <AlertCircle size={15} className="info-box-icon" />
        <div className="info-box-text">
          <div className="info-box-title">{result.model} — Unavailable</div>
          {result.error}
        </div>
      </div>
    );
  }
  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <CheckCircle size={18} style={{ color: '#10B981' }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>{result.model}</span>
        <span className="badge badge-teal">{result.predicted_label}</span>
      </div>
      {result.class_probabilities && (
        <div style={{ marginBottom: 10 }}>
          {Object.entries(result.class_probabilities).map(([cls, prob]) => (
            <div key={cls} className="progress-bar-wrap" style={{ marginBottom: 8 }}>
              <div className="progress-bar-label">
                <span>{cls}</span><span>{(prob * 100).toFixed(1)}%</span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${prob * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="info-box note" style={{ marginTop: 8 }}>
        <AlertCircle size={13} className="info-box-icon" />
        <div className="info-box-text" style={{ fontSize: 11 }}>{result.disclaimer}</div>
      </div>
    </div>
  );
}

export default function Predictive() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [predicting, setPredicting] = useState(false);
  const [xgbResult, setXgbResult] = useState(null);
  const [rfResult, setRfResult] = useState(null);
  const [cmpResult, setCmpResult] = useState(null);
  const [predError, setPredError] = useState(null);
  const [history, setHistory] = useState([]);

  const { data: modelStatus } = useApi(fetchModelStatus);
  const { data: forecast, loading: fcLoading, error: fcError } = useApi(() => fetchAdmissionForecast(30));

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function buildPayload() {
    return {
      week: parseInt(form.week),
      service: form.service,
      patients_admitted: parseFloat(form.patients_admitted),
      avg_stay: parseFloat(form.avg_stay),
      avg_satisfaction: parseFloat(form.avg_satisfaction),
      max_occupancy: parseFloat(form.max_occupancy),
      staff_count: parseFloat(form.staff_count),
    };
  }

  async function runXGB() {
    setPredicting(true); setPredError(null); setXgbResult(null); setRfResult(null); setCmpResult(null);
    const r = await predictXGBoost(buildPayload());
    if (r.ok) { setXgbResult(r.data); addHistory('XGBoost', r.data); }
    else setPredError(r.error);
    setPredicting(false);
  }

  async function runRF() {
    setPredicting(true); setPredError(null); setXgbResult(null); setRfResult(null); setCmpResult(null);
    const r = await predictRandomForest(buildPayload());
    if (r.ok) { setRfResult(r.data); addHistory('Random Forest', r.data); }
    else setPredError(r.error);
    setPredicting(false);
  }

  async function runCompare() {
    setPredicting(true); setPredError(null); setXgbResult(null); setRfResult(null); setCmpResult(null);
    const r = await predictCompare(buildPayload());
    if (r.ok) { setCmpResult(r.data); setXgbResult(r.data.xgboost); setRfResult(r.data.random_forest); }
    else setPredError(r.error);
    setPredicting(false);
  }

  function addHistory(model, result) {
    if (!result?.available) return;
    setHistory(h => [{ model, label: result.predicted_label, input: { ...form }, ts: new Date().toLocaleTimeString() }, ...h].slice(0, 5));
  }

  const fcData = forecast?.forecast || [];
  const histData = forecast?.historical || [];

  const inputField = (label, key, type = 'number', min, max, step = 1) => (
    <div key={key}>
      <div className="filter-label" style={{ marginBottom: 4 }}>{label}</div>
      {type === 'select' ? (
        <select value={form[key]} onChange={e => setField(key, e.target.value)}
          style={{ height: 34, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', width: '100%' }}>
          {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      ) : (
        <input type="number" value={form[key]} min={min} max={max} step={step}
          onChange={e => setField(key, e.target.value)}
          style={{ height: 34, width: '100%', padding: '0 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }} />
      )}
    </div>
  );

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Predictive Analytics</h1>
        <p>Staffing level classification (XGBoost &amp; Random Forest) and ARIMA daily admissions forecasting</p>
      </div>

      {/* Model status */}
      {modelStatus && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
          {Object.entries(modelStatus.models).map(([key, m]) => (
            <div key={key} className="stat-pill" style={{ flex: 'none' }}>
              {m.loaded ? <CheckCircle size={14} style={{ color: '#10B981' }} /> : <AlertCircle size={14} style={{ color: '#EF4444' }} />}
              <span className="stat-pill-label">{key}</span>
              <span className="badge" style={{ background: m.loaded ? '#d1fae5' : '#fee2e2', color: m.loaded ? '#065f46' : '#991b1b' }}>
                {m.loaded ? 'Loaded' : 'Unavailable'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Staffing prediction form */}
      <ChartCard title="Staffing Level Prediction" subtitle="Enter feature values to predict recommended_staff level (1 or 2)" style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 16 }}>
          {inputField('Week (1–52)', 'week', 'number', 1, 52)}
          {inputField('Service', 'service', 'select')}
          {inputField('Patients Admitted', 'patients_admitted', 'number', 0, 20, 1)}
          {inputField('Avg Stay (days)', 'avg_stay', 'number', 0, 30, 0.5)}
          {inputField('Avg Satisfaction (0–100)', 'avg_satisfaction', 'number', 0, 100, 0.5)}
          {inputField('Max Occupancy (count)', 'max_occupancy', 'number', 0, 20, 1)}
          {inputField('Staff Count', 'staff_count', 'number', 0, 50, 1)}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={runXGB} disabled={predicting}>
            <Brain size={14} /> Predict — XGBoost
          </button>
          <button className="btn btn-outline" onClick={runRF} disabled={predicting}>
            <Brain size={14} /> Predict — Random Forest
          </button>
          <button className="btn btn-outline" onClick={runCompare} disabled={predicting} style={{ borderColor: 'var(--teal)', color: 'var(--teal)' }}>
            <Brain size={14} /> Compare Both
          </button>
        </div>
        {predicting && <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-muted)' }}>Running prediction…</div>}
        {predError && <div className="info-box warning" style={{ marginTop: 12 }}><AlertCircle size={14} className="info-box-icon" /><div className="info-box-text">{predError}</div></div>}
      </ChartCard>

      {/* Results */}
      {(xgbResult || rfResult) && (
        <div className="grid-2 mb-20">
          {xgbResult && <ResultCard result={xgbResult} />}
          {rfResult && <ResultCard result={rfResult} />}
        </div>
      )}

      {cmpResult && (
        <div className="info-box" style={{ marginBottom: 20, background: cmpResult.models_agree ? '#f0fdf4' : '#fffbeb', borderColor: cmpResult.models_agree ? '#bbf7d0' : '#fde68a', color: cmpResult.models_agree ? '#166534' : '#92400e' }}>
          <CheckCircle size={15} className="info-box-icon" />
          <div className="info-box-text">
            <div className="info-box-title">{cmpResult.models_agree ? 'Both models agree' : 'Models disagree'}</div>
            XGBoost: {cmpResult.xgboost?.predicted_label || 'N/A'} &nbsp;|&nbsp; Random Forest: {cmpResult.random_forest?.predicted_label || 'N/A'}
          </div>
        </div>
      )}

      {/* Prediction history */}
      {history.length > 0 && (
        <ChartCard title="Recent Predictions (Session)" subtitle="Last 5 predictions — not persisted after page reload" style={{ marginBottom: 20 }}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Time</th><th>Model</th><th>Result</th><th>Week</th><th>Service</th><th>Admitted</th></tr></thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{h.ts}</td>
                    <td><span className="badge badge-blue">{h.model}</span></td>
                    <td><strong>{h.label}</strong></td>
                    <td>{h.input.week}</td>
                    <td>{h.input.service}</td>
                    <td>{h.input.patients_admitted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}

      {/* ARIMA Forecast */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>ARIMA(1,1,1) — 30-Day Admissions Forecast</span>
        <a href={getForecastExportUrl()} download className="btn btn-outline" style={{ height: 30, fontSize: 12, textDecoration: 'none' }}>
          <Download size={13} /> Export CSV
        </a>
      </div>

      {fcLoading && <LoadingState message="Loading ARIMA forecast…" />}
      {!fcLoading && fcError && <ErrorState error={fcError} />}

      {!fcLoading && !fcError && forecast && (
        <>
          {!forecast.available && (
            <div className="info-box warning" style={{ marginBottom: 20 }}>
              <AlertCircle size={15} className="info-box-icon" />
              <div className="info-box-text"><div className="info-box-title">ARIMA model unavailable</div>{forecast.error}</div>
            </div>
          )}

          {forecast.available && (
            <>
              <ChartCard title="30-Day Forecast with Confidence Intervals" subtitle={`ARIMA(1,1,1) — ${forecast.last_training_date} to +30 days`} style={{ marginBottom: 20 }}>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={fcData} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={4} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={v => typeof v === 'number' ? v.toFixed(2) : v} />
                    <Legend iconType="circle" iconSize={10} />
                    <Line type="monotone" dataKey="forecast" stroke="#3B82F6" strokeWidth={2.5} dot={{ r: 3 }} name="Forecast" />
                    <Line type="monotone" dataKey="ci_upper" stroke="#94A3B8" strokeWidth={1} strokeDasharray="4 4" dot={false} name="CI Upper" />
                    <Line type="monotone" dataKey="ci_lower" stroke="#94A3B8" strokeWidth={1} strokeDasharray="4 4" dot={false} name="CI Lower" />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              {histData.length > 0 && (
                <ChartCard title="Historical Actual Admissions (Training Period)" subtitle="Non-zero daily admissions from training data — last 60 days" style={{ marginBottom: 20 }}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={histData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={6} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="actual" fill="#14B8A6" radius={[3,3,0,0]} name="Actual Admissions" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              <ChartCard title="Forecast Table" subtitle="30-day daily forecast with 95% confidence intervals">
                <div className="table-wrap" style={{ maxHeight: 300, overflowY: 'auto' }}>
                  <table>
                    <thead><tr><th>Date</th><th>Forecast</th><th>CI Lower (95%)</th><th>CI Upper (95%)</th></tr></thead>
                    <tbody>
                      {fcData.map(r => (
                        <tr key={r.date}>
                          <td>{r.date}</td>
                          <td><strong>{r.forecast?.toFixed(4)}</strong></td>
                          <td style={{ color: 'var(--text-muted)' }}>{r.ci_lower?.toFixed(4) ?? 'N/A'}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{r.ci_upper?.toFixed(4) ?? 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ChartCard>

              <div className="info-box note" style={{ marginTop: 16 }}>
                <AlertCircle size={14} className="info-box-icon" />
                <div className="info-box-text">{forecast.note}</div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
