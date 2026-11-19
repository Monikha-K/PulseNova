import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function KpiCard({ icon: Icon, iconColor = 'teal', label, value, delta, deltaDir, sub }) {
  return (
    <div className="kpi-card">
      <div className="kpi-card-top">
        <div>
          <div className="kpi-label">{label}</div>
          <div className="kpi-value" style={{ marginTop: 6 }}>{value}</div>
        </div>
        {Icon && (
          <div className={`kpi-icon ${iconColor}`}>
            <Icon size={18} />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {delta !== undefined && (
          <span className={`kpi-delta ${deltaDir === 'up' ? 'up' : deltaDir === 'down' ? 'down' : 'neutral'}`}>
            {deltaDir === 'up' ? <TrendingUp size={10} /> : deltaDir === 'down' ? <TrendingDown size={10} /> : <Minus size={10} />}
            {delta}
          </span>
        )}
        {sub && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</span>}
      </div>
    </div>
  );
}
