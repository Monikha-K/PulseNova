import {
  LayoutDashboard, Users, AlertTriangle, Activity,
  Brain, Database, Info, ChevronLeft, ChevronRight,
  Heart, Monitor, Zap, Search, Briefcase,
} from 'lucide-react';

const NAV = [
  { id: 'dashboard',          label: 'Dashboard Overview',        icon: LayoutDashboard, section: 'ANALYTICS' },
  { id: 'command-center',     label: 'Command Center',            icon: Monitor },
  { id: 'patients',           label: 'Patient Analytics',         icon: Users },
  { id: 'emergency',          label: 'Emergency & Patient Flow',  icon: AlertTriangle },
  { id: 'operational',        label: 'Operational Efficiency',    icon: Activity },
  { id: 'predictive',         label: 'Predictive Analytics',      icon: Brain,           section: 'INTELLIGENCE' },
  { id: 'anomalies',          label: 'Anomaly Detection',         icon: Search },
  { id: 'ai-assistant',       label: 'AI Data Assistant',         icon: Zap },
  { id: 'workforce-simulator',label: 'Workforce Simulator',       icon: Briefcase,       section: 'PLANNING' },
  { id: 'explorer',           label: 'Data Explorer & Reports',   icon: Database,        section: 'DATA' },
  { id: 'system',             label: 'System & Project Info',     icon: Info },
];

export default function Sidebar({ active, onNavigate, collapsed, onToggle, mobileOpen }) {
  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
      <div className="sidebar-brand">
        <div className="brand-icon">
          <Heart size={16} />
        </div>
        {!collapsed && (
          <div className="brand-text">
            <div className="brand-name">PulseNova</div>
            <div className="brand-sub">Healthcare Intelligence</div>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        {NAV.map(item => (
          <div key={item.id}>
            {item.section && !collapsed && (
              <div className="nav-section-label">{item.section}</div>
            )}
            <div
              className={`nav-item${active === item.id ? ' active' : ''}`}
              onClick={() => onNavigate(item.id)}
              title={collapsed ? item.label : undefined}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && onNavigate(item.id)}
            >
              <item.icon size={16} />
              {!collapsed && <span className="nav-label">{item.label}</span>}
            </div>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        {!collapsed && (
          <div className="sidebar-footer-label">Healthcare Intelligence Platform</div>
        )}
        <button className="sidebar-toggle" onClick={onToggle} title="Toggle sidebar">
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </aside>
  );
}
