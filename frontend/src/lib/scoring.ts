import { METRIC_KEYS, type Band, type MetricKey } from './course-schema';

const DEFAULT_FORMULA = '(CE x 0.30) + (TC x 0.25) + (SA x 0.20) + (CV x 0.15) + (SV x 0.10)';

const DEFAULT_LABELS: Record<MetricKey, string> = {
  CE: 'Compilation/Execution Success',
  TC: 'Test Cases Passed Ratio',
  SA: 'Static Analysis Score',
  CV: 'Code Validity Score',
  SV: 'Semantic Verification Score',
};

function labelFromEnv(value: string | undefined, fallback: string) {
  const label = value?.split('(')[0]?.trim();
  return label ? label : fallback;
}

function labelFromCombined(combined: string | undefined, key: MetricKey) {
  const match = combined?.match(new RegExp(`(?:^|\\s)${key}\\s*=\\s*([^()]+)\\(`));
  return match?.[1]?.trim();
}

export function getScoringConfig() {
  const formula = process.env.CS?.trim() || DEFAULT_FORMULA;
  const weights = {} as Record<MetricKey, number>;
  for (const match of formula.matchAll(/\b(CE|TC|SA|CV|SV)\s*[x×*]\s*([\d.]+)/gi)) {
    weights[match[1].toUpperCase() as MetricKey] = Number.parseFloat(match[2]);
  }
  const defaults = { CE: 0.3, TC: 0.25, SA: 0.2, CV: 0.15, SV: 0.1 };
  for (const key of METRIC_KEYS) {
    if (!Number.isFinite(weights[key])) weights[key] = defaults[key];
  }

  const labels: Record<MetricKey, string> = {
    CE: labelFromEnv(process.env.CE_2 ?? process.env.CE, DEFAULT_LABELS.CE),
    TC: labelFromCombined(process.env.CE_2, 'TC') ?? labelFromEnv(process.env.TC, DEFAULT_LABELS.TC),
    SA: labelFromCombined(process.env.CE_2, 'SA') ?? labelFromEnv(process.env.SA, DEFAULT_LABELS.SA),
    CV: labelFromCombined(process.env.CE_2, 'CV') ?? labelFromEnv(process.env.CV, DEFAULT_LABELS.CV),
    SV: labelFromCombined(process.env.CE_2, 'SV') ?? labelFromEnv(process.env.SV, DEFAULT_LABELS.SV),
  };

  return { formula, weights, labels };
}

export function bandFor(score: number): Band {
  if (score < 50) return 'LOW';
  if (score < 70) return 'MEDIUM';
  return 'HIGH';
}

export function computeConfidence(metrics: Record<MetricKey, number>) {
  const config = getScoringConfig();
  const cs = METRIC_KEYS.reduce((sum, key) => sum + clamp01(metrics[key]) * config.weights[key], 0);
  const score = Math.round(cs * 1000) / 10;
  return { ...config, cs: Math.round(cs * 10000) / 10000, score, band: bandFor(score) };
}

export function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
