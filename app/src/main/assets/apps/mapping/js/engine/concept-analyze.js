import { analyze as analyzeLegacy, tfGroup } from './core/analyze.js';
import { detectMarketConcepts } from './concept-engine.js';
import { detectM15EntryMap } from './concept-entry-map.js';

export { tfGroup };

const REPLACED_ROWS = new Set([
  'Structure', 'Latest Event', 'OB', 'FVG', 'Liquidity Hierarchy',
  'BSL / SSL Sweep', 'Concept Filter', 'Entry Map'
]);

function mergeRows(current, replacement) {
  const rows = Array.isArray(current) ? current : [];
  const kept = rows.filter(row => row?.[0] !== 'Best Setup' && !REPLACED_ROWS.has(row?.[0]));
  return [...kept, ...replacement];
}

function entryMapRow(entryMap) {
  const setup = entryMap?.setup;
  if (!setup) return ['Entry Map', 'REPLACED', 'Entry Map lama dinonaktifkan. Entry utama memakai Multi-Timeframe Level Watch.'];
  return [
    'Entry Map',
    'AUDIT ONLY',
    `${setup.dir} ${setup.type || 'legacy setup'} tetap disimpan untuk audit, tetapi tidak boleh menjadi setup utama.`
  ];
}

export function analyze(candles, tf, htfBiases = {}, currentPrice = null, htfCandles = {}) {
  const result = analyzeLegacy(candles, tf, htfBiases, currentPrice, htfCandles);
  if (!Array.isArray(candles) || candles.length < 30) return { ...result, htfBiases };
  const marketConcepts = detectMarketConcepts(candles, {
    tf,
    currentPrice: result.price || currentPrice,
    htfCandles,
    htfBias: result.htfNarrative?.htfBias || 'NEUTRAL'
  });
  const entryMap = detectM15EntryMap(candles, { tf, htfCandles });
  const replacementRows = [...marketConcepts.concepts, entryMapRow(entryMap)];

  return {
    ...result,
    htfBiases: { ...htfBiases },
    setups: [],
    bestSetup: null,
    signal: 'WAIT',
    setupStructure: result.st,
    st: marketConcepts.structure,
    bsl: marketConcepts.bsl,
    ssl: marketConcepts.ssl,
    liquidityHierarchy: marketConcepts.liquidityHierarchy,
    drawTarget: marketConcepts.liquidityHierarchy.drawTarget,
    activeLiquidityTargets: marketConcepts.liquidityHierarchy.activeTargets,
    marketConcepts,
    entryMap: {
      ...entryMap,
      setup: null,
      activeSetup: null,
      status: 'REPLACED_BY_MULTI_TF_LEVEL_WATCH'
    },
    legacyEntryMap: entryMap,
    mappingZones: marketConcepts.mappingZones,
    concepts: mergeRows(result.concepts, replacementRows)
  };
}
