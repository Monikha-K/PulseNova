import { useState, useCallback } from 'react';
import { Users, Clock, DollarSign, Activity } from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import KpiCard from '../components/KpiCard';
import ChartCard from '../components/ChartCard';
import { LoadingState, ErrorState, EmptyState } from '../components/common/States';
import { useApi } from '../hooks/useApi';
import { fetchPatientAnalytics } from '../services/api';

const COLORS = ['#14B8A6','#3B82F6','#F59E0B','#EF4444','#8B5CF6','#10B981','#64748B'];

function fmt(v, d = 1) {
  if (v == null) return 'N/A';
  return typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: d }) : v;
}

export default function Patients() {
  const [filters, setFilters] = useState({ gender: '', admission_type: '', medical_condition: '', age_min: '', age_max: '' });

  const fetchFn = useCallback(() => {
    const params = {};
    if (filters.gender) params.gender = filters.gender;
    if (filters.admission_type) params.admission_type = filters.admission_type;
    if (filters.medical_condition) params.medical_condition = filters.medical_condition;
    if (filters.age_min) params.age_min = parseInt(filters.age_min);
    if (filters.age_max) params.age_max = parseInt(filters.age_max);
    return fetchPatientAnalytics(params);
  }, [filters]);

  const { data, loading, error, reload } = useApi(fetchFn, [filters]);

  const kpis = data?.kpis || {};
  const charts = data?.charts || {};
  const opts = data?.filter_options || {};

  function setFilter(k, v) { setFilters(f => ({ ...f, [k]: v })); }
  function clearFilters() { setFilters({ gender: '', admission_type: '', medical_condition: '', age_min: '', age_max: '' }); }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Patient Analytics</h1>
        <p>Demographic breakdown and clinical analysis from the healthcare dataset (55,500 records)</p>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <div className="filter-label" style={{ marginBottom: 4 }}>Gender</div>
            <select value={filters.gender} onChange={e => setFilter('gender', e.target.value)} style={{ height: 34, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }}>
              <option value="">All</option>
              {opts.genders?.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <div className="filter-label" style={{ marginBottom: 4 }}>Admission Type</div>
            <select value={filters.admission_type} onChange={e => setFilter('admission_type', e.target.value)} style={{ height: 34, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }}>
              <option value="">All</option>
              {opts.admission_types?.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <div className="filter-label" style={{ marginBottom: 4 }}>Medical Condition</div>
            <select value={filters.medical_condition} onChange={e => setFilter('medical_condition', e.target.value)} style={{ height: 34, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }}>
              <option value="">All</option>
              {opts.medical_conditions?.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div className="filter-label" style={{ marginBottom: 4 }}>Age Min</div>
            <input type="number" value={filters.age_min} onChange={e => setFilter('age_min', e.target.value)} placeholder="0" style={{ height: 34, width: 70, padding: '0 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }} />
          </div>
          <div>
            <div className="filter-label" style={{ marginBottom: 4 }}>Age Max</div>
            <input type="number" value={filters.age_max} onChange={e => setFilter('age_max', e.target.value)} placeholder="120" style={{ height: 34, width: 70, padding: '0 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }} />
          </div>
          <button className="btn btn-outline" onClick={clearFilters} style={{ height: 34, fontSize: 12 }}>Clear</button>
        </div>
      </div>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && (
        <>
          <div className="kpi-grid" style={{ marginBottom: 24 }}>
            <KpiCard icon={Users}      iconColor="teal"  label="Total Records"      value={fmt(kpis.total_records, 0)} sub="Healthcare dataset" />
            <KpiCard icon={Activity}   iconColor="blue"  label="Average Age"        value={kpis.avg_age != null ? `${fmt(kpis.avg_age)} yrs` : 'N/A'} sub="Healthcare dataset" />
            <KpiCard icon={DollarSign} iconColor="amber" label="Avg Billing Amount" value={kpis.avg_billing != null ? `$${fmt(kpis.avg_billing, 0)}` : 'N/A'} sub="Billing units" />
            <KpiCard icon={Clock}      iconColor="green" label="Avg Length of Stay" value={kpis.avg_los_days != null ? `${fmt(kpis.avg_los_days)} days` : 'N/A'} sub="Admission to discharge" />
            <KpiCard icon={Users}      iconColor="navy"  label="Top Condition"      value={kpis.top_condition || 'N/A'} sub="Most frequent" />
          </div>

          <div className="grid-2 mb-20">
            {charts.age_groups?.length > 0 && (
              <ChartCard title="Age Group Distribution" subtitle="Patient count by age bracket">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={charts.age_groups} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#14B8A6" radius={[3,3,0,0]} name="Patients" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
            {charts.gender?.length > 0 && (
              <ChartCard title="Gender Distribution" subtitle="Healthcare dataset">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={charts.gender} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={85} innerRadius={40}>
                      {charts.gender.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v.toLocaleString(), n]} />
                    <Legend iconType="circle" iconSize={10} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>

          <div className="grid-2 mb-20">
            {charts.medical_conditions?.length > 0 && (
              <ChartCard title="Medical Condition Distribution" subtitle="Top conditions by record count">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={charts.medical_conditions} layout="vertical" margin={{ top: 4, right: 16, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={90} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3B82F6" radius={[0,3,3,0]} name="Records" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
            {charts.admission_types?.length > 0 && (
              <ChartCard title="Admission Type Distribution" subtitle="Healthcare dataset">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={charts.admission_types} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={85} innerRadius={40}>
                      {charts.admission_types.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v.toLocaleString(), n]} />
                    <Legend iconType="circle" iconSize={10} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>

          <div className="grid-2 mb-20">
            {charts.test_results?.length > 0 && (
              <ChartCard title="Test Result Distribution" subtitle="Healthcare dataset">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={charts.test_results} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={80} innerRadius={35}>
                      {charts.test_results.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v.toLocaleString(), n]} />
                    <Legend iconType="circle" iconSize={10} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
            {charts.medications?.length > 0 && (
              <ChartCard title="Medication Distribution" subtitle="Top medications by record count">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={charts.medications} layout="vertical" margin={{ top: 4, right: 16, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={90} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8B5CF6" radius={[0,3,3,0]} name="Records" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>

          <div className="grid-2 mb-20">
            {charts.billing_by_condition?.length > 0 && (
              <ChartCard title="Avg Billing by Medical Condition" subtitle="Mean billing amount per condition (billing units)">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={charts.billing_by_condition} layout="vertical" margin={{ top: 4, right: 16, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="condition" tick={{ fontSize: 11 }} width={90} />
                    <Tooltip formatter={v => [`$${v.toLocaleString()}`, 'Avg Billing']} />
                    <Bar dataKey="avg_billing" fill="#F59E0B" radius={[0,3,3,0]} name="Avg Billing" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
            {charts.insurance_providers?.length > 0 && (
              <ChartCard title="Insurance Provider Distribution" subtitle="Healthcare dataset">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={charts.insurance_providers} layout="vertical" margin={{ top: 4, right: 16, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={100} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#10B981" radius={[0,3,3,0]} name="Records" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>

          {charts.admission_trend?.length > 0 && (
            <ChartCard title="Admission Trend by Month" subtitle="Healthcare dataset — monthly record count" style={{ marginBottom: 20 }}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={charts.admission_trend} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 9 }} interval={3} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="admissions" stroke="#14B8A6" strokeWidth={2} dot={false} name="Admissions" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </>
      )}
    </div>
  );
}
