import { useCallback } from 'react';
import { RefreshCw, AlertCircle, CheckCircle, Database, ArrowRight } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import KpiCard from '../components/KpiCard';
import ChartCard from '../components/ChartCard';
import { LoadingState, ErrorState } from '../components/common/States';
import { useApi } from '../hooks/useApi';
import { fetchDashboardAnalytics, fetchProjectStats } from '../services/api';

const COLORS = ['#14B8A6','#3B82F6','#F59E0B','#EF4444','#8B5CF6','#10B981','#64748B'];

const DATASET_META = {
  healthcare:        { label: 'Healthcare Dataset',        color: '#14B8A6' },
  emergency:         { label: 'Hospital ER Data',          color: '#3B82F6' },
  hospital_insights: { label: 'Hospital Insights Summary', color: '#F59E0B' },
  patient_flow:      { label: 'Patient Flow Data',         color: '#8B5CF6' },
};

function fmt(v, decimals = 1) {
  if (v == null) return 'N/A';
  if (typeof v === 'number') return v.toLocaleString(undefined, { maximumFractionDigits: decimals });
  return v;
}

export default function Dashboard({ onNavigate }) {
  const { data: analytics, loading: aLoading, error: aError, reload: aReload } = useApi(fetchDashboardAnalytics);
  const { data: stats, loading: sLoading, error: sError, reload: sReload } = useApi(fetchProjectStats);

  const reload = useCallback(() => { aReload(); sReload(); }, [aReload, sReload]);
  const loading = aLoading || sLoading;
  const error = aError || sError;

  const kpis = analytics?.kpis || {};
  const charts = analytics?.charts || {};

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Dashboard Overview</h1>
          <p>PulseNova — healthcare operational data and predictive analytics platform</p>
        </div>
        <button className="btn btn-outline" onClick={reload} disabled={loading} style={{ height: 34, fontSize: 12 }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {loading && <LoadingState message="Fetching analytics from API…" />}
      {!loading && error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && (
        <>
          {/* Dataset status cards */}
          {stats && (
            <div className="kpi-grid" style={{ marginBottom: 24 }}>
              {stats.datasets.map(ds => {
                const meta = DATASET_META[ds.key] || { label: ds.key, color: '#64748B' };
                return (
                  <div key={ds.key} className="kpi-card" style={{ borderTop: `3px solid ${meta.color}` }}>
                    <div className="kpi-card-top">
                      <div>
                        <div className="kpi-label">{meta.label}</div>
                        <div className="kpi-value" style={{ marginTop: 6 }}>{ds.loaded ? ds.rows.toLocaleString() : '—'}</div>
                      </div>
                      {ds.loaded
                        ? <CheckCircle size={20} style={{ color: '#10B981', flexShrink: 0 }} />
                        : <AlertCircle size={20} style={{ color: '#EF4444', flexShrink: 0 }} />}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {ds.loaded
                        ? <><span className="badge badge-teal">{ds.columns} cols</span><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>rows loaded</span></>
                        : <span className="badge" style={{ background: '#fee2e2', color: '#991b1b' }}>Not loaded</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* KPI row */}
          <div className="kpi-grid" style={{ marginBottom: 24 }}>
            <KpiCard label="Avg Wait Time" value={kpis.avg_wait_time != null ? `${fmt(kpis.avg_wait_time)} min` : 'N/A'} iconColor="amber" sub="Emergency dataset" />
            <KpiCard label="Avg Satisfaction" value={kpis.avg_satisfaction != null ? fmt(kpis.avg_satisfaction) : 'N/A'} iconColor="green" sub="0–10 scale (ER)" />
            <KpiCard label="Avg Billing" value={kpis.avg_billing != null ? `$${fmt(kpis.avg_billing, 0)}` : 'N/A'} iconColor="blue" sub="Healthcare dataset" />
            <KpiCard label="Avg Length of Stay" value={kpis.avg_los_days != null ? `${fmt(kpis.avg_los_days)} days` : 'N/A'} iconColor="teal" sub="Healthcare dataset" />
            <KpiCard label="Total Insights Admissions" value={kpis.total_admitted_insights != null ? fmt(kpis.total_admitted_insights, 0) : 'N/A'} iconColor="navy" sub="Hospital insights (sum)" />
          </div>

          {/* Charts row 1 */}
          <div className="grid-2 mb-20">
            {charts.admissions_trend?.length > 0 && (
              <ChartCard title="Monthly Admissions Trend" subtitle="Healthcare dataset — admissions per month">
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

          {/* Charts row 2 */}
          <div className="grid-2 mb-20">
            {charts.medical_conditions?.length > 0 && (
              <ChartCard title="Medical Condition Distribution" subtitle="Healthcare dataset — top conditions">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={charts.medical_conditions} layout="vertical" margin={{ top: 4, right: 16, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={90} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#14B8A6" radius={[0,3,3,0]} name="Records" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
            {charts.admission_types?.length > 0 && (
              <ChartCard title="Admission Type Distribution" subtitle="Healthcare dataset">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={charts.admission_types} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                      {charts.admission_types.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v.toLocaleString(), n]} />
                    <Legend iconType="circle" iconSize={10} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>

          {/* Charts row 3 */}
          <div className="grid-2 mb-20">
            {charts.department_referrals?.length > 0 && (
              <ChartCard title="Department Referrals" subtitle="Emergency dataset — record count by department">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={charts.department_referrals} layout="vertical" margin={{ top: 4, right: 16, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={110} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3B82F6" radius={[0,3,3,0]} name="Records" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
            {charts.weekly_admissions?.length > 0 && (
              <ChartCard title="Weekly Admissions (Hospital Insights)" subtitle="Sum of patients_admitted per week">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={charts.weekly_admissions} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} interval={4} label={{ value: 'Week', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="patients_admitted" fill="#8B5CF6" radius={[3,3,0,0]} name="Admitted" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>

          {/* Quick nav */}
          <div className="card" style={{ padding: '20px 24px', marginBottom: 20 }}>
            <div className="card-title" style={{ marginBottom: 16 }}>Quick Navigation</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {[
                { id: 'patients',    label: 'Patient Analytics' },
                { id: 'emergency',   label: 'Emergency & Patient Flow' },
                { id: 'operational', label: 'Operational Efficiency' },
                { id: 'predictive',  label: 'Predictive Analytics' },
                { id: 'explorer',    label: 'Data Explorer' },
              ].map(item => (
                <button key={item.id} className="btn btn-outline" onClick={() => onNavigate?.(item.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {item.label} <ArrowRight size={13} />
                </button>
              ))}
            </div>
          </div>

          <div className="info-box info">
            <AlertCircle size={16} className="info-box-icon" />
            <div className="info-box-text">
              <div className="info-box-title">Research Platform</div>
              All metrics are computed from static CSV research datasets. Dataset row counts and KPIs are fetched live from the FastAPI backend. No live clinical data integration exists.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
