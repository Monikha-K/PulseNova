import { useState, useCallback } from 'react';
import { Brain, AlertCircle, CheckCircle, Plus, Trash2 } from 'lucide-react';
import ChartCard from '../components/ChartCard';
import { LoadingState } from '../components/common/States';
import { useApi } from '../hooks/useApi';
import { fetchSimulatorOptions, simulatePredict, fetchHistoricalContext } from '../services/api';

const LIMITATION = "The staffing dataset has 208 records. The target (recommended_staff) follows a deterministic rule: 1–5 admissions → level 1, 6–10 → level 2. Perfect accuracy reflects this rule, not generalisation. Predictions are experimental and are not clinical or managerial orders. Independent validation is required before any operational use.";

function ResultCard({ result, title }) {
  if (!result) return null;
  if (!result.available) {
    return (
      <div className="info-box warning">
        <AlertCircle size={14} className="info-box-icon" />
        <div className="info-box-text"><div className="info-box-title">{result.model} — Unavailable</div>{result.error}</div>
      </div>
    );
  }
  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <CheckCircle size={16} style={{ color: '#10B981' }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>{result.model}</span>
        <span className="badge badge-teal">{result.predicted_label}</span>
      </div>
      {result.class_probabilities && (
        <div style={{ marginBottom: 10 }}>
          {Object.entries(result.class_probabilities).map(([cls, prob]) => (
            <div key={cls} className="progress-bar-wrap" style={{ marginBottom: 8 }}>
              <div className="progress-bar-label"><span>{cls}</span><span>{(prob * 100).toFixed(1)}%</span></div>
              <div className="progress-bar-track"><div className="progress-bar-fill" style={{ width: `${prob * 100}%` }} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScenarioForm({ form, onChange, services, label }) {
  const fields = [
    { key: 'week', label: 'Week (1–52)', type: 'number', min: 1, max: 52, step: 1 },
    { key: 'patients_admitted', label: 'Patients Admitted', type: 'number', min: 0, max: 20, step: 1 },
    { key: 'avg_stay', label: 'Avg Stay (days)', type: 'number', min: 0, max: 30, step: 0.5 },
    { key: 'avg_satisfaction', label: 'Avg Satisfaction (0–100)', type: 'number', min: 0, max: 100, step: 1 },
    { key: 'max_occupancy', label: 'Max Occupancy (count)', type: 'number', min: 0, max: 20, step: 1 },
    { key: 'staff_count', label: 'Staff Count', type: 'number', min: 0, max: 50, step: 1 },
  ];
  return (
    <div>
      {label && <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: 'var(--text)' }}>{label}</div>}
      <div style={{ marginBottom: 12 }}>
        <div className="filter-label" style={{ marginBottom: 4 }}>Service</div>
        <select value={form.service} onChange={e => onChange('service', e.target.value)}
          style={{ height: 34, width: '100%', padding: '0 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }}>
          {services.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
        {fields.map(f => (
          <div key={f.key}>
            <div className="filter-label" style={{ marginBottom: 4 }}>{f.label}</div>
            <input type="number" value={form[f.key]} min={f.min} max={f.max} step={f.step}
              onChange={e => onChange(f.key, parseFloat(e.target.value) || 0)}
              style={{ height: 34, width: '100%', padding: '0 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WorkforceSimulator() {
  const optsFn = useCallback(() => fetchSimulatorOptions(), []);
  const { data: opts, loading: optsLoading } = useApi(optsFn);

  const defaultScenario = opts?.default_scenario
    ? { week: opts.default_scenario.week, service: opts.default_scenario.service, patients_admitted: opts.default_scenario.patients_admitted, avg_stay: parseFloat(opts.default_scenario.avg_stay.toFixed(1)), avg_satisfaction: parseFloat(opts.default_scenario.avg_satisfaction.toFixed(1)), max_occupancy: opts.default_scenario.max_occupancy, staff_count: opts.default_scenario.staff_count }
    : { week: 1, service: 'ICU', patients_admitted: 5, avg_stay: 7, avg_satisfaction: 79, max_occupancy: 11, staff_count: 31 };

  const [form, setForm] = useState(defaultScenario);
  const [predicting, setPredicting] = useState(false);
  const [xgbResult, setXgbResult] = useState(null);
  const [rfResult, setRfResult] = useState(null);
  const [cmpResult, setCmpResult] = useState(null);
  const [predError, setPredError] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [histContext, setHistContext] = useState(null);
  const [histLoading, setHistLoading] = useState(false);

  const services = opts?.valid_services || ['ICU', 'emergency', 'general_medicine', 'surgery'];

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function runPredict() {
    setPredicting(true); setPredError(null); setXgbResult(null); setRfResult(null); setCmpResult(null);
    const r = await simulatePredict(form);
    if (r.ok) {
      setCmpResult(r.data);
      setXgbResult(r.data.xgboost);
      setRfResult(r.data.random_forest);
    } else {
      setPredError(r.error);
    }
    setPredicting(false);
  }

  async function loadHistContext() {
    setHistLoading(true);
    const r = await fetchHistoricalContext(form.service);
    setHistContext(r);
    setHistLoading(false);
  }

  function addScenario() {
    const name = `Scenario ${scenarios.length + 1}`;
    setScenarios(s => [...s, { name, ...form, xgb: xgbResult, rf: rfResult }]);
  }

  function removeScenario(i) { setScenarios(s => s.filter((_, idx) => idx !== i)); }

  function resetForm() {
    setForm(defaultScenario);
    setXgbResult(null); setRfResult(null); setCmpResult(null); setPredError(null);
  }

  if (optsLoading) return <div className="page-content"><LoadingState message="Loading simulator options…" /></div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Workforce Planning Simulator</h1>
        <p>What-if staffing scenario analysis using saved XGBoost and Random Forest classifiers</p>
      </div>

      <div className="info-box warning" style={{ marginBottom: 20 }}>
        <AlertCircle size={15} className="info-box-icon" />
        <div className="info-box-text">
          <div className="info-box-title">Model Limitation Warning</div>
          {LIMITATION}
        </div>
      </div>

      {/* Model availability */}
      {opts?.model_availability && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
          {Object.entries(opts.model_availability).map(([k, loaded]) => (
            <div key={k} className="stat-pill" style={{ flex: 'none' }}>
              {loaded ? <CheckCircle size={14} style={{ color: '#10B981' }} /> : <AlertCircle size={14} style={{ color: '#EF4444' }} />}
              <span className="stat-pill-label">{k}</span>
              <span className="badge" style={{ background: loaded ? '#d1fae5' : '#fee2e2', color: loaded ? '#065f46' : '#991b1b' }}>
                {loaded ? 'Loaded' : 'Unavailable'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Scenario Form */}
      <ChartCard title="Scenario Input" subtitle={opts?.default_scenario?._source ? `Default: ${opts.default_scenario._source}` : 'Enter feature values'} style={{ marginBottom: 20 }}>
        <ScenarioForm form={form} onChange={setField} services={services} />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
          <button className="btn btn-primary" onClick={runPredict} disabled={predicting}>
            <Brain size={14} /> {predicting ? 'Predicting…' : 'Predict (Both Models)'}
          </button>
          <button className="btn btn-outline" onClick={loadHistContext} disabled={histLoading}>
            {histLoading ? 'Loading…' : 'Load Historical Context'}
          </button>
          {(xgbResult || rfResult) && (
            <button className="btn btn-outline" onClick={addScenario}>
              <Plus size={13} /> Save Scenario
            </button>
          )}
          <button className="btn btn-ghost" onClick={resetForm}>Reset</button>
        </div>
        {predError && (
          <div className="info-box warning" style={{ marginTop: 12 }}>
            <AlertCircle size={14} className="info-box-icon" />
            <div className="info-box-text">{predError}</div>
          </div>
        )}
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

      {/* Historical Context */}
      {histContext && !histContext.error && (
        <ChartCard title={`Historical Context — ${histContext.service}`} subtitle="Descriptive statistics from hospital_insights_summary.csv (not live data)" style={{ marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {Object.entries(histContext).filter(([k]) => typeof histContext[k] === 'object' && histContext[k]?.mean !== undefined).map(([col, stats]) => (
              <div key={col} style={{ padding: '10px 12px', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{col}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>avg: {stats.mean}</div>
                <div style={{ fontSize: 11, color: 'var(--text-light)' }}>range: {stats.min}–{stats.max}</div>
              </div>
            ))}
          </div>
          <div className="info-box note" style={{ marginTop: 12 }}>
            <AlertCircle size={13} className="info-box-icon" />
            <div className="info-box-text" style={{ fontSize: 11 }}>{histContext.note}</div>
          </div>
        </ChartCard>
      )}

      {/* Scenario Comparison */}
      {scenarios.length > 0 && (
        <ChartCard title="Saved Scenario Comparison" subtitle="Session-only — not persisted after page reload" style={{ marginBottom: 20 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Service</th><th>Week</th><th>Admitted</th><th>Avg Stay</th>
                  <th>Satisfaction</th><th>Occupancy</th><th>Staff</th><th>XGBoost</th><th>RF</th><th>Agree</th><th></th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((s, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600, fontSize: 12 }}>{s.name}</td>
                    <td><span className="badge badge-teal">{s.service}</span></td>
                    <td>{s.week}</td>
                    <td>{s.patients_admitted}</td>
                    <td>{s.avg_stay}</td>
                    <td>{s.avg_satisfaction}</td>
                    <td>{s.max_occupancy}</td>
                    <td>{s.staff_count}</td>
                    <td>{s.xgb?.predicted_label || '—'}</td>
                    <td>{s.rf?.predicted_label || '—'}</td>
                    <td>{s.xgb && s.rf ? (s.xgb.predicted_class === s.rf.predicted_class ? '✓' : '✗') : '—'}</td>
                    <td><button className="btn btn-ghost" style={{ height: 26, padding: '0 8px' }} onClick={() => removeScenario(i)}><Trash2 size={12} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}
    </div>
  );
}
