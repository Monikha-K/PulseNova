import axios from 'axios';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';

const api = axios.create({ baseURL: BASE, timeout: 30000 });

async function get(url, params = {}) {
  try {
    const res = await api.get(url, { params });
    return { ok: true, data: res.data };
  } catch (e) {
    return { ok: false, error: e?.response?.data?.detail || e.message || 'Request failed' };
  }
}

async function post(url, body = {}) {
  try {
    const res = await api.post(url, body);
    return { ok: true, data: res.data };
  } catch (e) {
    return { ok: false, error: e?.response?.data?.detail || e.message || 'Request failed' };
  }
}

export async function fetchHealth() {
  return get('/health');
}

export async function fetchProjectStats() {
  const r = await get('/stats/summary');
  return r.ok ? r.data : null;
}

export async function fetchDatasets() {
  const r = await get('/datasets');
  return r.ok ? r.data : null;
}

export async function fetchDataset(key) {
  const r = await get(`/datasets/${key}`);
  return r.ok ? r.data : null;
}

export async function fetchPreview(key, limit = 20, offset = 0) {
  const r = await get(`/datasets/${key}/preview`, { limit, offset });
  return r.ok ? r.data : null;
}

export async function fetchSummary(key) {
  const r = await get(`/datasets/${key}/summary`);
  return r.ok ? r.data : null;
}

export function getDatasetExportUrl(key) {
  return `${BASE}/datasets/${key}/export`;
}

export async function fetchDashboardAnalytics() {
  const r = await get('/analytics/dashboard');
  return r.ok ? r.data : null;
}

export async function fetchPatientAnalytics(params = {}) {
  const r = await get('/analytics/patients', params);
  return r.ok ? r.data : null;
}

export async function fetchEmergencyAnalytics(params = {}) {
  const r = await get('/analytics/emergency-flow', params);
  return r.ok ? r.data : null;
}

export async function fetchOperationsAnalytics(params = {}) {
  const r = await get('/analytics/operations', params);
  return r.ok ? r.data : null;
}

export async function fetchModelStatus() {
  const r = await get('/models/status');
  return r.ok ? r.data : null;
}

export async function predictXGBoost(payload) {
  return post('/predictions/staffing/xgboost', payload);
}

export async function predictRandomForest(payload) {
  return post('/predictions/staffing/random-forest', payload);
}

export async function predictCompare(payload) {
  return post('/predictions/staffing/compare', payload);
}

export async function fetchAdmissionForecast(horizon = 30) {
  const r = await get('/predictions/admissions-forecast', { horizon });
  return r.ok ? r.data : null;
}

export async function fetchModelEvaluation() {
  const r = await get('/models/evaluation');
  return r.ok ? r.data : null;
}

export async function fetchFeatureImportance() {
  const r = await get('/models/feature-importance');
  return r.ok ? r.data : null;
}

export async function fetchDashboardSummary() {
  const r = await get('/reports/dashboard-summary');
  return r.ok ? r.data : null;
}

export function getModelMetricsExportUrl() {
  return `${BASE}/reports/model-metrics/export`;
}

export function getForecastExportUrl() {
  return `${BASE}/reports/admissions-forecast/export`;
}

export function getDashboardSummaryExportUrl() {
  return `${BASE}/reports/dashboard-summary/export`;
}

// ── Command Center ────────────────────────────────────────────────────────────
export async function fetchCommandCenter() {
  const r = await get('/analytics/command-center');
  return r.ok ? r.data : null;
}

// ── Anomaly Detection ─────────────────────────────────────────────────────────
export async function fetchAnomalySummary() {
  const r = await get('/anomalies/summary');
  return r.ok ? r.data : null;
}

export async function fetchAnomalies(params = {}) {
  const r = await get('/anomalies', params);
  return r.ok ? r.data : null;
}

export async function detectAnomalies(config = {}) {
  return post('/anomalies/detect', config);
}

// ── Workforce Simulator ───────────────────────────────────────────────────────
export async function fetchSimulatorOptions() {
  const r = await get('/workforce-simulator/options');
  return r.ok ? r.data : null;
}

export async function simulatePredict(scenario) {
  return post('/workforce-simulator/predict', scenario);
}

export async function simulateCompare(scenarios) {
  return post('/workforce-simulator/compare', { scenarios });
}

export async function fetchHistoricalContext(service) {
  const r = await get(`/workforce-simulator/historical-context/${service}`);
  return r.ok ? r.data : null;
}

// ── AI Data Assistant ─────────────────────────────────────────────────────────
export async function askAssistant(question) {
  return post('/assistant/ask', { question });
}

export async function fetchAssistantSuggestions() {
  const r = await get('/assistant/suggestions');
  return r.ok ? r.data : null;
}

export async function fetchAssistantCapabilities() {
  const r = await get('/assistant/capabilities');
  return r.ok ? r.data : null;
}
