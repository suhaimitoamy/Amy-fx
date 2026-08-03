from pathlib import Path
import re

path = Path('app/src/main/assets/apps/mapping/js/api/market-data.js')
text = path.read_text(encoding='utf-8')

mapping_import = """import {
  SUPPORTED_MAPPING_TIMEFRAMES,
  timeframeDurationMs
} from '../engine/mapping-timeframes.js';"""
aggregation_import = "import { aggregateClosedCandles } from './closed-candle-aggregation.js';"
if aggregation_import not in text:
    if mapping_import not in text:
        raise SystemExit('mapping-timeframes import anchor not found')
    text = text.replace(mapping_import, f"{mapping_import}\n{aggregation_import}", 1)

old_direction_guard = "if (result.dataStale) {"
new_direction_guard = "if (result.dataStale && !result.st && !result.validatedMarketContext?.marketState) {"
if old_direction_guard in text:
    text = text.replace(old_direction_guard, new_direction_guard, 1)
elif new_direction_guard not in text:
    raise SystemExit('direction stale guard not found')

old_setup_guard = "if (result.dataStale || dd.source === 'DATA_STALE') {"
new_setup_guard = "if ((result.dataStale || dd.source === 'DATA_STALE') && !result.st && !result.validatedMarketContext?.marketState) {"
if old_setup_guard in text:
    text = text.replace(old_setup_guard, new_setup_guard, 1)
elif new_setup_guard not in text:
    raise SystemExit('setup stale guard not found')

old_explanation_guard = "if (dd.source === 'DATA_STALE' || result.dataStale) {"
new_explanation_guard = "if ((dd.source === 'DATA_STALE' || result.dataStale) && !result.st && !result.validatedMarketContext?.marketState) {"
if old_explanation_guard in text:
    text = text.replace(old_explanation_guard, new_explanation_guard, 1)
elif new_explanation_guard not in text:
    raise SystemExit('explanation stale guard not found')

old_geometry = "if (!Number.isFinite(lo) || !Number.isFinite(hi) || !Number.isFinite(sl) || !Number.isFinite(tp1)) {"
new_geometry = "if (![lo, hi, sl, tp1].every(value => Number.isFinite(value) && value > 0)) {"
if old_geometry in text:
    text = text.replace(old_geometry, new_geometry, 1)
elif new_geometry not in text:
    raise SystemExit('geometry positive-price guard not found')

old_tp2 = "if (!singleTarget && !Number.isFinite(tp2)) {"
new_tp2 = "if (!singleTarget && (!Number.isFinite(tp2) || tp2 <= 0)) {"
if old_tp2 in text:
    text = text.replace(old_tp2, new_tp2, 1)
elif new_tp2 not in text:
    raise SystemExit('TP2 positive-price guard not found')

fallback_pattern = re.compile(
    r"    if \(\(tf === 'M5' \|\| tf === 'M15'\) && state\.candles\['M1'\]\?\.length\) \{.*?\n    \}\n    throw err;",
    re.S,
)
fallback_replacement = """    if (tf === 'M5' || tf === 'M15') {
      if (!state.candles.M1?.length) {
        try { await fetchTf('M1', { signal }); } catch (_) {}
      }
      const duration = timeframeDurationMs(tf);
      const candles = aggregateClosedCandles(state.candles.M1 || [], {
        timeframe: tf,
        durationMs: duration,
        sourceDurationMs: timeframeDurationMs('M1'),
        closeCutoff: Date.now() - 10_000
      });
      if (candles.length) {
        state.candles[tf] = candles;
        setCandleFetchedAt(tf, Date.now());
        return candles;
      }
    }
    throw err;"""
text, fallback_count = fallback_pattern.subn(fallback_replacement, text, count=1)
if fallback_count != 1 and 'aggregateClosedCandles(state.candles.M1 || []' not in text:
    raise SystemExit('fallback aggregation block not found')

old_unavailable = "const currentDataUnavailable = !state.candles[tf]?.length || (refreshFailures.has(tf) && isCandleStale(tf));"
new_unavailable = "const currentDataUnavailable = !(state.candles[tf] || []).some(candle => candle?.isClosed !== false);"
if old_unavailable in text:
    text = text.replace(old_unavailable, new_unavailable, 1)
elif new_unavailable not in text:
    raise SystemExit('currentDataUnavailable anchor not found')

live_pattern = re.compile(
    r"\n  if \(state\.result\) \{\n    state\.result\.setupExecution = buildSetupExecution\(state\.result\);.*?\n  \}\n  publishMappingSnapshot\(\);\n  sendTargetsToNative\(\);\n  notifyImportant\(state\.result\);\n  renderAnalyzeLive\(\);\n  renderSoft\(\);\n  scheduleAnalysisRefresh\(\);",
    re.S,
)
live_replacement = """
  // WebSocket is display-only. Mapping and lifecycle remain bound to closed candles.
  renderAnalyzeLive();
  renderSoft();"""
text, live_count = live_pattern.subn(live_replacement, text, count=1)
if live_count != 1 and 'WebSocket is display-only' not in text:
    raise SystemExit('live tick Mapping recalculation block not found')

path.write_text(text, encoding='utf-8')
print('market-data.js polished successfully')
# Trigger revision 2: workflow already exists before this push.
