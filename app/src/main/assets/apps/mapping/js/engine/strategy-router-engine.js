import { stabilizeRegime } from './regime-state-machine.js';
import { evaluateExpansionBreakout, EXPANSION_ENGINE } from './strategies/expansion-breakout-engine.js';
import { evaluateManipulationSweep, MANIPULATION_ENGINE } from './strategies/manipulation-sweep-engine.js';
import { evaluateRangeMeanReversion, RANGE_ENGINE } from './strategies/range-mean-reversion-engine.js';
import { evaluateTrendPullback, TREND_ENGINE } from './strategies/trend-pullback-engine.js';

const ENGINE_BY_REGIME = Object.freeze({
  TRENDING: TREND_ENGINE,
  RANGING: RANGE_ENGINE,
  MANIPULATION: MANIPULATION_ENGINE,
  EXPANSION: EXPANSION_ENGINE,
  TRANSITION: 'NO_TRADE'
});

export function routeRegimeStrategy({
  candles = [],
  result = null,
  regime = null,
  currentPrice = null,
  previousState = null,
  stateOptions = {}
} = {}) {
  const state = stabilizeRegime(regime, previousState, stateOptions);
  const activeRegime = regime?.shift?.blockRecommended ? 'TRANSITION' : state.activeRegime;
  const baseInput = { candles, result, regime, currentPrice, activeRegime };
  const engines = {
    [TREND_ENGINE]: evaluateTrendPullback(baseInput),
    [RANGE_ENGINE]: evaluateRangeMeanReversion(baseInput),
    [MANIPULATION_ENGINE]: evaluateManipulationSweep(baseInput),
    [EXPANSION_ENGINE]: evaluateExpansionBreakout(baseInput)
  };
  const activeEngineName = ENGINE_BY_REGIME[activeRegime] || 'NO_TRADE';
  const activeEngine = engines[activeEngineName] || null;
  const blocked = activeRegime === 'TRANSITION' || Boolean(regime?.shift?.blockRecommended);
  const setup = !blocked && activeEngine?.status === 'READY' ? activeEngine.setup : null;
  const quality = Number(activeEngine?.quality || 0);

  let decision = 'WAIT — MARKET BELUM JELAS';
  if (blocked) decision = 'NO TRADE — MARKET SEDANG BERUBAH';
  else if (!activeEngine) decision = 'WAIT — STRATEGI BELUM TERSEDIA';
  else if (setup) decision = `${setup.dir} READY — ${activeEngineName.replaceAll('_', ' ')}`;
  else if (activeEngine.status === 'WATCH') decision = `WATCH — ${activeEngineName.replaceAll('_', ' ')}`;
  else decision = `WAIT — ${activeEngineName.replaceAll('_', ' ')}`;

  const reasons = [];
  reasons.push(`Regime aktif: ${activeRegime}. Hanya ${activeEngineName.replaceAll('_', ' ')} yang diizinkan.`);
  if (!state.stable) reasons.push(`Regime mentah ${state.rawRegime} belum lolos persistence; engine mempertahankan ${state.activeRegime}.`);
  if (regime?.shift?.risk >= 30) reasons.push(`Market Shift risk ${Math.round(regime.shift.risk)}/100.`);
  if (activeEngine?.reasons?.length) reasons.push(...activeEngine.reasons.slice(0, 3));

  return {
    version: '3.0.0-preview',
    source: 'AMY_REGIME_STRATEGY_ROUTER',
    status: regime?.status === 'READY' ? 'READY' : 'WAITING',
    activeRegime,
    rawRegime: regime?.regime || 'TRANSITION',
    activeStrategy: activeEngineName,
    blocked,
    decision,
    quality,
    qualityMeaning: 'SETUP_QUALITY_SCORE_NOT_WIN_PROBABILITY',
    setup,
    watchSetup: activeEngine?.watchSetup || null,
    activeEngine,
    engines,
    disabledStrategies: Object.values(engines).filter(engine => !engine.enabled).map(engine => engine.engine),
    state,
    reasons: reasons.slice(0, 6),
    safety: {
      strategySelectionEnabled: true,
      automaticTradeExecution: false,
      liquidityIsDirectionalSignal: false,
      confidenceIsWinProbability: false
    }
  };
}
