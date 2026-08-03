from pathlib import Path
import json

OLD_VERSION = '2.0.0-preview.305'
NEW_VERSION = '2.0.0-preview.306'
OLD_VERSION_REGEX = r'2\.0\.0-preview\.305'
NEW_VERSION_REGEX = r'2\.0\.0-preview\.306'
OLD_CODE = '940305'
NEW_CODE = '940306'


def replace_once(text, old, new, label):
    if old in text:
        return text.replace(old, new, 1)
    if new in text:
        return text
    raise SystemExit(f'{label} anchor not found')


projection_path = Path('app/src/main/assets/apps/mapping/js/outlook/v2/projection.js')
projection = projection_path.read_text(encoding='utf-8')
old_direction = """    const votes = collectVotes(combinedAnalyses, config.weights);
    const direction = directionName(votes.normalized);"""
new_direction = """    const votes = collectVotes(combinedAnalyses, config.weights);
    const m15Trend = confirmedTrend(combinedAnalyses.M15);
    const direction = config.id === 'SCALPING' && m15Trend !== 0
      ? (m15Trend > 0 ? 'BULLISH' : 'BEARISH')
      : directionName(votes.normalized);"""
projection = replace_once(projection, old_direction, new_direction, 'SCALPING direction')
projection = replace_once(
    projection,
    'const trackable = outlooks.length === 3',
    'const trackable = outlooks.length === OUTLOOK_HORIZONS.length',
    'trackable horizon count'
)
projection_path.write_text(projection, encoding='utf-8')

tracker_path = Path('app/src/main/assets/apps/mapping/js/outlook/v2/tracker.js')
tracker = tracker_path.read_text(encoding='utf-8')
tracker = replace_once(
    tracker,
    "if (outlook.id === 'SCALPING' || outlook.id === 'INTRADAY') return `${outlook.id}:${Math.floor(now / HOUR)}`;",
    "if (outlook.id === 'SCALPING') return `${outlook.id}:${Math.floor(now / (HOUR / 2))}`;\n  if (outlook.id === 'INTRADAY') return `${outlook.id}:${Math.floor(now / HOUR)}`;",
    'SCALPING prediction slot'
)
tracker = tracker.replace('Asia/Jakarta', 'Asia/Makassar')
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
market = replace_once(market, validated_anchor, validated_replacement, 'mapping publication availability')
market = replace_once(
    market,
    "marketState: result?.dataStale ? 'DATA USANG' : (validated?.marketState?.state || 'RANGE / TRANSITION'),",
    "marketState: analysisUnavailable ? 'DATA TIDAK TERSEDIA' : (validated?.marketState?.state || result?.st?.trend || 'RANGE / TRANSITION'),",
    'published market state'
)
market = replace_once(
    market,
    "regime: result?.dataStale ? 'TRANSITION' : (result?.strategyRouter?.activeRegime || result?.marketRegime?.regime || 'TRANSITION'),",
    "regime: analysisUnavailable ? 'TRANSITION' : (result?.strategyRouter?.activeRegime || result?.marketRegime?.regime || 'TRANSITION'),",
    'published regime'
)
market = replace_once(
    market,
    "strategy: result?.dataStale ? 'NO_TRADE' : (result?.strategyRouter?.activeStrategy || 'NO_TRADE'),",
    "strategy: analysisUnavailable ? 'NO_TRADE' : (result?.strategyRouter?.activeStrategy || 'NO_TRADE'),",
    'published strategy'
)
market_path.write_text(market, encoding='utf-8')

app_version_path = Path('app/src/main/assets/app-version.js')
app_version = app_version_path.read_text(encoding='utf-8')
if OLD_VERSION not in app_version or OLD_CODE not in app_version:
    if NEW_VERSION not in app_version or NEW_CODE not in app_version:
        raise SystemExit('actual Preview app identity is not .305 or .306')
else:
    app_version = app_version.replace(OLD_VERSION, NEW_VERSION).replace(OLD_CODE, NEW_CODE)
    app_version_path.write_text(app_version, encoding='utf-8')

build_path = Path('app/build.gradle.kts')
build = build_path.read_text(encoding='utf-8')
if OLD_VERSION not in build or OLD_CODE not in build:
    if NEW_VERSION not in build or NEW_CODE not in build:
        raise SystemExit('actual Gradle Preview identity is not .305 or .306')
else:
    build = build.replace(OLD_VERSION, NEW_VERSION).replace(OLD_CODE, NEW_CODE)
    build_path.write_text(build, encoding='utf-8')

for test_path in Path('tests').rglob('*.mjs'):
    text = test_path.read_text(encoding='utf-8')
    updated = (
        text
        .replace(OLD_VERSION, NEW_VERSION)
        .replace(OLD_VERSION_REGEX, NEW_VERSION_REGEX)
        .replace(OLD_CODE, NEW_CODE)
    )
    if updated != text:
        test_path.write_text(updated, encoding='utf-8')

manifest = json.loads(Path('preview-update.json').read_text(encoding='utf-8'))
if int(manifest.get('latest_version_code', 0)) != int(OLD_CODE):
    raise SystemExit('preview-update.json must remain on the currently published .305 until release activation')

print(f'Outlook polish applied and Preview identity raised to {NEW_VERSION} ({NEW_CODE})')
