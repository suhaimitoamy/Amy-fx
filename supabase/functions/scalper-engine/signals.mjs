import {
  detectMultiDriverCandidates,
  evaluateMultiDriverCandidates,
  DRIVER_REGISTRY as BASE_DRIVER_REGISTRY,
  ENGINE_VERSION,
  SETUP_SCHEMA_VERSION,
  TIMEFRAME_SECONDS,
} from './drivers.mjs';
import {
  EXPANSION_RANGE_REENTRY_DRIVER,
  EXPANSION_RANGE_REENTRY_VERSION,
  detectExpansionRangeReentryCandidates,
  evaluateExpansionRangeReentryCandidates,
} from './expansion-range-reentry.mjs';
import {
  SMR_FIRST_RETEST_DRIVER,
  SMR_FIRST_RETEST_VERSION,
  detectSmrFirstRetestCandidates,
  evaluateSmrFirstRetestCandidates,
} from './smr-first-retest.mjs';
export { BASE_CONFIG_VERSION, REPAIR_CONFIG_VERSION, AMD_CONFIG_VERSION, DEFAULT_PATTERN_CONFIG, derivePatternFeatures, evaluatePatternGate, resolvePatternConfig } from './pattern-gates.mjs';
export { EXPANSION_RANGE_REENTRY_VERSION, SMR_FIRST_RETEST_VERSION };

export const DRIVER_REGISTRY = Object.freeze([
  ...BASE_DRIVER_REGISTRY,
  EXPANSION_RANGE_REENTRY_DRIVER,
  SMR_FIRST_RETEST_DRIVER,
]);
export { ENGINE_VERSION, SETUP_SCHEMA_VERSION, TIMEFRAME_SECONDS };

function mergeCandidates(...groups) {
  return [...new Map(groups.flat().filter(Boolean).map(item => [item.id, item])).values()]
    .sort((a, b) => Number(a.signal_candle_close_time || 0) - Number(b.signal_candle_close_time || 0)
      || Number(a.priority || 99) - Number(b.priority || 99));
}

function enabledFor(input,id){return input.series?.config?.enabledDrivers?.[id]!==false&&input.config?.driver_enabled?.[id]!==false&&input.config?.enabled!==false;}

export function detectScalperCandidates(input = {}) {
  return mergeCandidates(
    detectMultiDriverCandidates(input),
    enabledFor(input,'EXPANSION_RANGE_REENTRY')?detectExpansionRangeReentryCandidates(input):[],
    enabledFor(input,'SMR_FIRST_RETEST')?detectSmrFirstRetestCandidates(input):[],
  );
}

export function evaluateScalperCandidates(input = {}) {
  const base = evaluateMultiDriverCandidates(input);
  const expansionRange = enabledFor(input,'EXPANSION_RANGE_REENTRY')?evaluateExpansionRangeReentryCandidates(input):{candidates:[],telemetry:[]};
  const smr = enabledFor(input,'SMR_FIRST_RETEST')?evaluateSmrFirstRetestCandidates(input):{candidates:[],telemetry:[]};
  return {
    candidates: mergeCandidates(base.candidates, expansionRange.candidates, smr.candidates),
    telemetry: [...(base.telemetry || []), ...(expansionRange.telemetry || []), ...(smr.telemetry || [])],
    raw_count: Number(base.raw_count || 0) + Number(expansionRange.raw_count || 0) + Number(smr.raw_count || 0),
    rejected_count: Number(base.rejected_count || 0) + Number(expansionRange.rejected_count || 0) + Number(smr.rejected_count || 0),
  };
}

export const detectApprovedScalperCandidates = detectScalperCandidates;
