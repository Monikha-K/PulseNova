import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { fetchHealth } from '../services/api';

const PAGE_TITLES = {
  dashboard:              { title: 'Dashboard Overview',          sub: 'Platform summary and dataset status' },
  patients:               { title: 'Patient Analytics',           sub: 'Demographics and satisfaction analysis' },
  emergency:              { title: 'Emergency & Patient Flow',    sub: 'ER wait times and admission trends' },
  operational:            { title: 'Operational Efficiency',      sub: 'Staffing levels and occupancy metrics' },
  predictive:             { title: 'Predictive Analytics',        sub: 'ARIMA time-series forecasting' },
  evaluation:             { title: 'Model Evaluation',            sub: 'XGBoost, Random Forest & ARIMA metrics' },
  explorer:               { title: 'Data Explorer & Reports',     sub: 'Browse result CSV files' },
  system:                 { title: 'System & Project Info',       sub: 'Architecture and technology stack' },
  'command-center':       { title: 'Hospital Command Center',     sub: 'Unified operations intelligence' },
  anomalies:              { title: 'Anomaly Detection',           sub: 'Statistical and data-quality flags' },
  'workforce-simulator':  { title: 'Workforce Planning Simulator',sub: 'What-if staffing scenario analysis' },
  'ai-assistant':         { title: 'AI Data Assistant',           sub: 'Ask questions about your data' },
};

const STATUS = { connecting: 'connecting', connected: 'connected', disconnected: 'disconnected' };

const STATUS_STYLES = {
  connecting:   { bg: '#fef3c7', color: '#92400e', dot: '#F59E0B', label: 'Connecting' },
  connected:    { bg: '#d1fae5', color: '#065f46', dot: '#10B981', label: 'API Connected' },
  disconnected: { bg: '#fee2e2', color: '#991b1b', dot: '#EF4444', label: 'API Offline' },
};

export default function Topbar({ page, onMenuClick }) {
  const [apiStatus, setApiStatus] = useState(STATUS.connecting);
  const meta = PAGE_TITLES[page] || { title: 'PulseNova', sub: '' };

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (cancelled) return;
      setApiStatus(STATUS.connecting);
      const result = await fetchHealth();
      if (!cancelled) {
        setApiStatus(result.ok ? STATUS.connected : STATUS.disconnected);
      }
    }

    check();
    const interval = setInterval(check, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const s = STATUS_STYLES[apiStatus];

  return (
    <header className="topbar">
      <div className="topbar-left">
        {onMenuClick && (
          <button className="btn btn-ghost topbar-menu-btn" onClick={onMenuClick} title="Toggle sidebar">
            <Menu size={18} />
          </button>
        )}
        <div>
          <div className="topbar-title">{meta.title}</div>
          {meta.sub && <div className="topbar-breadcrumb">{meta.sub}</div>}
        </div>
      </div>
      <div className="topbar-right">
        <div
          className="topbar-badge"
          style={{ background: s.bg, color: s.color }}
          title={apiStatus === STATUS.disconnected ? 'Backend not reachable — start FastAPI on port 8000' : ''}
        >
          <span
            className="dot"
            style={{
              background: s.dot,
              animation: apiStatus === STATUS.connecting ? 'pulse 1.2s infinite' : 'none',
            }}
          />
          {s.label}
        </div>
      </div>
    </header>
  );
}
