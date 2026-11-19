import { useState, useCallback } from 'react';
import { AlertTriangle, Clock, Star, Activity } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import KpiCard from '../components/KpiCard';
import ChartCard from '../components/ChartCard';
import { LoadingState, ErrorState } from '../components/common/States';
import { useApi } from '../hooks/useApi';
import { fetchEmergencyAnalytics } from '../services/api';

const COLORS = ['#14B8A6','#3B82F6','#F59E0B','#EF4444','#8B5CF6','#10B981','#64748B','#0EA5E9'];

function fmt(v, d = 1) {
  if (v == null) return 'N/A';
  return typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: d }) : v;
}

export default function Emergency() {
  const [filters, setFilters] = useState({ department: '', gender: '', age_min: '', age_max: '', wait_min: '', wait_max: '' });

  const fetchFn = useCallback(() => {
    const params = {};
    if (filters.department) params.department = filters.department;
    if (filters.gender) params.gender = filters.gender;
    if (filters.age_min) params.age_min = parseInt(filters.age_min);
    if (filters.age_max) params.age_max = parseInt(filters.age_max);
    if (filters.wait_min) params.wait_min = parseFloat(filters.wait_min);
    if (filters.wait_max) params.wait_max = parseFloat(filters.wait_max);
    return fetchEmergencyAnalytics(params);
  }, [filters]);

  const { data, loading, error, reload } = useApi(fetchFn, [filters]);

  const kpis = data?.kpis || {};
  const charts = data?.charts || {};
  const opts = data?.filter_options || {};

  function setFilter(k, v) { setFilters(f => ({ ...f, [k]: v })); }
  function clearFilters() { setFilters({ department: '', gender: '', age_min: '', age_max: '', wait_min: '', wait_max: '' }); }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Emergency &amp; Patient Flow</h1>
        <p>ER wait times, admission trends, and department referral patterns — Hospital ER dataset (9,216 records). Patient flow time-of-day from separate patient_flow dataset (9,216 records). Datasets are analyzed separately to avoid double-counting.</p>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <div className="filter-label" style={{ marginBottom: 4 }}>Department</div>
            <select value={filters.department} onChange={e => setFilter('department', e.target.value)} style={{ height: 34, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }}>
              <option value="">All</option>
              {opts.departments?.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <div className="filter-label" style={{ marginBottom: 4 }}>Gender</div>
            <select value={filters.gender} onChange={e => setFilter('gender', e.target.value)} style={{ height: 34, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }}>
              <option value="">All</option>
              {opts.genders?.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          {[['age_min','Age Min','0',60],['age_max','Age Max','120',60],['wait_min','Wait Min','0',60],['wait_max','Wait Max','60',60]].map(([k,label,ph,w]) => (
            <div key={k}>
              <div className="filter-label" style={{ marginBottom: 4 }}>{label}</div>
              <input type="number" value={filters[k]} onChange={e => setFilter(k, e.target.value)} placeholder={ph}
                style={{ height: 34, width: w, padding: '0 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }} />
            </div>
          ))}
          <button className="btn btn-outline" onClick={clearFilters} style={{ height: 34, fontSize: 12 }}>Clear</button>
        </div>
      </div>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && (
        <>
          <div className="kpi-grid" style={{ marginBottom: 24 }}>
            <KpiCard icon={AlertTriangle} iconColor="red"   label="Total ER Records"    value={fmt(kpis.total_records, 0)} sub="Emergency dataset" />
            <KpiCard icon={Clock}         iconColor="amber" label="Avg Wait Time"       value={kpis.avg_wait_time != null ? `${fmt(kpis.avg_wait_time)} min` : 'N/A'} sub="Emergency dataset" />
            <KpiCard icon={Clock}         iconColor="blue"  label="Median Wait Time"    value={kpis.median_wait_time != null ? `${fmt(kpis.median_wait_time)} min` : 'N/A'} sub="Emergency dataset" />
            <KpiCard icon={Star}          iconColor="green" label="Avg Satisfaction"    value={kpis.avg_satisfaction != null ? fmt(kpis.avg_satisfaction) : 'N/A'} sub="0–10 scale (non-null)" />
            <KpiCard icon={Activity}      iconColor="teal"  label="Admitted"            value={fmt(kpis.admitted_count, 0)} sub="Admission flag = True" />
            <KpiCard icon={Activity}      iconColor="navy"  label="Not Admitted"        value={fmt(kpis.not_admitted_count, 0)} sub="Admission flag = False" />
          </div>

          <div className="grid-2 mb-20">
            {charts.wait_time_distribution?.length > 0 && (
              <ChartCard title="Wait Time Distribution" subtitle="Emergency dataset — patient count by wait bracket (minutes)">
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
            {charts.dept_avg_wait?.length > 0 && (
              <ChartCard title="Avg Wait Time by Department" subtitle="Emergency dataset — mean wait time (minutes)">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={charts.dept_avg_wait} layout="vertical" margin={{ top: 4, right: 16, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} unit=" min" />
                    <YAxis type="category" dataKey="department" tick={{ fontSize: 10 }} width={120} />
                    <Tooltip formatter={v => [`${v} min`, 'Avg Wait']} />
                    <Bar dataKey="avg_wait" fill="#3B82F6" radius={[0,3,3,0]} name="Avg Wait (min)" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>

          <div className="grid-2 mb-20">
            {charts.dept_record_count?.length > 0 && (
              <ChartCard title="Records by Department" subtitle="Emergency dataset — record count per department">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={charts.dept_record_count} layout="vertical" margin={{ top: 4, right: 16, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="department" tick={{ fontSize: 10 }} width={120} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#14B8A6" radius={[0,3,3,0]} name="Records" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
            {charts.satisfaction_distribution?.length > 0 && (
              <ChartCard title="Patient Satisfaction Distribution" subtitle="Emergency dataset — score 0–10 (6,699 missing values excluded)">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={charts.satisfaction_distribution} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="score" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8B5CF6" radius={[3,3,0,0]} name="Patients" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>

          <div className="grid-2 mb-20">
            {charts.age_distribution?.length > 0 && (
              <ChartCard title="Age Distribution" subtitle="Emergency dataset — patient count by age group">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={charts.age_distribution} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#14B8A6" radius={[3,3,0,0]} name="Patients" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
            {charts.admission_flag?.length > 0 && (
              <ChartCard title="Admission Flag Distribution" subtitle="Emergency dataset — True/False admission flag">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={charts.admission_flag} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={80} innerRadius={35}>
                      {charts.admission_flag.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v.toLocaleString(), n]} />
                    <Legend iconType="circle" iconSize={10} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>

          <div className="grid-2 mb-20">
            {charts.admission_volume_by_month?.length > 0 && (
              <ChartCard title="ER Admission Volume by Month" subtitle="Emergency dataset — record count per month">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={charts.admission_volume_by_month} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 9 }} interval={2} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#14B8A6" strokeWidth={2} dot={false} name="Records" />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
            {charts.admissions_by_hour?.length > 0 && (
              <ChartCard title="Admissions by Hour of Day" subtitle="Patient flow dataset — record count per hour (separate dataset)">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={charts.admissions_by_hour} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} label={{ value: 'Hour', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3B82F6" radius={[3,3,0,0]} name="Records" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>

          {charts.race_distribution?.length > 0 && (
            <ChartCard title="Race / Ethnicity Distribution" subtitle="Emergency dataset — record count by race" style={{ marginBottom: 20 }}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={charts.race_distribution} layout="vertical" margin={{ top: 4, right: 16, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={160} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#10B981" radius={[0,3,3,0]} name="Records" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </>
      )}
    </div>
  );
}
