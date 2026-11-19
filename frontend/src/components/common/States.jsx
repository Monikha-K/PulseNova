import { RefreshCw, AlertCircle, Database } from 'lucide-react';

export function LoadingState({ message = 'Loading data…' }) {
  return (
    <div className="state-box">
      <RefreshCw size={28} style={{ color: 'var(--teal)', animation: 'spin 1s linear infinite' }} />
      <p>{message}</p>
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="info-box warning" style={{ margin: '24px 0' }}>
      <AlertCircle size={16} className="info-box-icon" />
      <div className="info-box-text">
        <div className="info-box-title">Could not load data</div>
        {error}
        {onRetry && (
          <button className="btn btn-outline" style={{ marginTop: 8, height: 28, fontSize: 12 }} onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ message = 'No data available.' }) {
  return (
    <div className="state-box">
      <Database size={28} />
      <p>{message}</p>
    </div>
  );
}
