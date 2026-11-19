import { useState, useCallback } from 'react';
import { Activity, Users, TrendingUp, Layers } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import KpiCard from '../components/KpiCard';
import ChartCard from '../components/ChartCard';
import { LoadingState, ErrorState } from '../components/common/States';
import { useApi } from '../hooks/useApi';
import { fetchOperationsAnalytics } from '../services/api';

function fmt(v, d = 2) {
  if (v == null) return 'N/A';
  return typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: d }) : v;
}

export default function Operational() {
  const [filters, setFilters] = useState({ service: '', week_min: '', week_max: '' });

  const fetchFn = useCallback(() => {
    const params = {};
    if (filters.service) params.service = filters.service;
    if (filters.week_min) params.week_min = parseInt(filters.week_min);
    if (filters.week_max) params.week_max = parseInt(filters.week_max);
    return fetchOperationsAnalytics(params);
  }, [filters]);

  const { data, loading, error, reload } = useApi(fetchFn, [filters]);

  const kpis = data?.kpis || {};
  const charts = data?.charts || {};
  const opts = data?.filter_options || {};

  function setFilter(k, v) { setFilters(f => ({ ...f, [k]: v })); }
  function clearFilters() { setFilters({ service: '', week_min: '', week_max: '' }); }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Operational Efficiency</h1>
        <p>Staffing levels, bed occupancy, and service-level metrics — hospital_insights_summary dataset (208 records, 4 services, 52 weeks)</p>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <div className="filter-label" style={{ marginBottom: 4 }}>Service</div>
            <select value={filters.service} onChange={e => setFilter('service', e.target.value)} style={{ height: 34, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }}>
              <option value="">All Services</option>
              {opts.services?.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div className="filter-label" style={{ marginBottom: 4 }}>Week Min</div>
            <input type="number" value={filters.week_min} onChange={e => setFilter('week_min', e.target.value)} placeholder={opts.week_min || '1'}
              style={{ height: 34, width: 70, padding: '0 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }} />
          </div>
          <div>
            <div className="filter-label" style={{ marginBottom: 4 }}>Week Max</div>
            <input type="number" value={filters.week_max} onChange={e => setFilter('week_max', e.target.value)} placeholder={opts.week_max || '52'}
              style={{ height: 34, width: 70, padding: '0 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }} />
          </div>
          <button className="btn btn-outline" onClick={clearFilters} style={{ height: 34, fontSize: 12 }}>Clear</button>
        </div>
      </div>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && (
        <>
          <div className="kpi-grid" style={{ marginBottom: 24 }}>
            <KpiCard icon={Layers}     iconColor="teal"  label="Total Records"         value={fmt(kpis.total_records, 0)} sub="Hospital insights" />
            <KpiCard icon={Users}      iconColor="blue"  label="Total Patients Admitted" value={fmt(kpis.total_patients_admitted, 0)} sub="Sum of patients_admitted" />
            <KpiCard icon={Activity}   iconColor="amber" label="Avg Length of Stay"    value={kpis.avg_stay != null ? `${fmt(kpis.avg_stay)} days` : 'N/A'} sub="avg_stay column" />
            <KpiCard icon={TrendingUp} iconColor="green" label="Avg Satisfaction"      value={kpis.avg_satisfaction != null ? `${fmt(kpis.avg_satisfaction)}` : 'N/A'} sub="avg_satisfaction (0–100)" />
            <KpiCard icon={Users}      iconColor="navy"  label="Avg Staff Count"       value={fmt(kpis.avg_staff_count)} sub="staff_count column" />
            <KpiCard icon={Users}      iconColor="teal"  label="Avg Recommended Staff" value={fmt(kpis.avg_recommended_staff)} sub="recommended_staff column" />
            <KpiCard icon={Activity}   iconColor="red"   label="Max Occupancy Observed" value={fmt(kpis.max_occupancy_observed, 0)} sub="max_occupancy (count, not %)" />
          </div>

          <div className="info-box warning" style={{ marginBottom: 20 }}>
            <Activity size={15} className="info-box-icon" />
            <div className="info-box-text">
              <strong>Note on max_occupancy:</strong> This column contains integer counts (3–14), not percentages. It is labeled as observed occupancy count per record, not a bed utilisation rate. <strong>staff_count</strong> (25–39) represents recorded staffing values in the dataset, not live available staff.
            </div>
          </div>

          <div className="grid-2 mb-20">
            {charts.admissions_by_week?.length > 0 && (
              <ChartCard title="Admissions by Week" subtitle="Sum of patients_admitted per week number">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={charts.admissions_by_week} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} interval={4} label={{ value: 'Week', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="patients_admitted" fill="#14B8A6" radius={[3,3,0,0]} name="Admitted" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
            {charts.admissions_by_service?.length > 0 && (
              <ChartCard title="Total Admissions by Service" subtitle="Sum of patients_admitted per service">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={charts.admissions_by_service} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="service" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="patients_admitted" fill="#3B82F6" radius={[3,3,0,0]} name="Admitted" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>

          <div className="grid-2 mb-20">
            {charts.staff_vs_recommended?.length > 0 && (
              <ChartCard title="Staff Count vs Recommended Staff by Service" subtitle="Mean values per service — observed dataset values only">
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
            {charts.occupancy_by_service?.length > 0 && (
              <ChartCard title="Avg Max Occupancy by Service" subtitle="Mean max_occupancy count per service (integer count, not %)">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={charts.occupancy_by_service} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="service" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="max_occupancy" fill="#8B5CF6" radius={[3,3,0,0]} name="Avg Occupancy" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>

          <div className="grid-2 mb-20">
            {charts.avg_stay_by_service?.length > 0 && (
              <ChartCard title="Avg Length of Stay by Service" subtitle="Mean avg_stay (days) per service">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={charts.avg_stay_by_service} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="service" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit=" d" />
                    <Tooltip formatter={v => [`${v} days`, 'Avg Stay']} />
                    <Bar dataKey="avg_stay" fill="#10B981" radius={[3,3,0,0]} name="Avg Stay (days)" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
            {charts.avg_satisfaction_by_service?.length > 0 && (
              <ChartCard title="Avg Satisfaction by Service" subtitle="Mean avg_satisfaction per service (0–100 scale)">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={charts.avg_satisfaction_by_service} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="service" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="avg_satisfaction" fill="#EF4444" radius={[3,3,0,0]} name="Avg Satisfaction" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>

          {charts.occupancy_by_week?.length > 0 && (
            <ChartCard title="Avg Max Occupancy by Week" subtitle="Mean max_occupancy count per week number" style={{ marginBottom: 20 }}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={charts.occupancy_by_week} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} interval={4} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="max_occupancy" stroke="#8B5CF6" strokeWidth={2} dot={false} name="Avg Occupancy" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {charts.service_comparison?.length > 0 && (
            <ChartCard title="Service-Level Comparison Table" subtitle="Aggregated metrics per service — hospital_insights dataset">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Service</th><th>Total Admitted</th><th>Avg Stay (d)</th>
                      <th>Avg Satisfaction</th><th>Avg Staff</th><th>Avg Recommended</th><th>Avg Occupancy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {charts.service_comparison.map(r => (
                      <tr key={r.service}>
                        <td><span className="badge badge-teal">{r.service}</span></td>
                        <td>{r.total_admitted}</td>
                        <td>{r.avg_stay}</td>
                        <td>{r.avg_satisfaction}</td>
                        <td>{r.avg_staff}</td>
                        <td>{r.avg_recommended}</td>
                        <td>{r.avg_occupancy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          )}
        </>
      )}
    </div>
  );
}
