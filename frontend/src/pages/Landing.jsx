import { useEffect, useRef, useState } from 'react';
import {
  Heart, ArrowRight, BarChart2, Brain, Activity, Database, Zap,
  Users, TrendingUp, Monitor, Search, Briefcase, ChevronRight,
  CheckCircle, AlertCircle, Clock, Layers,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { fetchDashboardAnalytics, fetchModelStatus, fetchProjectStats } from '../services/api';

// ── Feature definitions (no Model Evaluation) ────────────────────────────────
const FEATURES = [
  {
    id: 'dashboard',
    icon: BarChart2,
    title: 'Dashboard Overview',
    desc: 'Platform-wide KPIs, admissions trends, ER wait-time distribution, and dataset status at a glance.',
  },
  {
    id: 'command-center',
    icon: Monitor,
    title: 'Hospital Command Center',
    desc: 'Unified operational intelligence combining dataset health, model status, and key performance indicators.',
  },
  {
    id: 'patients',
    icon: Users,
    title: 'Patient Analytics',
    desc: 'Demographic breakdowns, condition distributions, billing analysis, and admission trends from 55,500 records.',
  },
  {
    id: 'emergency',
    icon: Activity,
    title: 'Emergency & Patient Flow',
    desc: 'ER wait times, department referral patterns, satisfaction scores, and hourly admission volumes.',
  },
  {
    id: 'operational',
    icon: Layers,
    title: 'Operational Efficiency',
    desc: 'Service-level staffing, bed occupancy, average length of stay, and satisfaction metrics by department.',
  },
  {
    id: 'predictive',
    icon: TrendingUp,
    title: 'Predictive Analytics',
    desc: 'ARIMA(1,1,1) 30-day admissions forecast and experimental XGBoost / Random Forest staffing predictions.',
  },
  {
    id: 'anomalies',
    icon: Search,
    title: 'Anomaly Detection',
    desc: 'IQR and Z-score detection across ER wait times, staffing discrepancies, and data-quality issues.',
  },
  {
    id: 'ai-assistant',
    icon: Zap,
    title: 'AI Data Assistant',
    desc: 'Ask plain-language questions about the datasets and receive answers backed by real analytics results.',
  },
  {
    id: 'workforce-simulator',
    icon: Briefcase,
    title: 'Workforce Simulator',
    desc: 'What-if staffing scenario analysis using the trained XGBoost and Random Forest classification models.',
  },
  {
    id: 'explorer',
    icon: Database,
    title: 'Data Explorer & Reports',
    desc: 'Browse, filter, and export all four healthcare datasets. Download model metrics and forecast CSVs.',
  },
];

const HOW_STEPS = [
  {
    num: '01',
    icon: Database,
    title: 'Explore the Datasets',
    desc: 'Browse four real healthcare CSV datasets covering patient records, ER visits, hospital insights, and patient flow.',
  },
  {
    num: '02',
    icon: BarChart2,
    title: 'Analyse Operational Patterns',
    desc: 'Use interactive analytics pages to surface trends in admissions, wait times, staffing, and occupancy.',
  },
  {
    num: '03',
    icon: Brain,
    title: 'Compare Forecasts & Predictions',
    desc: 'Run ARIMA admissions forecasts and experimental staffing predictions, then evaluate model outputs side by side.',
  },
];

const TECH = ['React 19', 'Vite', 'FastAPI', 'XGBoost', 'Random Forest', 'ARIMA(1,1,1)', 'Recharts', 'Python'];

// ── Tiny skeleton block ───────────────────────────────────────────────────────
function Skeleton({ w = '100%', h = 14, r = 4, style = {} }) {
  return (
    <div
      style={{
        width: w, height: h, borderRadius: r,
        background: 'rgba(255,255,255,0.08)',
        animation: 'lp-pulse 1.6s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

// ── Live dashboard preview panel ──────────────────────────────────────────────
function DashboardPreview() {
  const [analytics, setAnalytics] = useState(null);
  const [models, setModels] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchDashboardAnalytics(), fetchModelStatus(), fetchProjectStats()])
      .then(([a, m, s]) => {
        if (cancelled) return;
        if (!a && !m && !s) { setFailed(true); }
        else { setAnalytics(a); setModels(m); setStats(s); }
        setLoading(false);
      })
      .catch(() => { if (!cancelled) { setFailed(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  const kpis = analytics?.kpis || {};
  const trend = (analytics?.charts?.admissions_trend || []).slice(-12);
  const datasets = stats?.datasets || [];
  const modelList = models ? [
    { name: 'XGBoost', key: 'xgboost', ok: models.xgboost?.loaded },
    { name: 'Random Forest', key: 'random_forest', ok: models.random_forest?.loaded },
    { name: 'ARIMA', key: 'arima', ok: models.arima?.loaded },
  ] : [];

  return (
    <div className="lp-preview">
      <div className="lp-preview-bar">
        <span className="lp-preview-dot" style={{ background: '#EF4444' }} />
        <span className="lp-preview-dot" style={{ background: '#F59E0B' }} />
        <span className="lp-preview-dot" style={{ background: '#10B981' }} />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginLeft: 8 }}>
          PulseNova — Live Preview
        </span>
      </div>

      <div className="lp-preview-body">
        {failed ? (
          <div className="lp-preview-offline">
            <AlertCircle size={20} style={{ color: 'rgba(255,255,255,0.3)' }} />
            <span>Backend offline — start FastAPI to see live data</span>
          </div>
        ) : (
          <>
            {/* Dataset status row */}
            <div className="lp-preview-section-label">Datasets</div>
            <div className="lp-preview-ds-row">
              {loading
                ? [1,2,3,4].map(i => <Skeleton key={i} h={28} r={6} style={{ flex: 1 }} />)
                : datasets.map(ds => (
                  <div key={ds.key} className="lp-preview-ds-chip">
                    {ds.loaded
                      ? <CheckCircle size={10} style={{ color: '#10B981', flexShrink: 0 }} />
                      : <AlertCircle size={10} style={{ color: '#EF4444', flexShrink: 0 }} />}
                    <span>{ds.rows?.toLocaleString() ?? '—'}</span>
                  </div>
                ))
              }
            </div>

            {/* KPI row */}
            <div className="lp-preview-kpi-row">
              {[
                { label: 'Avg Wait', val: kpis.avg_wait_time != null ? `${kpis.avg_wait_time?.toFixed(1)} min` : null },
                { label: 'Avg Billing', val: kpis.avg_billing != null ? `$${Math.round(kpis.avg_billing).toLocaleString()}` : null },
                { label: 'Avg LOS', val: kpis.avg_los_days != null ? `${kpis.avg_los_days?.toFixed(1)}d` : null },
              ].map(({ label, val }) => (
                <div key={label} className="lp-preview-kpi">
                  <div className="lp-preview-kpi-val">
                    {loading ? <Skeleton w={60} h={18} /> : (val ?? '—')}
                  </div>
                  <div className="lp-preview-kpi-label">{label}</div>
                </div>
              ))}
            </div>

            {/* Admissions trend mini-chart */}
            <div className="lp-preview-section-label" style={{ marginTop: 10 }}>Monthly Admissions</div>
            {loading ? (
              <Skeleton h={70} r={6} style={{ marginTop: 4 }} />
            ) : trend.length > 0 ? (
              <div style={{ height: 70, marginTop: 4 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
                    <defs>
                      <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#14B8A6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#14B8A6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" hide />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ background: '#1e3d5c', border: 'none', borderRadius: 6, fontSize: 11, color: '#fff' }}
                      itemStyle={{ color: '#14B8A6' }}
                    />
                    <Area type="monotone" dataKey="admissions" stroke="#14B8A6" strokeWidth={2} fill="url(#tealGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>No trend data</span>
              </div>
            )}

            {/* Model status */}
            <div className="lp-preview-section-label" style={{ marginTop: 10 }}>ML Models</div>
            <div className="lp-preview-model-row">
              {loading
                ? [1,2,3].map(i => <Skeleton key={i} h={22} r={4} style={{ flex: 1 }} />)
                : modelList.map(m => (
                  <div key={m.key} className={`lp-preview-model-chip ${m.ok ? 'ok' : 'err'}`}>
                    {m.ok
                      ? <CheckCircle size={9} />
                      : <AlertCircle size={9} />}
                    {m.name}
                  </div>
                ))
              }
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main landing component ────────────────────────────────────────────────────
export default function Landing({ onEnter, onNavigate }) {
  const featuresRef = useRef(null);
  const aboutRef = useRef(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function scrollTo(ref) {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMobileMenuOpen(false);
  }

  function handleEnter() {
    onEnter?.();
  }

  return (
    <div className="lp-root">

      {/* ── NAV ── */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <div className="lp-nav-brand">
            <div className="brand-icon"><Heart size={15} /></div>
            <span className="lp-nav-brand-name">PulseNova</span>
          </div>

          <div className={`lp-nav-links${mobileMenuOpen ? ' open' : ''}`}>
            <button className="lp-nav-link" onClick={() => scrollTo(featuresRef)}>Platform Features</button>
            <button className="lp-nav-link" onClick={() => scrollTo(aboutRef)}>About</button>
            <button className="lp-nav-cta" onClick={handleEnter}>
              Open Dashboard <ChevronRight size={13} />
            </button>
          </div>

          <button
            className="lp-nav-hamburger"
            onClick={() => setMobileMenuOpen(o => !o)}
            aria-label="Toggle menu"
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="lp-hero">
        <div className="lp-hero-inner">
          {/* Left column */}
          <div className="lp-hero-left">
            <div className="lp-eyebrow">
              <Zap size={10} />
              Healthcare Intelligence Platform
            </div>

            <h1 className="lp-hero-h1">
              Transform Healthcare Data Into Smarter Decisions.
            </h1>

            <p className="lp-hero-desc">
              PulseNova brings healthcare analytics, patient-flow insights, operational
              intelligence, and predictive modelling together in one platform to help
              explore hospital performance and understand emerging patterns.
            </p>

            <div className="lp-hero-cta">
              <button className="lp-btn-primary" onClick={handleEnter}>
                Explore Dashboard <ArrowRight size={14} />
              </button>
              <button className="lp-btn-secondary" onClick={() => scrollTo(featuresRef)}>
                Explore Features
              </button>
            </div>

            <div className="lp-tech-row">
              {['React', 'FastAPI', 'XGBoost', 'ARIMA'].map(t => (
                <span key={t} className="lp-tech-chip">{t}</span>
              ))}
            </div>
          </div>

          {/* Right column — live preview */}
          <div className="lp-hero-right">
            <DashboardPreview />
          </div>
        </div>
      </section>

      {/* ── METRICS STRIP ── */}
      <div className="lp-metrics">
        {[
          { value: '55,500', label: 'Patient Records', sub: 'Healthcare dataset' },
          { value: '9,216',  label: 'ER Visits',       sub: 'Hospital ER dataset' },
          { value: '3',      label: 'ML Models',        sub: 'XGBoost · RF · ARIMA' },
          { value: '30-Day', label: 'Forecast Horizon', sub: 'ARIMA admissions' },
          { value: '4',      label: 'Datasets',         sub: 'Kaggle research data' },
        ].map(m => (
          <div key={m.label} className="lp-metric">
            <div className="lp-metric-value">{m.value}</div>
            <div className="lp-metric-label">{m.label}</div>
            <div className="lp-metric-sub">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* ── FEATURES ── */}
      <section className="lp-features" ref={featuresRef}>
        <div className="lp-section-inner">
          <div className="lp-section-header">
            <h2>Platform Capabilities</h2>
            <p>Nine integrated modules built on real healthcare datasets and trained ML models</p>
          </div>
          <div className="lp-features-grid">
            {FEATURES.map(f => (
              <button
                key={f.id}
                className="lp-feature-card"
                onClick={() => onEnter?.() || handleEnter()}
              >
                <div className="lp-feature-icon"><f.icon size={18} /></div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
                <span className="lp-feature-link">
                  Open <ChevronRight size={12} />
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="lp-how">
        <div className="lp-section-inner">
          <div className="lp-section-header">
            <h2>How PulseNova Works</h2>
            <p>A straightforward research workflow from raw data to analytical insight</p>
          </div>
          <div className="lp-how-grid">
            {HOW_STEPS.map((step, i) => (
              <div key={step.num} className="lp-how-card">
                <div className="lp-how-num">{step.num}</div>
                <div className="lp-how-icon"><step.icon size={20} /></div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
                {i < HOW_STEPS.length - 1 && <div className="lp-how-arrow"><ChevronRight size={16} /></div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section className="lp-about" ref={aboutRef}>
        <div className="lp-section-inner lp-about-inner">
          <div className="lp-about-text">
            <div className="lp-eyebrow lp-eyebrow-dark">
              <Heart size={10} /> About PulseNova
            </div>
            <h2>An Academic Healthcare Analytics Platform</h2>
            <p>
              PulseNova is a research-grade platform combining descriptive analytics,
              time-series forecasting, and experimental machine-learning models to explore
              patterns in publicly available healthcare datasets.
            </p>
            <p>
              It is designed for local research and exploratory analysis — not for clinical
              decision-making or live patient monitoring. All metrics are derived from static
              Kaggle CSV datasets.
            </p>
            <button className="lp-btn-primary lp-btn-dark" onClick={handleEnter}>
              Open the Platform <ArrowRight size={14} />
            </button>
          </div>
          <div className="lp-about-tech">
            <div className="lp-about-tech-title">Technology Stack</div>
            <div className="lp-about-tech-grid">
              {TECH.map(t => (
                <div key={t} className="lp-about-tech-chip">
                  <CheckCircle size={12} style={{ color: '#14B8A6', flexShrink: 0 }} />
                  {t}
                </div>
              ))}
            </div>
            <div className="lp-about-note">
              <Clock size={12} style={{ flexShrink: 0, marginTop: 1 }} />
              For research and exploratory analytics only. Not intended for clinical use.
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-brand">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div className="brand-icon" style={{ width: 28, height: 28 }}><Heart size={13} /></div>
              <span style={{ fontWeight: 700, color: '#fff', fontSize: 15 }}>PulseNova</span>
            </div>
            <p>Healthcare operational intelligence and predictive analytics research platform.</p>
            <p style={{ marginTop: 4 }}>For local research and exploratory analytics only.</p>
          </div>

          <div className="lp-footer-links">
            <div className="lp-footer-col">
              <div className="lp-footer-col-title">Analytics</div>
              {['Dashboard Overview', 'Patient Analytics', 'Emergency & Patient Flow', 'Operational Efficiency'].map(l => (
                <button key={l} className="lp-footer-link" onClick={handleEnter}>{l}</button>
              ))}
            </div>
            <div className="lp-footer-col">
              <div className="lp-footer-col-title">Intelligence</div>
              {['Command Center', 'Predictive Analytics', 'Anomaly Detection', 'AI Data Assistant', 'Workforce Simulator'].map(l => (
                <button key={l} className="lp-footer-link" onClick={handleEnter}>{l}</button>
              ))}
            </div>
            <div className="lp-footer-col">
              <div className="lp-footer-col-title">Data</div>
              {['Data Explorer & Reports', 'System & Project Info'].map(l => (
                <button key={l} className="lp-footer-link" onClick={handleEnter}>{l}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="lp-footer-bottom">
          <span>© {new Date().getFullYear()} PulseNova · Healthcare Intelligence Platform</span>
          <span>React · FastAPI · XGBoost · Random Forest · ARIMA(1,1,1)</span>
        </div>
      </footer>
    </div>
  );
}
