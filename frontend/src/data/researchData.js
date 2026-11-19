export const PROJECT_META = {
  name: 'PulseNova',
  fullName: 'HealthPulse-XAR',
  version: '1.0.0',
  subtitle: 'Predictive Healthcare Operational Intelligence Platform',
  algorithms: ['XGBoost', 'Random Forest', 'ARIMA(1,1,1)'],
  datasets: [
    { name: 'Healthcare Dataset',        file: 'healthcare_dataset.csv',                       rows: '55,500 rows' },
    { name: 'Hospital ER Data',          file: 'Hospital ER_Data.csv',                         rows: '9,216 rows'  },
    { name: 'Hospital Insights Summary', file: 'hospital_insights_summary.csv',                rows: '208 rows'    },
    { name: 'Patient Flow Data',         file: 'healthcare_analytics_patient_flow_data.csv',   rows: '9,216 rows'  },
  ],
};

export const FINAL_SUMMARY = [
  { component: 'XGBoost',       objective: 'Staff level classification',      result: '100% accuracy' },
  { component: 'Random Forest', objective: 'Staff level classification',      result: '100% accuracy' },
  { component: 'ARIMA(1,1,1)',  objective: 'Daily admissions forecasting',    result: 'MAE 5.7912'    },
  { component: 'Data Explorer', objective: 'Dataset inspection & CSV export', result: '4 datasets'    },
  { component: 'Evaluation',    objective: 'Model metrics & feature importance', result: 'Full suite' },
];
