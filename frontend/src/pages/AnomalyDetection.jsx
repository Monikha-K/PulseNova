import { useState, useCallback } from 'react';
import { Search, AlertTriangle, RefreshCw, Download, AlertCircle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import ChartCard from '../components/ChartCard';
import { LoadingState, ErrorState, EmptyState } from '../components/common/States';
import { useApi } from '../hooks/useApi';
import { fetchAnomalySummary, fetchAnomalies } from '../services/api';

const DATASETS   = ['', 'emergency', 'hospital_insights', 'healthcare'];
const CATEGORIES = ['', 'high_wait_time', 'unusual_admission_volume', 'operational_workload', 'staffing_discrepancy', 'data_quality'];
const SEVERITIES = ['', 'low', 'medium', 'high'];
const METHODS    = ['iqr', 'zscore'];

const SEV_COLORS = { high: '#EF4444', medium: '#F59E0B', low: '#10B981' };
const SEV_BG     = { high: '#fee2e2', medium: '#fef3c7', low: '#d1fae5' };
const SEV_TEXT   = { high: '#991b1b', medium: '#92400e', low: '#065f46' };

const CAT_LABELS = {
  high_wait_time: 'High Wait Time',
  unusual_admission_volume: 'Unusual Admissions',
  operational_workload: 'Operational Workload',
  staffing_discrepancy: 'Staffing Discrepancy',
  data_quality: 'Data Quality',
};

function SeverityBadge({ severity }) {
  return (
    <span className="badge" style={{ background: SEV_BG[severity] || '#f1f5f9', color: SEV_TEXT[severity] || 'var(--text-muted)', fontSize: 10 }}>
      {severity || 'unknown'}
    </span>
  );
}

export default function AnomalyDetection() {
  const [dataset,    setDataset]    = useState('');
  const [category,   setCategory]   = useState('');
  const [severity,   setSeverity]   = useState('');
  const [method,     setMethod]     = useState('iqr');
  const [multiplier, setMultiplier] = useState(1.5);
  const [page,       setPage]       = useState(0);
  const PAGE_SIZE = 25;

  const summaryFn = useCallback(() => fetchAnomalySummary(), []);
  const { data: summary } = useApi(summaryFn);

  const listFn = useCallback(() => fetchAnomalies({
    dataset: dataset || undefined,
    category: category || undefined,
    severity: severity || undefined,
    method,
    multiplier,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  }), [dataset, category, severity, method, multiplier, page]);

  const { data, loading, error, reload } = useApi(listFn, [dataset, category, severity, method, multiplier, page]);

  const anomalies = data?.anomalies || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const byCat = data?.by_category || summary?.by_category || {};
  const bySev = data?.by_severity || summary?.by_severity || {};

  const catChartData = Object.entries(byCat).map(([k, v]) => ({ label: CAT_LABELS[k] || k, value: v }));
  const sevChartData = Object.entries(bySev).map(([k, v]) => ({ label: k, value: v, fill: SEV_COLORS[k] || '#64748B' }));

  function exportCSV() {
    if (!anomalies.length) return;
    const cols = ['id','category','dataset','date','service_or_dept','observed_value','expected_range','severity','explanation','detection_method'];
    const rows = anomalies.map(a => cols.map(c => JSON.stringify(a[c] ?? '')).join(','));
    const csv = [cols.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'pulsenova_anomalies.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Anomaly Detection</h1>
        <p>Statistical and data-quality flags across PulseNova datasets — IQR and Z-score methods</p>
      </div>

      <div className="info-box warning" style={{ marginBottom: 20 }}>
        <AlertTriangle size={15} className="info-box-icon" />
        <div className="info-box-text">
          <div className="info-box-title">Responsible Interpretation</div>
          Anomaly flags indicate statistical or data-quality deviations in the available dataset. They are not diagnoses, confirmed incidents, or clinical alerts.
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="kpi-grid" style={{ marginBottom: 20 }}>
          <div className="kpi-card">
            <div className="kpi-card-top"><div><div className="kpi-label">Total Anomalies</div><div className="kpi-value" style={{ marginTop: 6 }}>{summary.total}</div></div><Search size={20} style={{ color: 'var(--teal)' }} /></div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Default IQR ×1.5 detection</div>
          </div>
          {Object.entries(byCat).slice(0, 4).map(([k, v]) => (
            <div key={k} className="kpi-card">
              <div className="kpi-card-top"><div><div className="kpi-label">{CAT_LABELS[k] || k}</div><div className="kpi-value" style={{ marginTop: 6 }}>{v}</div></div></div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>anomalies</div>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      {catChartData.length > 0 && (
        <div className="grid-2 mb-20">
          <ChartCard title="Anomalies by Category" subtitle="Count per detection category">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={catChartData} layout="vertical" margin={{ top: 4, right: 16, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={140} />
                <Tooltip />
                <Bar dataKey="value" fill="#14B8A6" radius={[0,3,3,0]} name="Count" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Anomalies by Severity" subtitle="Count per severity level">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={sevChartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[3,3,0,0]} name="Count">
                  {sevChartData.map((entry, i) => (
                    <Bar key={i} dataKey="value" fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {/* Controls */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <div className="filter-label" style={{ marginBottom: 4 }}>Dataset</div>
            <select value={dataset} onChange={e => { setDataset(e.target.value); setPage(0); }} style={{ height: 34, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }}>
              {DATASETS.map(d => <option key={d} value={d}>{d || 'All Datasets'}</option>)}
            </select>
          </div>
          <div>
            <div className="filter-label" style={{ marginBottom: 4 }}>Category</div>
            <select value={category} onChange={e => { setCategory(e.target.value); setPage(0); }} style={{ height: 34, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c ? (CAT_LABELS[c] || c) : 'All Categories'}</option>)}
            </select>
          </div>
          <div>
            <div className="filter-label" style={{ marginBottom: 4 }}>Severity</div>
            <select value={severity} onChange={e => { setSeverity(e.target.value); setPage(0); }} style={{ height: 34, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }}>
              {SEVERITIES.map(s => <option key={s} value={s}>{s || 'All Severities'}</option>)}
            </select>
          </div>
          <div>
            <div className="filter-label" style={{ marginBottom: 4 }}>Method</div>
            <select value={method} onChange={e => { setMethod(e.target.value); setPage(0); }} style={{ height: 34, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }}>
              {METHODS.map(m => <option key={m} value={m}>{m === 'iqr' ? 'IQR' : 'Z-Score'}</option>)}
            </select>
          </div>
          <div>
            <div className="filter-label" style={{ marginBottom: 4 }}>Multiplier / Threshold</div>
            <input type="number" value={multiplier} min={0.5} max={5} step={0.5}
              onChange={e => { setMultiplier(parseFloat(e.target.value) || 1.5); setPage(0); }}
              style={{ height: 34, width: 80, padding: '0 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }} />
          </div>
          <button className="btn btn-primary" onClick={reload} disabled={loading} style={{ height: 34, fontSize: 12 }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'Detecting…' : 'Run Detection'}
          </button>
          <button className="btn btn-outline" onClick={() => { setDataset(''); setCategory(''); setSeverity(''); setMethod('iqr'); setMultiplier(1.5); setPage(0); }} style={{ height: 34, fontSize: 12 }}>
            Reset Filters
          </button>
          <button className="btn btn-outline" onClick={exportCSV} disabled={!anomalies.length} style={{ height: 34, fontSize: 12, marginLeft: 'auto' }}>
            <Download size={13} /> Export CSV
          </button>
        </div>
        {data?.detection_config && (
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
            Config: method={data.detection_config.method}, multiplier={data.detection_config.multiplier}
            {data.detected_at && ` · Detected at ${new Date(data.detected_at).toLocaleTimeString()}`}
          </div>
        )}
      </div>

      {loading && <LoadingState message="Running anomaly detection…" />}
      {!loading && error && <ErrorState error={error} onRetry={reload} />}
      {!loading && !error && anomalies.length === 0 && <EmptyState message="No anomalies found with the current filters." />}

      {!loading && !error && anomalies.length > 0 && (
        <>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total} anomalies
          </div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Category</th><th>Dataset</th><th>Period</th><th>Service / Dept</th>
                    <th>Observed</th><th>Expected Range</th><th>Severity</th><th>Explanation</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalies.map(a => (
                    <tr key={a.id}>
                      <td><span className="badge badge-teal" style={{ fontSize: 10 }}>{CAT_LABELS[a.category] || a.category}</span></td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.dataset}</td>
                      <td style={{ fontSize: 11 }}>{a.date || '—'}</td>
                      <td style={{ fontSize: 11 }}>{a.service_or_dept || '—'}</td>
                      <td style={{ fontWeight: 600, fontSize: 12 }}>{a.observed_value}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.expected_range || '—'}</td>
                      <td><SeverityBadge severity={a.severity} /></td>
                      <td style={{ fontSize: 11, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.explanation}>{a.explanation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
            <button className="btn btn-outline" style={{ height: 30, fontSize: 12 }} disabled={page === 0} onClick={() => setPage(0)}>«</button>
            <button className="btn btn-outline" style={{ height: 30, fontSize: 12 }} disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
            <span style={{ fontSize: 13, padding: '0 8px' }}>Page {page + 1} / {totalPages}</span>
            <button className="btn btn-outline" style={{ height: 30, fontSize: 12 }} disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next ›</button>
            <button className="btn btn-outline" style={{ height: 30, fontSize: 12 }} disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>»</button>
          </div>
        </>
      )}
    </div>
  );
}
