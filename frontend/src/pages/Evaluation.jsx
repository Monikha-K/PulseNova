import { AlertCircle, CheckCircle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import ChartCard from '../components/ChartCard';
import KpiCard from '../components/KpiCard';
import { LoadingState, ErrorState } from '../components/common/States';
import { useApi } from '../hooks/useApi';
import { fetchModelEvaluation, fetchFeatureImportance } from '../services/api';

function ConfusionMatrix({ cm, title }) {
  if (!cm) return null;
  const { labels, matrix, total } = cm;
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{title}</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ padding: '6px 10px', background: '#f8fafc', border: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>Actual \ Predicted</th>
              {labels.map(l => <th key={l} style={{ padding: '6px 10px', background: '#f8fafc', border: '1px solid var(--border)', fontSize: 11 }}>Pred {l}</th>)}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={i}>
                <td style={{ padding: '6px 10px', border: '1px solid var(--border)', fontWeight: 600, fontSize: 11, background: '#f8fafc' }}>Actual {labels[i]}</td>
                {row.map((cell, j) => (
                  <td key={j} style={{
                    padding: '12px 16px', border: '1px solid var(--border)', textAlign: 'center',
                    fontWeight: 700, fontSize: 18,
                    background: i === j ? '#f0fdf4' : '#fee2e2',
                    color: i === j ? '#065f46' : '#991b1b',
                  }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Total samples: {total}</div>
    </div>
  );
}

export default function Evaluation() {
  const { data: evalData, loading: eLoading, error: eError } = useApi(fetchModelEvaluation);
  const { data: fiData, loading: fLoading, error: fError } = useApi(fetchFeatureImportance);

  const loading = eLoading || fLoading;
  const error = eError || fError;

  const cls = evalData?.classification || {};
  const arima = evalData?.arima || {};
  const xgbMetrics = cls.xgboost_metrics?.[0] || {};
  const rfMetrics = cls.rf_metrics?.[0] || {};
  const arimaMetrics = arima.metrics?.[0] || {};

  const xgbFI = fiData?.xgboost_feature_importance || [];
  const rfFI = fiData?.rf_feature_importance || [];

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Model Evaluation</h1>
        <p>Verified metrics from saved result CSV files — XGBoost, Random Forest, and ARIMA(1,1,1)</p>
      </div>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState error={error} />}

      {!loading && !error && (
        <>
          {/* Limitation notice */}
          {cls.limitation_notice && (
            <div className="info-box warning" style={{ marginBottom: 20 }}>
              <AlertCircle size={15} className="info-box-icon" />
              <div className="info-box-text">
                <div className="info-box-title">Methodological Limitation</div>
                {cls.limitation_notice}
              </div>
            </div>
          )}

          {/* Classification KPIs */}
          <div className="kpi-grid" style={{ marginBottom: 24 }}>
            <KpiCard iconColor="green"  label="XGBoost Accuracy"    value={xgbMetrics.Accuracy != null ? `${(xgbMetrics.Accuracy * 100).toFixed(2)}%` : 'N/A'} sub="Staff level classification" />
            <KpiCard iconColor="teal"   label="XGBoost F1-Score"    value={xgbMetrics.F1_Score != null ? xgbMetrics.F1_Score.toFixed(4) : 'N/A'} sub="Weighted" />
            <KpiCard iconColor="blue"   label="RF Accuracy"         value={rfMetrics.Accuracy != null ? `${(rfMetrics.Accuracy * 100).toFixed(2)}%` : 'N/A'} sub="Staff level classification" />
            <KpiCard iconColor="purple" label="RF F1-Score"         value={rfMetrics.F1_Score != null ? rfMetrics.F1_Score.toFixed(4) : 'N/A'} sub="Weighted" />
            <KpiCard iconColor="amber"  label="ARIMA MAE"           value={arimaMetrics.MAE != null ? arimaMetrics.MAE.toFixed(4) : 'N/A'} sub="Daily admissions" />
            <KpiCard iconColor="navy"   label="ARIMA RMSE"          value={arimaMetrics.RMSE != null ? arimaMetrics.RMSE.toFixed(4) : 'N/A'} sub="Daily admissions" />
            <KpiCard iconColor="teal"   label="Evaluation Samples"  value={cls.evaluation_sample_count ?? 'N/A'} sub="Test split (staffing)" />
          </div>

          {/* Classification metrics table */}
          <ChartCard title="Classification Metrics — Staffing Level Prediction" subtitle="Source: xgboost_staff_metrics.csv, random_forest_staff_metrics.csv, final_ml_comparison.csv" style={{ marginBottom: 20 }}>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Model</th><th>Target</th><th>Accuracy</th><th>Precision</th><th>Recall</th><th>F1-Score</th></tr></thead>
                <tbody>
                  {[xgbMetrics, rfMetrics].filter(m => m.Model).map(m => (
                    <tr key={m.Model}>
                      <td><span className="badge badge-teal">{m.Model}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.Target}</td>
                      <td>{m.Accuracy != null ? `${(m.Accuracy * 100).toFixed(2)}%` : 'N/A'}</td>
                      <td>{m.Precision != null ? `${(m.Precision * 100).toFixed(2)}%` : 'N/A'}</td>
                      <td>{m.Recall != null ? `${(m.Recall * 100).toFixed(2)}%` : 'N/A'}</td>
                      <td><strong>{m.F1_Score != null ? m.F1_Score.toFixed(4) : 'N/A'}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>

          {/* Confusion matrices */}
          <div className="grid-2 mb-20">
            <ChartCard title="XGBoost Confusion Matrix" subtitle="42 test samples — staff level 1 vs 2">
              <ConfusionMatrix cm={cls.xgboost_confusion_matrix} title="XGBoost — Actual vs Predicted" />
            </ChartCard>
            <ChartCard title="Random Forest Confusion Matrix" subtitle="42 test samples — staff level 1 vs 2">
              <ConfusionMatrix cm={cls.rf_confusion_matrix} title="Random Forest — Actual vs Predicted" />
            </ChartCard>
          </div>

          {/* Feature importance */}
          <div className="grid-2 mb-20">
            {xgbFI.length > 0 && (
              <ChartCard title="XGBoost Feature Importance" subtitle="Source: xgboost_feature_importance.csv — sorted by importance">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={xgbFI} layout="vertical" margin={{ top: 4, right: 16, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" domain={[0, 0.8]} tickFormatter={v => `${(v*100).toFixed(0)}%`} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="Feature" tick={{ fontSize: 9 }} width={170} />
                    <Tooltip formatter={v => [`${(v*100).toFixed(2)}%`, 'Importance']} />
                    <Bar dataKey="Importance" fill="#14B8A6" radius={[0,3,3,0]} name="Importance" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="info-box note" style={{ marginTop: 12 }}>
                  <AlertCircle size={13} className="info-box-icon" />
                  <div className="info-box-text" style={{ fontSize: 11 }}>Feature importance indicates which inputs most influenced the model's decisions. It does not establish causal relationships.</div>
                </div>
              </ChartCard>
            )}
            {rfFI.length > 0 && (
              <ChartCard title="Random Forest Feature Importance" subtitle="Computed from loaded model — sorted by importance">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={rfFI} layout="vertical" margin={{ top: 4, right: 16, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" domain={[0, 0.8]} tickFormatter={v => `${(v*100).toFixed(0)}%`} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="Feature" tick={{ fontSize: 9 }} width={170} />
                    <Tooltip formatter={v => [`${(v*100).toFixed(2)}%`, 'Importance']} />
                    <Bar dataKey="Importance" fill="#3B82F6" radius={[0,3,3,0]} name="Importance" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>

          {/* ARIMA metrics */}
          <ChartCard title="ARIMA(1,1,1) Evaluation Metrics" subtitle="Source: arima_metrics.csv — daily patient admissions forecasting" style={{ marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
              {[
                { label: 'Model', value: arimaMetrics.Model || 'ARIMA(1,1,1)' },
                { label: 'Target', value: arimaMetrics.Target || 'Daily Patient Admissions' },
                { label: 'MAE', value: arimaMetrics.MAE?.toFixed(6) ?? 'N/A' },
                { label: 'MSE', value: arimaMetrics.MSE?.toFixed(6) ?? 'N/A' },
                { label: 'RMSE', value: arimaMetrics.RMSE?.toFixed(6) ?? 'N/A' },
                { label: 'Forecast Horizon', value: '30 days' },
              ].map(m => (
                <div key={m.label} style={{ padding: '12px 14px', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{m.value}</div>
                </div>
              ))}
            </div>
          </ChartCard>

          {/* Actual vs predicted staffing table */}
          {cls.xgboost_predictions?.length > 0 && (
            <ChartCard title="XGBoost — Actual vs Predicted Staff Level" subtitle="42 test samples from xgboost_staff_predictions.csv">
              <div className="table-wrap" style={{ maxHeight: 300, overflowY: 'auto' }}>
                <table>
                  <thead><tr><th>#</th><th>Actual Staff Level</th><th>Predicted Staff Level</th><th>Match</th></tr></thead>
                  <tbody>
                    {cls.xgboost_predictions.map((r, i) => (
                      <tr key={i}>
                        <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td>{r['Actual Staff Level']}</td>
                        <td>{r['Predicted Staff Level']}</td>
                        <td>
                          {r['Actual Staff Level'] === r['Predicted Staff Level']
                            ? <span className="badge badge-green"><CheckCircle size={10} /> Correct</span>
                            : <span className="badge badge-red">Incorrect</span>}
                        </td>
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
