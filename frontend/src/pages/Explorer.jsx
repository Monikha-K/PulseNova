import { useState, useCallback } from 'react';
import { Database, Download, RefreshCw, Search } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ChartCard from '../components/ChartCard';
import { LoadingState, ErrorState, EmptyState } from '../components/common/States';
import { useApi } from '../hooks/useApi';
import { fetchDataset, fetchPreview, fetchSummary, getDatasetExportUrl } from '../services/api';

const DATASETS = [
  { key: 'healthcare',        label: 'Healthcare Dataset',        rows: 55500 },
  { key: 'emergency',         label: 'Hospital ER Data',          rows: 9216  },
  { key: 'hospital_insights', label: 'Hospital Insights Summary', rows: 208   },
  { key: 'patient_flow',      label: 'Patient Flow Data',         rows: 9216  },
];

const PAGE_SIZES = [10, 20, 50, 100];

export default function Explorer() {
  const [activeKey, setActiveKey]   = useState('healthcare');
  const [page, setPage]             = useState(0);
  const [pageSize, setPageSize]     = useState(20);
  const [search, setSearch]         = useState('');
  const [tab, setTab]               = useState('table'); // 'table' | 'summary'

  const metaFn   = useCallback(() => fetchDataset(activeKey), [activeKey]);
  const previewFn = useCallback(() => fetchPreview(activeKey, pageSize, page * pageSize), [activeKey, pageSize, page]);
  const summaryFn = useCallback(() => fetchSummary(activeKey), [activeKey]);

  const { data: meta,    loading: mLoading, error: mError }   = useApi(metaFn,    [activeKey]);
  const { data: preview, loading: pLoading, error: pError, reload: pReload } = useApi(previewFn, [activeKey, pageSize, page]);
  const { data: summary, loading: sLoading, error: sError }   = useApi(summaryFn, [activeKey]);

  function switchDataset(key) { setActiveKey(key); setPage(0); setSearch(''); }

  const records = preview?.records || [];
  const columns = preview?.columns || [];
  const totalRows = preview?.total_rows ?? meta?.rows ?? 0;
  const totalPages = Math.ceil(totalRows / pageSize);

  // Client-side search on current page
  const filtered = search
    ? records.filter(row => Object.values(row).some(v => String(v ?? '').toLowerCase().includes(search.toLowerCase())))
    : records;

  // Sanitise cell value for display (prevent formula injection)
  function safeCell(v) {
    if (v == null) return '';
    const s = String(v);
    return s.startsWith('=') || s.startsWith('+') || s.startsWith('-') || s.startsWith('@') ? `'${s}` : s;
  }

  const numericStats = summary?.numeric_stats || {};
  const catCounts    = summary?.categorical_counts || {};
  const missingCols  = summary?.missing_per_column || {};

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Data Explorer &amp; Reports</h1>
        <p>Browse all four datasets with pagination, search, and CSV export</p>
      </div>

      {/* Dataset selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {DATASETS.map(ds => (
          <button key={ds.key}
            className={`btn ${activeKey === ds.key ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => switchDataset(ds.key)}>
            <Database size={13} /> {ds.label}
          </button>
        ))}
      </div>

      {/* Metadata bar */}
      {meta && !mLoading && (
        <div className="card" style={{ padding: '14px 20px', marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
          <div><span className="filter-label">Rows</span><div style={{ fontWeight: 700, fontSize: 16 }}>{meta.rows?.toLocaleString()}</div></div>
          <div><span className="filter-label">Columns</span><div style={{ fontWeight: 700, fontSize: 16 }}>{meta.columns}</div></div>
          <div><span className="filter-label">Missing Values</span><div style={{ fontWeight: 700, fontSize: 16 }}>{meta.missing_values?.toLocaleString()}</div></div>
          <div><span className="filter-label">Duplicate Rows</span><div style={{ fontWeight: 700, fontSize: 16 }}>{meta.duplicate_rows?.toLocaleString()}</div></div>
          <div style={{ marginLeft: 'auto' }}>
            <a href={getDatasetExportUrl(activeKey)} download className="btn btn-outline" style={{ height: 32, fontSize: 12, textDecoration: 'none' }}>
              <Download size={13} /> Export CSV (up to 5,000 rows)
            </a>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {['table', 'summary'].map(t => (
          <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-outline'}`} style={{ height: 32, fontSize: 12 }} onClick={() => setTab(t)}>
            {t === 'table' ? 'Data Table' : 'Data Quality & Summary'}
          </button>
        ))}
      </div>

      {tab === 'table' && (
        <>
          {/* Controls */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', borderRadius: 6, padding: '0 10px', height: 34, background: 'var(--surface)' }}>
              <Search size={13} style={{ color: 'var(--text-muted)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search current page…"
                style={{ border: 'none', outline: 'none', fontSize: 13, fontFamily: 'inherit', width: 180 }} />
            </div>
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
              style={{ height: 34, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }}>
              {PAGE_SIZES.map(s => <option key={s} value={s}>{s} rows</option>)}
            </select>
            <button className="btn btn-outline" style={{ height: 34, fontSize: 12 }} onClick={pReload}>
              <RefreshCw size={13} /> Refresh
            </button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
              Page {page + 1} of {totalPages} ({totalRows.toLocaleString()} total rows)
            </span>
          </div>

          {pLoading && <LoadingState />}
          {!pLoading && pError && <ErrorState error={pError} onRetry={pReload} />}
          {!pLoading && !pError && filtered.length === 0 && <EmptyState message="No records match your search." />}

          {!pLoading && !pError && filtered.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="table-wrap" style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>{columns.map(c => <th key={c}>{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {filtered.map((row, i) => (
                      <tr key={i}>
                        {columns.map(c => <td key={c} style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{safeCell(row[c])}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
            <button className="btn btn-outline" style={{ height: 30, fontSize: 12 }} disabled={page === 0} onClick={() => setPage(0)}>«</button>
            <button className="btn btn-outline" style={{ height: 30, fontSize: 12 }} disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
            <span style={{ fontSize: 13, padding: '0 8px' }}>Page {page + 1} / {totalPages}</span>
            <button className="btn btn-outline" style={{ height: 30, fontSize: 12 }} disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next ›</button>
            <button className="btn btn-outline" style={{ height: 30, fontSize: 12 }} disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>»</button>
          </div>
        </>
      )}

      {tab === 'summary' && (
        <>
          {sLoading && <LoadingState />}
          {!sLoading && sError && <ErrorState error={sError} />}

          {!sLoading && !sError && summary && (
            <>
              {/* Missing values */}
              {Object.keys(missingCols).length > 0 && (
                <ChartCard title="Missing Values by Column" subtitle="Columns with at least one missing value" style={{ marginBottom: 20 }}>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Column</th><th>Missing Count</th><th>% of Rows</th></tr></thead>
                      <tbody>
                        {Object.entries(missingCols).map(([col, cnt]) => (
                          <tr key={col}>
                            <td>{col}</td>
                            <td>{cnt.toLocaleString()}</td>
                            <td>{summary.rows ? `${((cnt / summary.rows) * 100).toFixed(1)}%` : 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ChartCard>
              )}

              {/* Numeric stats */}
              {Object.keys(numericStats).length > 0 && (
                <ChartCard title="Numeric Column Statistics" subtitle="Descriptive statistics for numeric columns" style={{ marginBottom: 20 }}>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Column</th><th>Count</th><th>Mean</th><th>Std</th><th>Min</th><th>25%</th><th>50%</th><th>75%</th><th>Max</th></tr></thead>
                      <tbody>
                        {Object.entries(numericStats).map(([col, stats]) => (
                          <tr key={col}>
                            <td style={{ fontWeight: 500 }}>{col}</td>
                            {['count','mean','std','min','25%','50%','75%','max'].map(s => (
                              <td key={s} style={{ fontSize: 12 }}>{stats[s] != null ? Number(stats[s]).toFixed(2) : 'N/A'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ChartCard>
              )}

              {/* Categorical distributions */}
              {Object.keys(catCounts).length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginBottom: 20 }}>
                  {Object.entries(catCounts).slice(0, 6).map(([col, counts]) => {
                    const chartData = Object.entries(counts).map(([k, v]) => ({ label: k, value: v }));
                    return (
                      <ChartCard key={col} title={col} subtitle={`Top ${chartData.length} categories`}>
                        <ResponsiveContainer width="100%" height={160}>
                          <BarChart data={chartData} layout="vertical" margin={{ top: 2, right: 12, left: 8, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                            <XAxis type="number" tick={{ fontSize: 10 }} />
                            <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={100} />
                            <Tooltip />
                            <Bar dataKey="value" fill="#14B8A6" radius={[0,3,3,0]} name="Count" />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartCard>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
