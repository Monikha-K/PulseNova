import { useCallback } from 'react';
import {
  RefreshCw, CheckCircle, AlertCircle, Monitor,
  Clock, Users, Activity, TrendingUp, ArrowRight, Brain,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import KpiCard from '../components/KpiCard';
import ChartCard from '../components/ChartCard';
import { LoadingState, ErrorState } from '../components/common/States';
import { useApi } from '../hooks/useApi';
import { fetchCommandCenter } from '../services/api';

const COLORS = ['#14B8A6','#3B82F6','#F59E0B','#EF4444','#8B5CF6','#10B981'];

const DISCLAIMER = "PulseNova is an academic healthcare analytics platform. Its statistics and model outputs are exploratory and are not substitutes for professional clinical or hospital management decisions.";

function fmt(v, d = 1) {
  if (v == null) return 'N/A';
  return typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: d }) : v;
}

function DatasetStatusBadge({ status }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
      {Object.entries(status).map(([key, s]) => (
        <div key={key} className="stat-pill" style={{ flex: 'none' }}>
          {s.loaded
            ? <CheckCircle size={14} style={{ color: '#10B981' }} />
            : <AlertCircle size={14} style={{ color: '#EF4444' }} />}
          <span className="stat-pill-label">{key}</span>
          <span className="badge" style={{ background: s.loaded ? '#d1fae5' : '#fee2e2', color: s.loaded ? '#065f46' : '#991b1b' }}>
            {s.loaded ? `${s.rows.toLocaleString()} rows` : 'Not loaded'}
          </span>
        </div>
      ))}
    </div>
  );
}

function InsightCard({ insight }) {
  const colors = { info: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' }, warning: { bg: '#fffbeb', border: '#fde68a', text: '#92400e' }, high: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' } };
  const c = colors[insight.severity] || colors.info;
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, padding: '14px 16px', marginBottom: 10 }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: c.text, marginBottom: 4 }}>{insight.title}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{insight.explanation}</div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: c.text }}>{insight.metric}</span>
        <span style={{ fontSize: 11, color: 'var(--text-light)' }}>Source: {insight.source}</span>
        <span style={{ fontSize: 11, color: 'var(--text-light)' }}>{insight.period}</span>
      </div>
    </div>
  );
}

