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
  const last = rows.find(row => row?.[0] === 'Best Setup');
  const kept = rows.filter(row => row?.[0] !== 'Best Setup' && !REPLACED_ROWS.has(row?.[0]));
  return [...kept, ...replacement, ...(last ? [last] : [])];
}

function entryMapRow(entryMap) {
  const setup = entryMap?.setup;
  if (!setup) return ['Entry Map', 'WAIT', 'Belum ada setup M15 yang lolos Sweep → MSS → filter HTF/EMA/sesi.'];
  return [
    'Entry Map',
    setup.lifecycle?.status || setup.status,
    `${setup.dir} entry ${setup.entry.toFixed(2)} · SL ${setup.sl.toFixed(2)} · TP1 ${setup.tp1.toFixed(2)} · TP2 ${setup.tp2.toFixed(2)}`
  ];
}

export function analyze(candles, tf, htfBiases = {}, currentPrice = null, htfCandles = {}) {
  const result = analyzeLegacy(candles, tf, htfBiases, currentPrice, htfCandles);
  if (!Array.isArray(candles) || candles.length < 30) return result;
  const marketConcepts = detectMarketConcepts(candles, {
    tf,
    currentPrice: result.price || currentPrice,
    htfCandles,
    htfBias: result.htfNarrative?.htfBias || 'NEUTRAL'
  });
  const entryMap = detectM15EntryMap(candles, { tf, htfCandles });
  const useEntryMap = tf === 'M15';
  const setups = useEntryMap ? (entryMap.setup ? [entryMap.setup] : []) : result.setups;
  const bestSetup = useEntryMap ? entryMap.activeSetup : result.bestSetup;
  const signal = bestSetup?.dir || 'WAIT';
  const replacementRows = [...marketConcepts.concepts, entryMapRow(entryMap)];

  return {
    ...result,
    setups,
    bestSetup,
    signal,
    setupStructure: result.st,
    st: marketConcepts.structure,
    bsl: marketConcepts.bsl,
    ssl: marketConcepts.ssl,
    liquidityHierarchy: marketConcepts.liquidityHierarchy,
    drawTarget: marketConcepts.liquidityHierarchy.drawTarget,
    activeLiquidityTargets: marketConcepts.liquidityHierarchy.activeTargets,
    marketConcepts,
    entryMap,
    mappingZones: marketConcepts.mappingZones,
    concepts: mergeRows(result.concepts, replacementRows)
  };
}
