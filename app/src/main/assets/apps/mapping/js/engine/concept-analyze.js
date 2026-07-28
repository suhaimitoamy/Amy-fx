import { analyze as analyzeLegacy, tfGroup } from './core/analyze.js';
import { detectMarketConcepts } from './concept-engine.js';
import { detectTimeframeEntryMap } from './concept-entry-map-v3.js';
import { evaluateValidatedMarketContext } from './validated-market-context.js';

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
  if (!setup) {
    return [
      'Entry Map',
      entryMap?.scenario?.status || 'WAIT',
      entryMap?.scenario?.reason || 'Sequence causal belum lengkap.'
    ];
  }
  return [
    'Entry Map',
    setup.live ? 'AUTHORITATIVE' : setup.status,
    `${setup.dir} ${setup.type} · sweep → displaced MSS → target struktural ${Number(setup.targetR || 0).toFixed(2)}R.`
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
  const validatedMarketContext = evaluateValidatedMarketContext({
    candles,
    tf,
    htfCandles
  });
  const entryMap = detectTimeframeEntryMap(candles, {
    tf,
    marketConcepts,
    validatedContext: validatedMarketContext,
    htfCandles
  });
  const activeSetup = entryMap.activeSetup || null;
  const terminalSetup = Boolean(entryMap.setup && entryMap.setup.live === false);
  const replacementRows = [...marketConcepts.concepts, entryMapRow(entryMap)];

  return {
    ...result,
    htfBiases: { ...htfBiases },
    setups: activeSetup ? [activeSetup] : [],
    bestSetup: activeSetup,
    signal: activeSetup?.dir || 'WAIT',
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
      status: entryMap.status || 'AMY_CAUSAL_ENTRY_MAP_V3'
    },
    entryWatch: {
      version: '3.0.0',
      model: 'AMY_CAUSAL_ENTRY_MAP_MONITOR',
      sourceTf: tf,
      triggerTf: tf,
      direction: entryMap.scenario?.direction || 'WAIT',
      status: entryMap.scenario?.status || 'WAIT',
      lifecycleStage: activeSetup
        ? 'ENTRY_CONFIRMED'
        : terminalSetup
          ? 'TERMINAL'
          : 'WAITING_CONFIRMATION',
      active: Boolean(
        !terminalSetup
        && entryMap.scenario?.direction
        && entryMap.scenario.direction !== 'WAIT'
      ),
      entryAllowed: Boolean(activeSetup),
      terminal: terminalSetup,
      reason: entryMap.scenario?.reason || 'Sequence causal belum lengkap.',
      scenario: entryMap.scenario,
      executionPlan: activeSetup ? {
        locked: true,
        lockedAt: activeSetup.timestamp,
        entry: activeSetup.entry,
        entryLow: activeSetup.entryLow,
        entryHigh: activeSetup.entryHigh,
        sl: activeSetup.sl,
        tp1: activeSetup.tp1,
        tp2: activeSetup.tp2
      } : null
    },
    validatedMarketContext,
    validatedMarketState: validatedMarketContext.marketState,
    validatedDirectionForecast: validatedMarketContext.directionForecast,
    mappingZones: marketConcepts.mappingZones,
    concepts: mergeRows(result.concepts, replacementRows)
  };
}