export default function CommandCenter({ onNavigate }) {
  const { data, loading, error, reload } = useApi(fetchCommandCenter);

  const kpis = data?.kpis || {};
  const charts = data?.charts || {};
  const insights = data?.insights || [];
  const datasetStatus = data?.dataset_status || {};
  const modelStatus = data?.model_status || {};

  const quickLinks = [
    { id: 'patients',             label: 'Patient Analytics' },
    { id: 'emergency',            label: 'Emergency & Flow' },
    { id: 'operational',          label: 'Operational Efficiency' },
    { id: 'workforce-simulator',  label: 'Workforce Simulator' },
    { id: 'anomalies',            label: 'Anomaly Detection' },
    { id: 'ai-assistant',         label: 'AI Data Assistant' },
    { id: 'predictive',           label: 'Predictive Analytics' },
  ];

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Hospital Command Center</h1>
          <p>Unified view of healthcare operations, patient flow, and staffing indicators — static CSV dataset snapshot</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {data?.generated_at && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Last loaded: {new Date(data.generated_at).toLocaleTimeString()}
            </span>
          )}
          <button className="btn btn-outline" onClick={reload} disabled={loading} style={{ height: 34, fontSize: 12 }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="info-box note" style={{ marginBottom: 16 }}>
        <Monitor size={14} className="info-box-icon" />
        <div className="info-box-text" style={{ fontSize: 12 }}>{DISCLAIMER}</div>
      </div>

      {loading && <LoadingState message="Loading command center data…" />}
      {!loading && error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && data && (
        <>
          {/* Dataset & Model Status */}
          <DatasetStatusBadge status={datasetStatus} />

          {Object.keys(modelStatus).length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {Object.entries(modelStatus).map(([key, m]) => (
                <div key={key} className="stat-pill" style={{ flex: 'none' }}>
                  <Brain size={13} style={{ color: m.loaded ? '#10B981' : '#EF4444' }} />
                  <span className="stat-pill-label" style={{ fontSize: 11 }}>{key}</span>
                  <span className="badge" style={{ background: m.loaded ? '#d1fae5' : '#fee2e2', color: m.loaded ? '#065f46' : '#991b1b', fontSize: 10 }}>
                    {m.loaded ? 'Loaded' : 'Unavailable'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* KPI Grid */}
          <div className="kpi-grid" style={{ marginBottom: 24 }}>
            <KpiCard icon={Users}    iconColor="teal"   label="Healthcare Records"    value={fmt(kpis.healthcare_records, 0)}        sub="healthcare_dataset.csv" />
            <KpiCard icon={AlertCircle} iconColor="red" label="Emergency Records"     value={fmt(kpis.emergency_records, 0)}         sub="Hospital ER_Data.csv" />
            <KpiCard icon={Activity} iconColor="blue"   label="Patient Flow Records"  value={fmt(kpis.patient_flow_records, 0)}      sub="patient_flow_data.csv" />
            <KpiCard icon={Clock}    iconColor="amber"  label="Avg ER Wait Time"      value={kpis.avg_wait_time != null ? `${fmt(kpis.avg_wait_time)} min` : 'N/A'} sub="Emergency dataset" />
            <KpiCard icon={TrendingUp} iconColor="green" label="Avg ER Satisfaction"  value={kpis.avg_er_satisfaction != null ? fmt(kpis.avg_er_satisfaction) : 'N/A'} sub="0–10 scale (non-null)" />
            <KpiCard icon={Users}    iconColor="navy"   label="Total Insights Admissions" value={fmt(kpis.total_admitted_insights, 0)} sub="hospital_insights (sum)" />
            <KpiCard icon={Activity} iconColor="teal"   label="Avg Stay (Insights)"   value={kpis.avg_stay_days != null ? `${fmt(kpis.avg_stay_days)} days` : 'N/A'} sub="hospital_insights avg_stay" />
            <KpiCard icon={CheckCircle} iconColor="green" label="ER Admitted"         value={fmt(kpis.er_admitted_count, 0)}         sub="Admission flag = True" />
          </div>

          {/* Charts Row 1 */}
          <div className="grid-2 mb-20">
            {charts.admissions_trend?.length > 0 && (
              <ChartCard title="Monthly Admissions Trend" subtitle="Healthcare dataset — admissions per month (last 24 months)">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={charts.admissions_trend} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 9 }} interval={3} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="admissions" stroke="#14B8A6" strokeWidth={2} dot={false} name="Admissions" />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
            {charts.wait_time_distribution?.length > 0 && (
              <ChartCard title="ER Wait Time Distribution" subtitle="Emergency dataset — patient count by wait bracket">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={charts.wait_time_distribution} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#F59E0B" radius={[3,3,0,0]} name="Patients" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>

          {/* Charts Row 2 */}
          <div className="grid-2 mb-20">
            {charts.admissions_by_service?.length > 0 && (
              <ChartCard title="Admissions by Service" subtitle="hospital_insights — total patients_admitted per service">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={charts.admissions_by_service} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="service" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="patients_admitted" fill="#14B8A6" radius={[3,3,0,0]} name="Admitted" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
            {charts.avg_stay_by_service?.length > 0 && (
              <ChartCard title="Avg Stay by Service" subtitle="hospital_insights — mean avg_stay (days) per service">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={charts.avg_stay_by_service} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="service" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit=" d" />
                    <Tooltip formatter={v => [`${v} days`, 'Avg Stay']} />
                    <Bar dataKey="avg_stay" fill="#3B82F6" radius={[3,3,0,0]} name="Avg Stay" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>

          {/* Charts Row 3 */}
          <div className="grid-2 mb-20">
            {charts.staff_vs_recommended?.length > 0 && (
              <ChartCard title="Staff Count vs Recommended" subtitle="hospital_insights — mean values per service">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={charts.staff_vs_recommended} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="service" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend iconType="circle" iconSize={10} />
                    <Bar dataKey="avg_staff" fill="#14B8A6" radius={[3,3,0,0]} name="Avg Staff Count" />
                    <Bar dataKey="avg_recommended" fill="#F59E0B" radius={[3,3,0,0]} name="Avg Recommended" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
            {charts.department_workload?.length > 0 && (
              <ChartCard title="Department Workload" subtitle="Emergency dataset — record count by department">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={charts.department_workload} layout="vertical" margin={{ top: 4, right: 16, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="department" tick={{ fontSize: 10 }} width={110} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8B5CF6" radius={[0,3,3,0]} name="Records" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>

          {/* Operational Insights */}
          {insights.length > 0 && (
            <ChartCard title="Operational Insights" subtitle="Data-derived observations from actual dataset values" style={{ marginBottom: 20 }}>
              {insights.map((ins, i) => <InsightCard key={i} insight={ins} />)}
            </ChartCard>
          )}

          {/* Quick Navigation */}
          <div className="card" style={{ padding: '20px 24px', marginBottom: 20 }}>
            <div className="card-title" style={{ marginBottom: 14 }}>Quick Navigation</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {quickLinks.map(item => (
                <button key={item.id} className="btn btn-outline" onClick={() => onNavigate?.(item.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {item.label} <ArrowRight size={13} />
                </button>
              ))}
            </div>
          </div>

          {data.note && (
            <div className="info-box note">
              <AlertCircle size={14} className="info-box-icon" />
              <div className="info-box-text" style={{ fontSize: 12 }}>{data.note}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
