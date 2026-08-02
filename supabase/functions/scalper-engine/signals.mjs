import { detectMultiDriverCandidates, evaluateMultiDriverCandidates, DRIVER_REGISTRY, ENGINE_VERSION, SETUP_SCHEMA_VERSION, TIMEFRAME_SECONDS } from './drivers.mjs';
export { BASE_CONFIG_VERSION, REPAIR_CONFIG_VERSION, AMD_CONFIG_VERSION, DEFAULT_PATTERN_CONFIG, derivePatternFeatures, evaluatePatternGate, resolvePatternConfig } from './pattern-gates.mjs';

export { DRIVER_REGISTRY, ENGINE_VERSION, SETUP_SCHEMA_VERSION, TIMEFRAME_SECONDS };

export function detectScalperCandidates(input = {}) {
  return detectMultiDriverCandidates(input);
}

export function evaluateScalperCandidates(input = {}) {
  return evaluateMultiDriverCandidates(input);
}

export const detectApprovedScalperCandidates = detectScalperCandidates;
