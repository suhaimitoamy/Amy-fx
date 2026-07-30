import { detectMultiDriverCandidates, DRIVER_REGISTRY, ENGINE_VERSION, SETUP_SCHEMA_VERSION, TIMEFRAME_SECONDS } from './drivers.mjs';

export { DRIVER_REGISTRY, ENGINE_VERSION, SETUP_SCHEMA_VERSION, TIMEFRAME_SECONDS };

export function detectScalperCandidates(input = {}) {
  return detectMultiDriverCandidates(input);
}

export const detectApprovedScalperCandidates = detectScalperCandidates;
