from pathlib import Path

projection_path = Path('app/src/main/assets/apps/mapping/js/outlook/v2/projection.js')
projection = projection_path.read_text(encoding='utf-8')
old_direction = """    const votes = collectVotes(combinedAnalyses, config.weights);
    const direction = directionName(votes.normalized);"""
new_direction = """    const votes = collectVotes(combinedAnalyses, config.weights);
    const m15Trend = confirmedTrend(combinedAnalyses.M15);
    const direction = config.id === 'SCALPING' && m15Trend !== 0
      ? (m15Trend > 0 ? 'BULLISH' : 'BEARISH')
      : directionName(votes.normalized);"""
if old_direction in projection:
    projection = projection.replace(old_direction, new_direction, 1)
elif new_direction not in projection:
    raise SystemExit('SCALPING direction anchor not found')

old_trackable = "const trackable = outlooks.length === 3"
new_trackable = "const trackable = outlooks.length === OUTLOOK_HORIZONS.length"
if old_trackable in projection:
    projection = projection.replace(old_trackable, new_trackable, 1)
elif new_trackable not in projection:
    raise SystemExit('trackable horizon-count anchor not found')
projection_path.write_text(projection, encoding='utf-8')

tracker_path = Path('app/src/main/assets/apps/mapping/js/outlook/v2/tracker.js')
tracker = tracker_path.read_text(encoding='utf-8')
tracker = tracker.replace("if (outlook.id === 'SCALPING' || outlook.id === 'INTRADAY') return `${outlook.id}:${Math.floor(now / HOUR)}`;", "if (outlook.id === 'SCALPING') return `${outlook.id}:${Math.floor(now / (HOUR / 2))}`;\n  if (outlook.id === 'INTRADAY') return `${outlook.id}:${Math.floor(now / HOUR)}`;")
tracker = tracker.replace("Asia/Jakarta", "Asia/Makassar")
anchor = "import { HOUR, OUTLOOK_HORIZONS, num } from './base.js';\n"
helper = """
function candleTimeMs(value) {
  const numeric = num(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return numeric > 100_000_000_000 ? numeric : numeric * 1000;
}
"""
if 'function candleTimeMs(value)' not in tracker:
    if anchor not in tracker:
        raise SystemExit('tracker import anchor not found')
    tracker = tracker.replace(anchor, anchor + helper, 1)
tracker = tracker.replace('time: num(candle.time) * 1000,', 'time: candleTimeMs(candle.time),')
tracker_path.write_text(tracker, encoding='utf-8')

market_path = Path('app/src/main/assets/apps/mapping/js/api/market-data.js')
market = market_path.read_text(encoding='utf-8')
validated_anchor = "  const validated = result?.validatedMarketContext;\n  if (result) {"
validated_replacement = "  const validated = result?.validatedMarketContext;\n  const analysisUnavailable = Boolean(result?.dataStale && !result?.st && !validated?.marketState);\n  if (result) {"
if validated_anchor in market:
    market = market.replace(validated_anchor, validated_replacement, 1)
elif 'const analysisUnavailable = Boolean' not in market:
    raise SystemExit('publish analysisUnavailable anchor not found')
market = market.replace("marketState: result?.dataStale ? 'DATA USANG' : (validated?.marketState?.state || 'RANGE / TRANSITION'),", "marketState: analysisUnavailable ? 'DATA TIDAK TERSEDIA' : (validated?.marketState?.state || result?.st?.trend || 'RANGE / TRANSITION'),")
market = market.replace("regime: result?.dataStale ? 'TRANSITION' : (result?.strategyRouter?.activeRegime || result?.marketRegime?.regime || 'TRANSITION'),", "regime: analysisUnavailable ? 'TRANSITION' : (result?.strategyRouter?.activeRegime || result?.marketRegime?.regime || 'TRANSITION'),")
market = market.replace("strategy: result?.dataStale ? 'NO_TRADE' : (result?.strategyRouter?.activeStrategy || 'NO_TRADE'),", "strategy: analysisUnavailable ? 'NO_TRADE' : (result?.strategyRouter?.activeStrategy || 'NO_TRADE'),")
market_path.write_text(market, encoding='utf-8')

print('projection, tracker, and mapping publication polished')
# Trigger revision 3: capture-enabled workflow exists before this push.
