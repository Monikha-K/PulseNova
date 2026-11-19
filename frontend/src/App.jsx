import { useState } from 'react';
import './index.css';
import Sidebar from './components/Sidebar';
import Topbar  from './components/Topbar';
import Landing              from './pages/Landing';
import Dashboard            from './pages/Dashboard';
import Patients             from './pages/Patients';
import Emergency            from './pages/Emergency';
import Operational          from './pages/Operational';
import Predictive           from './pages/Predictive';
import Evaluation           from './pages/Evaluation';
import Explorer             from './pages/Explorer';
import System               from './pages/System';
import CommandCenter        from './pages/CommandCenter';
import AnomalyDetection     from './pages/AnomalyDetection';
import WorkforceSimulator   from './pages/WorkforceSimulator';
import AIDataAssistant      from './pages/AIDataAssistant';

const PAGES = {
  dashboard:           Dashboard,
  patients:            Patients,
  emergency:           Emergency,
  operational:         Operational,
  predictive:          Predictive,
  evaluation:          Evaluation,
  explorer:            Explorer,
  system:              System,
  'command-center':    CommandCenter,
  anomalies:           AnomalyDetection,
  'workforce-simulator': WorkforceSimulator,
  'ai-assistant':      AIDataAssistant,
};

const PAGE_TITLES = {
  dashboard:           'Dashboard Overview',
  patients:            'Patient Analytics',
  emergency:           'Emergency & Patient Flow',
  operational:         'Operational Efficiency',
  predictive:          'Predictive Analytics',
  evaluation:          'Model Evaluation',
  explorer:            'Data Explorer & Reports',
  system:              'System & Project Info',
  'command-center':    'Hospital Command Center',
  anomalies:           'Anomaly Detection',
  'workforce-simulator': 'Workforce Planning Simulator',
  'ai-assistant':      'AI Data Assistant',
};

export default function App() {
  const [view,        setView]        = useState('landing');
  const [page,        setPage]        = useState('dashboard');
  const [collapsed,   setCollapsed]   = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);

  if (view === 'landing') {
    return <Landing onEnter={() => setView('app')} />;
  }

  const PageComponent = PAGES[page] || Dashboard;

  function navigate(id) { setPage(id); setMobileOpen(false); }

  return (
    <div className="app-layout">
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
      )}

      <Sidebar
        active={page}
        onNavigate={navigate}
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
        mobileOpen={mobileOpen}
      />

      <div className={`main-area${collapsed ? ' collapsed' : ''}`}>
        <Topbar page={page} pageTitles={PAGE_TITLES} onMenuClick={() => setMobileOpen(o => !o)} />
        <PageComponent onNavigate={navigate} />
      </div>
    </div>
  );
}
