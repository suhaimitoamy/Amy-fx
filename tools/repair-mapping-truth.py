from pathlib import Path
import re

ROOT = Path('.')


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, content):
    file = ROOT / path
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(content, encoding='utf-8')


def replace_once(path, old, new):
    text = read(path)
    if old not in text:
        raise SystemExit(f'Expected anchor not found in {path}: {old[:180]!r}')
    write(path, text.replace(old, new, 1))


def replace_all(path, old, new, expected=None):
    text = read(path)
    count = text.count(old)
    if expected is not None and count != expected:
        raise SystemExit(
            f'Expected {expected} anchors in {path}, found {count}: {old[:180]!r}'
        )
    if count == 0:
        raise SystemExit(f'Expected anchor not found in {path}: {old[:180]!r}')
    write(path, text.replace(old, new))


def replace_js_function(path, function_name, replacement):
    text = read(path)
    start_pattern = re.compile(
        rf'(?m)^(?:export\s+)?(?:async\s+)?function\s+{re.escape(function_name)}\s*\('
    )
    start_match = start_pattern.search(text)
    if not start_match:
        raise SystemExit(f'Function {function_name} not found in {path}')
    next_pattern = re.compile(
        r'(?m)^(?:export\s+)?(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\('
    )
    next_match = next_pattern.search(text, start_match.end())
    end = next_match.start() if next_match else len(text)
    prefix = text[:start_match.start()]
    suffix = text[end:]
    clean = replacement.rstrip() + '\n\n'
    write(path, prefix + clean + suffix.lstrip('\n'))


write(
    'app/src/main/assets/apps/mapping/js/engine/closed-candle-source-state.js',
    r"""import {
  expectedClosedCandleOpenTime,
  normalizeMappingTimeframe,
  timeframeDurationMs
} from './mapping-timeframes.js';

const ALLOWED_LAG_BARS = Object.freeze({
  M1: 1,
  M5: 0,
  M15: 0,
  M30: 0,
  H1: 0,
  H4: 1,
  D1: 2,
  W1: 1
});

const BLOCKING_DELAY_TIMEFRAMES = new Set([
  'M1', 'M5', 'M15', 'M30', 'H1'
]);

function timestampSeconds(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return numeric > 10_000_000_000
    ? Math.floor(numeric / 1000)
    : Math.floor(numeric);
}

function validClosedCandle(candle) {
  if (!candle || candle.isClosed === false) return false;
  const values = [candle.open, candle.high, candle.low, candle.close].map(Number);
  if (!values.every(Number.isFinite)) return false;
  const [open, high, low, close] = values;
  return open > 0
    && high >= Math.max(open, close, low)
    && low <= Math.min(open, close, high)
    && timestampSeconds(candle.time) > 0;
}

function marketLikelyClosed(nowMs) {
  const date = new Date(nowMs);
  const day = date.getUTCDay();
  const hour = date.getUTCHours();
  return day === 6 || (day === 0 && hour < 22);
}

export function closedSourceCandles(candles) {
  return (Array.isArray(candles) ? candles : [])
    .filter(validClosedCandle)
    .sort((a, b) => timestampSeconds(a.time) - timestampSeconds(b.time));
}

export function inspectClosedCandleSource(
  timeframe,
  candles,
  {
    nowMs = Date.now(),
    graceMs = 10_000,
    allowedLagBars = null
  } = {}
) {
  const tf = normalizeMappingTimeframe(timeframe);
  const values = closedSourceCandles(candles);
  const latest = values.at(-1) || null;
  const latestOpen = timestampSeconds(latest?.time);
  const expectedOpen = expectedClosedCandleOpenTime(tf, nowMs, graceMs);
  const durationSeconds = Math.max(1, Math.floor(timeframeDurationMs(tf) / 1000));
  const lagSeconds = latestOpen && expectedOpen
    ? Math.max(0, expectedOpen - latestOpen)
    : Number.POSITIVE_INFINITY;
  const lagBars = Number.isFinite(lagSeconds)
    ? Math.ceil(lagSeconds / durationSeconds)
    : Number.POSITIVE_INFINITY;
  const allowance = Number.isFinite(Number(allowedLagBars))
    ? Math.max(0, Number(allowedLagBars))
    : (ALLOWED_LAG_BARS[tf] ?? 0);
  const marketClosed = marketLikelyClosed(nowMs);
  const available = Boolean(latest);
  const current = Boolean(
    available
    && (marketClosed || !expectedOpen || lagBars <= allowance)
  );
  const delayed = available && !current;
  const blockingDelayed = delayed && BLOCKING_DELAY_TIMEFRAMES.has(tf);
  return {
    timeframe: tf,
    available,
    current,
    delayed,
    blockingDelayed,
    marketClosed,
    count: values.length,
    latest,
    latestOpen,
    expectedOpen,
    lagSeconds,
    lagBars,
    allowedLagBars: allowance,
    status: !available
      ? 'UNAVAILABLE'
      : current
        ? 'CURRENT'
        : 'PROVIDER_DELAYED'
  };
}

export function assertCurrentClosedCandleSource(timeframe, candles, options = {}) {
  const state = inspectClosedCandleSource(timeframe, candles, options);
  if (!state.available) {
    throw new Error(`Candle ${state.timeframe} kosong setelah validasi closed-candle.`);
  }
  if (state.blockingDelayed) {
    throw new Error(
      `Candle ${state.timeframe} tertinggal ${state.lagBars} bar; `
      + `latest=${state.latestOpen}, expected=${state.expectedOpen}.`
    );
  }
  return state;
}

export const CLOSED_CANDLE_SOURCE_POLICY = Object.freeze({
  allowedLagBars: ALLOWED_LAG_BARS,
  blockingDelayTimeframes: Object.freeze([...BLOCKING_DELAY_TIMEFRAMES])
});
"""
)

write(
    'app/src/main/assets/apps/mapping/js/engine/timeframe-analysis-contract.js',
    r"""import {
  closedSourceCandles,
  inspectClosedCandleSource
} from './closed-candle-source-state.js';

export function analyzeTimeframeSafely({
  timeframe,
  candles,
  analyze,
  currentPrice = null,
  htfCandles = {},
  minimumCandles = 30,
  nowMs = Date.now()
}) {
  const values = closedSourceCandles(candles);
  const sourceState = inspectClosedCandleSource(timeframe, values, { nowMs });
  if (values.length < minimumCandles) {
    return {
      status: 'INSUFFICIENT_DATA',
      timeframe,
      candleCount: values.length,
      minimumCandles,
      sourceState,
      result: null,
      error: null
    };
  }
  try {
    const result = analyze(
      values,
      timeframe,
      {},
      currentPrice ?? values.at(-1)?.close,
      htfCandles
    );
    return {
      status: 'READY',
      timeframe,
      candleCount: values.length,
      minimumCandles,
      sourceState,
      result,
      error: null
    };
  } catch (error) {
    return {
      status: 'ANALYSIS_ERROR',
      timeframe,
      candleCount: values.length,
      minimumCandles,
      sourceState,
      result: null,
      error: error?.message || 'Analisis timeframe gagal.'
    };
  }
}

export function timeframeSourceSignature(timeframe, candles) {
  const values = closedSourceCandles(candles);
  const latest = values.at(-1);
  return JSON.stringify({
    timeframe,
    count: values.length,
    time: Number(latest?.time || 0),
    open: Number(latest?.open || 0),
    high: Number(latest?.high || 0),
    low: Number(latest?.low || 0),
    close: Number(latest?.close || 0)
  });
}
"""
)

market = 'app/src/main/assets/apps/mapping/js/api/market-data.js'
replace_once(
    market,
    "import { aggregateClosedCandles } from './closed-candle-aggregation.js';",
    "import { aggregateClosedCandles } from './closed-candle-aggregation.js';\n"
    "import {\n"
    "  assertCurrentClosedCandleSource,\n"
    "  inspectClosedCandleSource\n"
    "} from '../engine/closed-candle-source-state.js';"
)

replace_js_function(
    market,
    'isCandleStale',
    r"""export function isCandleStale(tf) {
  const norm = normalizeTfKey(tf);
  const sourceState = inspectClosedCandleSource(norm, state.candles?.[norm] || []);
  if (sourceState.blockingDelayed) return true;
  const fetched = getCandleFetchedAt(tf);
  const ageMinutes = (Date.now() - fetched) / (1000 * 60);

  if (norm === 'M1') return ageMinutes >= 2;
  if (norm === 'M5') return ageMinutes >= 5;
  if (norm === 'M15') return ageMinutes >= 5;
  if (norm === 'M30') return ageMinutes >= 10;
  if (norm === 'H1') return ageMinutes >= 15;
  if (norm === 'H4') return ageMinutes >= 60;
  if (norm === 'D1') return ageMinutes >= 240;
  return ageMinutes >= 240;
}"""
)

replace_js_function(
    market,
    'fetchTf',
    r"""export async function fetchTf(tf, { signal } = {}) {
  throwIfAborted(signal);
  try {
    const params = new URLSearchParams({
      symbol: 'XAU/USD',
      interval: TF[tf],
      outputsize: '300'
    });
    const response = await fetch(`${PROXY_URL}?${params.toString()}`, {
      cache: 'no-store',
      signal
    });
    if (!response.ok) throw new Error(`Market HTTP ${response.status}`);
    const data = await response.json();
    throwIfAborted(signal);
    if (data.status === 'error') throw new Error(data.message || 'Fetch gagal');
    assertBackendPayloadFresh(data, `Candle ${tf}`);

    const raw = (data.values || []).reverse();
    const closeCutoff = Date.now() - 10_000;
    const duration = timeframeDurationMs(tf);
    const candles = raw.map(c => ({
      time: new Date(c.datetime).getTime() / 1000,
      timeframe: tf,
      open: +c.open,
      high: +c.high,
      low: +c.low,
      close: +c.close,
      tickCount: 1,
      isClosed: false
    })).map(candle => ({
      ...candle,
      isClosed: Number.isFinite(candle.time)
        && duration > 0
        && candle.time * 1000 + duration <= closeCutoff
    })).filter(candle =>
      candle.isClosed
      && [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite)
      && candle.high >= Math.max(candle.open, candle.close, candle.low)
      && candle.low <= Math.min(candle.open, candle.close, candle.high)
    );

    if (!candles.length) throw new Error(`Candle ${tf} kosong`);
    const sourceState = assertCurrentClosedCandleSource(tf, candles);
    throwIfAborted(signal);
    state.candles[tf] = candles;
    state.candleSourceState = {
      ...(state.candleSourceState || {}),
      [tf]: sourceState
    };
    setCandleFetchedAt(tf, Date.now());
    return candles;
  } catch (err) {
    if (signal?.aborted) throw err;
    if (tf === 'M5' || tf === 'M15') {
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
        const sourceState = assertCurrentClosedCandleSource(tf, candles);
        state.candles[tf] = candles;
        state.candleSourceState = {
          ...(state.candleSourceState || {}),
          [tf]: sourceState
        };
        setCandleFetchedAt(tf, Date.now());
        return candles;
      }
    }
    throw err;
  }
}"""
)

replace_once(
    market,
    """    result.dataDegraded = refreshFailures.size > 0;
    result.dataWarnings = [...refreshFailures].filter(item => item !== tf);""",
    """    result.dataDegraded = refreshFailures.size > 0;
    result.dataWarnings = [...refreshFailures];
    result.candleSourceState = {
      ...(state.candleSourceState || {}),
      [tf]: inspectClosedCandleSource(tf, state.candles[tf] || [])
    };"""
)

core = 'app/src/main/assets/apps/mapping/js/integrity/mapping-integrity-core.js'
replace_js_function(
    core,
    'classifyBreak',
    r"""function normalizedBreakInfo(breakInfo) {
  if (!breakInfo || typeof breakInfo !== 'object') return null;
  const status = String(breakInfo.status || breakInfo.liveStatus || '').toUpperCase();
  const rawKind = String(breakInfo.kind || '').toUpperCase();
  const concept = String(
    breakInfo.concept || breakInfo.kind || 'STRUCTURE BREAK'
  ).toUpperCase();
  const direction = String(
    breakInfo.dir || breakInfo.direction || breakInfo.brokenSide || ''
  ).toUpperCase();
  const failed = Boolean(
    breakInfo.failed
    || breakInfo.breakType === 'BREAK_FAILED'
    || status === 'FAILED'
  );
  const sweepOnly = Boolean(
    breakInfo.sweepOnly
    || breakInfo.breakType === 'SWEEP_ONLY'
    || rawKind === 'LIQUIDITY_SWEEP'
    || rawKind === 'SWEEP'
  );
  const valid = Boolean(
    !failed
    && !sweepOnly
    && (
      breakInfo.breakType === 'VALID_BREAK'
      || (breakInfo.valid === true && status === 'CONFIRMED_BREAK')
    )
  );
  return {
    ...breakInfo,
    kind: sweepOnly ? 'SWEEP' : concept,
    dir: direction,
    price: number(breakInfo.price ?? breakInfo.level),
    failed,
    sweepOnly,
    valid,
    breakType: failed
      ? 'BREAK_FAILED'
      : sweepOnly
        ? 'SWEEP_ONLY'
        : valid
          ? 'VALID_BREAK'
          : 'BREAK_CANDIDATE'
  };
}

export function resolveBreakInfo(result) {
  const structure = result?.st || result?.marketConcepts?.structure || {};
  const snapshot = result?.marketConcepts?.structureSnapshot || {};
  const candidates = [
    structure.lastEvent,
    structure.last,
    result?.marketConcepts?.structure?.lastEvent,
    result?.marketConcepts?.structure?.last,
    snapshot.latestStructure,
    structure.lastConfirmedBreak,
    result?.marketConcepts?.structure?.lastConfirmedBreak
  ];
  for (const candidate of candidates) {
    const normalized = normalizedBreakInfo(candidate);
    if (normalized) return normalized;
  }
  return null;
}

export function classifyBreak(breakInfo, confirmedTrend = 'NEUTRAL') {
  const info = normalizedBreakInfo(breakInfo);
  if (!info) {
    return {
      state: 'WAIT',
      title: 'BELUM ADA BREAK TERKONFIRMASI',
      attempt: 'NONE',
      confirmedTrend,
      isConfirmed: false,
      explanation: 'Belum ada event BOS/MSS yang lolos pivot terkonfirmasi, candle close, penetrasi ATR, dan displacement.'
    };
  }
  const attempt = info.dir === 'BEARISH'
    ? 'BEARISH'
    : info.dir === 'BULLISH'
      ? 'BULLISH'
      : 'NONE';
  const liquidity = attempt === 'BEARISH'
    ? 'SSL'
    : attempt === 'BULLISH'
      ? 'BSL'
      : 'LIQUIDITY';
  if (info.failed) {
    return {
      state: 'FAILED',
      title: 'BREAK GAGAL DIPERTAHANKAN',
      attempt,
      confirmedTrend,
      isConfirmed: false,
      explanation: 'Break sebelumnya gagal dipertahankan karena harga kembali close melewati level konfirmasi.'
    };
  }
  if (info.sweepOnly) {
    return {
      state: 'SWEEP',
      title: `${liquidity} SWEEP — BELUM ADA BOS`,
      attempt,
      confirmedTrend,
      isConfirmed: false,
      explanation: `Harga menyapu ${liquidity} dengan wick, tetapi candle close kembali ke dalam struktur sehingga sweep tidak mengesahkan BOS.`
    };
  }
  if (info.valid) {
    return {
      state: 'CONFIRMED',
      title: `VALID ${info.kind || 'STRUCTURE BREAK'} ${attempt}`,
      attempt,
      confirmedTrend: attempt,
      isConfirmed: true,
      explanation: `Candle sudah close melewati level struktur${info.hasDisplacement ? ' dan didukung displacement' : ''}.`
    };
  }
  return {
    state: 'CANDIDATE',
    title: `BREAK CANDIDATE ${attempt}`,
    attempt,
    confirmedTrend,
    isConfirmed: false,
    explanation: 'Candle telah menguji atau melewati level, tetapi penetrasi ATR atau displacement belum memenuhi syarat break valid.'
  };
}"""
)

integrity = 'app/src/main/assets/apps/mapping/js/mapping-integrity.js'
replace_once(
    integrity,
    """  candleFreshness,
  classifyBreak,
  deriveBiasView,""",
    """  candleFreshness,
  classifyBreak,
  resolveBreakInfo,
  deriveBiasView,"""
)
replace_once(
    integrity,
    "import { SUPPORTED_MAPPING_TIMEFRAMES } from './engine/mapping-timeframes.js';",
    "import { SUPPORTED_MAPPING_TIMEFRAMES } from './engine/mapping-timeframes.js';\n"
    "import {\n"
    "  analyzeTimeframeSafely,\n"
    "  timeframeSourceSignature\n"
    "} from './engine/timeframe-analysis-contract.js';"
)

replace_js_function(
    integrity,
    'resultSignature',
    r"""function resultSignature(result) {
  const targets = (result?.activeLiquidityTargets || [])
    .map(item => `${item.type}:${Number(item.level).toFixed(2)}`)
    .join('|');
  const breakInfo = resolveBreakInfo(result);
  return [
    result?.tf,
    result?.bsl,
    result?.ssl,
    result?.bestSetup?.type,
    result?.bestSetup?.status,
    result?.setups?.length,
    breakInfo?.breakType,
    breakInfo?.eventId || breakInfo?.id || '',
    targets
  ].join('~');
}"""
)

replace_js_function(
    integrity,
    'breakMarkup',
    r"""function breakMarkup(result) {
  const info = resolveBreakInfo(result);
  const classification = classifyBreak(info, result?.st?.trend || 'NEUTRAL');
  const sourceState = result?.candleSourceState?.[result?.tf]
    || state.candleSourceState?.[result?.tf]
    || null;
  if (!info) {
    const delayed = sourceState?.delayed
      ? `<div class="warn">Candle ${safeText(result?.tf || state.tf)} tertunda ${sourceState.lagBars} bar. Status hanya berlaku sampai candle terakhir yang tersedia.</div>`
      : '';
    return `<section class="card integrity-break"><div class="kicker">VALID BREAK INFO</div><h2>${classification.title}</h2>${delayed}<div class="break-reason">${classification.explanation}</div></section>`;
  }
  const displacement = info.hasDisplacement
    ? classification.isConfirmed
      ? 'KUAT + TERKONFIRMASI'
      : 'KUAT, TETAPI BREAK BELUM SAH'
    : 'TIDAK CUKUP KUAT';
  const attemptLabel = classification.state === 'SWEEP'
    ? `${classification.attempt} ATTEMPT / LIQUIDITY SWEEP`
    : `${info.kind || 'STRUCTURE'} ${classification.attempt}`;
  return `<section class="card integrity-break ${classification.state.toLowerCase()}">
    <div class="kicker">VALID BREAK INFO</div>
    <h2>${safeText(classification.title)}</h2>
    <div class="integrity-break-grid">
      <div><small>Level yang diuji</small><strong>${p2(info.price)}</strong></div>
      <div><small>High / Low candle</small><strong>${p2(info.candleHigh)} / ${p2(info.candleLow)}</strong></div>
      <div><small>Candle close</small><strong>${p2(info.candleClose)}</strong></div>
      <div><small>Harga live</small><strong>${p2(state.price)}</strong></div>
      <div><small>Percobaan struktur</small><strong>${safeText(attemptLabel)}</strong></div>
      <div><small>Struktur terkonfirmasi</small><strong>${safeText(classification.confirmedTrend)}</strong></div>
      <div class="wide"><small>Displacement</small><strong>${safeText(displacement)} · body ratio ${p2(info.bodyRatio)}</strong></div>
    </div>
    ${sourceState?.delayed ? `<div class="warn">Provider candle tertunda ${sourceState.lagBars} bar. Break ini bukan pembacaan candle market terbaru.</div>` : ''}
    <div class="break-reason"><b>Kesimpulan:</b><br>${safeText(classification.explanation)}</div>
  </section>`;
}"""
)

replace_js_function(
    integrity,
    'miniAnalysis',
    r"""function miniAnalysis(tf) {
  return analyzeTimeframeSafely({
    timeframe: tf,
    candles: state.candles?.[tf] || [],
    analyze,
    currentPrice: Number(state.price || 0),
    htfCandles: {
      M1: state.candles?.M1,
      M5: state.candles?.M5,
      M15: state.candles?.M15,
      M30: state.candles?.M30,
      H1: state.candles?.H1,
      H4: state.candles?.H4,
      D1: state.candles?.D1,
      W1: state.candles?.W1
    },
    minimumCandles: 30
  });
}"""
)

replace_js_function(
    integrity,
    'mappingMarkup',
    r"""function mappingMarkup() {
  const timeframes = SUPPORTED_MAPPING_TIMEFRAMES;
  const rows = timeframes.map(tf => {
    const analysis = miniAnalysis(tf);
    if (analysis.status !== 'READY') {
      const detail = analysis.status === 'INSUFFICIENT_DATA'
        ? analysis.candleCount === 0
          ? 'Candle belum dimuat.'
          : `Hanya ${analysis.candleCount} candle; minimal ${analysis.minimumCandles}.`
        : `Analisis gagal meski ${analysis.candleCount} candle tersedia: ${analysis.error}`;
      const sourceLabel = analysis.sourceState?.delayed
        ? ` · provider tertinggal ${analysis.sourceState.lagBars} bar`
        : '';
      return `<article class="integrity-map-row"><div class="tf">${tf}</div><div class="empty">${safeText(detail + sourceLabel)}</div></article>`;
    }
    const result = analysis.result;
    const bias = deriveBiasView(result);
    const action = roleAction(tf, result);
    const ob = parseZone(concept(result, 'OB'), 'OB');
    const fvg = parseZone(concept(result, 'FVG'), 'FVG');
    const freshness = candleFreshness(
      qualityByInterval[TF[tf]] || state.candleMeta?.[TF[tf]],
      tf
    );
    const sourceFreshness = analysis.sourceState?.delayed
      ? { state: 'STALE', label: `TERTUNDA ${analysis.sourceState.lagBars} BAR` }
      : freshness;
    return `<article class="integrity-map-row ${tf === state.tf ? 'execution' : ''}">
      <div class="integrity-row-head"><strong class="tf">${tf}</strong><span class="role">${action.role}</span><span class="fresh ${sourceFreshness.state.toLowerCase()}">${sourceFreshness.label}</span></div>
      <div class="integrity-bias-grid">
        <div><small>Struktur lokal</small><strong class="${bias.local.toLowerCase()}">${bias.local}</strong></div>
        <div><small>Bias HTF</small><strong class="${bias.htf.toLowerCase()}">${bias.htf}</strong></div>
        <div><small>Keselarasan</small><strong>${bias.alignment}</strong></div>
        <div><small>Peran</small><strong>${action.action}</strong></div>
      </div>
      <div class="integrity-level-grid"><div><small>BSL aktif</small><strong>${result.bsl ? p2(result.bsl) : 'SUDAH TERSAPU / BELUM ADA'}</strong></div><div><small>SSL aktif</small><strong>${result.ssl ? p2(result.ssl) : 'SUDAH TERSAPU / BELUM ADA'}</strong></div></div>
      <div class="integrity-zone-grid"><div><small>Order Block</small>${zoneMarkup(ob, state.price)}</div><div><small>Fair Value Gap</small>${zoneMarkup(fvg, state.price)}</div></div>
    </article>`;
  }).join('');

  const activeQuality = qualityByInterval[TF[state.tf]] || state.candleMeta?.[TF[state.tf]];
  const engineCount = Array.isArray(state.candles?.[state.tf])
    ? state.candles[state.tf].filter(candle => candle?.isClosed !== false).length
    : 0;
  const sourceState = miniAnalysis(state.tf).sourceState;
  const qualityNote = activeQuality
    ? `${state.tf}: feed ${activeQuality.cleanCount}/${activeQuality.rawCount}; engine menerima ${engineCount} candle tertutup${activeQuality.frozenRemoved ? ` · ${activeQuality.frozenRemoved} candle beku dibuang` : ''}${activeQuality.duplicates ? ` · ${activeQuality.duplicates} duplikat dibuang` : ''}${sourceState?.delayed ? ` · provider tertinggal ${sourceState.lagBars} bar` : ''}.`
    : `${state.tf}: engine menerima ${engineCount} candle tertutup${sourceState?.delayed ? ` · provider tertinggal ${sourceState.lagBars} bar` : ''}.`;

  return `<section class="card integrity-mapping"><div class="kicker">ALL-TIMEFRAME MAPPING</div><h2>Struktur Lokal · Bias HTF · Status Closed Candle</h2><p class="integrity-quality-note">${safeText(qualityNote)}</p><div class="integrity-map-list">${rows}</div></section>`;
}"""
)

replace_js_function(
    integrity,
    'explanationMarkup',
    r"""function explanationMarkup(result) {
  const bias = deriveBiasView(result);
  const breakState = classifyBreak(resolveBreakInfo(result), bias.local);
  const active = filterActionableSetups(result?.setups || [], Date.now(), state.price);
  const guidance = executionGuidance(
    bias.htf,
    result?.premiumDiscountZone || result?.zone,
    active.length > 0
  );
  const target = result?.liquidityHierarchy?.drawTarget;
  const ob = parseZone(concept(result, 'OB'), 'OB');
  const fvg = parseZone(concept(result, 'FVG'), 'FVG');
  const location = result?.premiumDiscountZone || result?.zone || 'EQUILIBRIUM';
  const setupText = active.length
    ? `Ada ${active.length} setup ${result.tf} actionable. Setup utama: ${active[0].type}, area ${p2(active[0].entryLow)}–${p2(active[0].entryHigh)}, invalidasi ${p2(active[0].sl)}.`
    : `Tidak ada setup ${result.tf} actionable. Sequence yang belum lengkap, INVALID, atau RR di bawah 1:2 tidak dihitung aktif.`;
  const targetText = target
    ? `${target.type} ${p2(target.level)} masih aktif dan berada pada sisi harga yang benar.`
    : 'Tidak ada target BSL/SSL aktif yang masih valid pada sisi harga sekarang.';

  return `<section class="card integrity-explanation"><div class="kicker">PENJELASAN MAPPING</div><h2>Apa yang Sedang Terjadi?</h2><div class="integrity-explanation-body">
    <p><b>1. Konteks besar</b><br>Bias HTF: <b>${bias.htf}</b>. Struktur lokal ${result.tf}: <b>${bias.local}</b>. Hasil gabungan mesin: <b>${bias.composite}</b>, dengan kondisi <b>${bias.alignment}</b>.</p>
    <p><b>2. Lokasi harga</b><br>Harga ${p2(state.price)} berada di <b>${location}</b>. Bias tidak sama dengan perintah entry. ${safeText(guidance)}</p>
    <p><b>3. Konfirmasi struktur</b><br><b>${safeText(breakState.title)}</b>. ${safeText(breakState.explanation)}</p>
    <p><b>4. Likuiditas dan zona</b><br>${safeText(targetText)}<br>OB: ${ob ? `${ob.type} ${p2(ob.bottom)}–${p2(ob.top)} · ${zoneLiveStatus(ob, state.price)}` : 'tidak ada zona aktif di harga sekarang'}.<br>FVG: ${fvg ? `${fvg.type} ${p2(fvg.bottom)}–${p2(fvg.top)} · ${zoneLiveStatus(fvg, state.price)}` : 'tidak ada zona aktif di harga sekarang'}.</p>
    <p><b>5. Tindakan sekarang</b><br>${safeText(setupText)}</p>
    <p class="integrity-conclusion"><b>Kesimpulan</b><br>${active.length ? `<b>PANTAU SETUP ${safeText(result.tf)}</b> — tunggu harga masuk area dan hormati invalidasi.` : '<b>TUNGGU</b> — belum ada alasan yang cukup aman untuk entry.'}</p>
  </div></section>`;
}"""
)

replace_js_function(
    integrity,
    'patchHeaderFreshness',
    r"""function patchHeaderFreshness() {
  const connection = document.getElementById('conn');
  if (!connection) return;
  const sourceState = miniAnalysis(state.tf).sourceState;
  const freshness = sourceState?.delayed
    ? { state: 'STALE', label: `TERTUNDA ${sourceState.lagBars} BAR` }
    : candleFreshness(
      qualityByInterval[TF[state.tf]] || state.candleMeta?.[TF[state.tf]],
      state.tf
    );
  connection.textContent = '●';
  connection.classList.toggle('stale', freshness.state === 'STALE');
  connection.setAttribute(
    'aria-label',
    `${state.conn} · Mapping ${state.tf} ${freshness.label || freshness.state}`
  );
}"""
)

replace_js_function(
    integrity,
    'uiSignature',
    r"""function uiSignature() {
  const result = state.result;
  const candleSources = SUPPORTED_MAPPING_TIMEFRAMES
    .map(tf => timeframeSourceSignature(tf, state.candles?.[tf] || []))
    .join('|');
  return [
    resultSignature(result),
    Number(state.price || 0).toFixed(2),
    state.tab,
    document.querySelectorAll('details.disclosure').length,
    JSON.stringify(qualityByInterval),
    candleSources
  ].join('::');
}"""
)

freshness = 'app/src/main/assets/apps/mapping/js/closed-candle-freshness-adapter-v1.js'
replace_once(
    freshness,
    "import { state, p2 } from './main.js';",
    "import { state, p2 } from './main.js';\n"
    "import { inspectClosedCandleSource } from './engine/closed-candle-source-state.js';"
)

replace_js_function(
    freshness,
    'sourceContext',
    r"""function sourceContext(snapshot) {
  const authority = snapshot?.scalperAuthority || snapshot?.structure?.authority || {};
  const candidates = [
    authority.anchorTimeframe,
    ...(Array.isArray(authority.sources) ? authority.sources : []),
    'M15', 'M5', 'M1', 'M30', 'H1',
    state.tf
  ].filter(Boolean);

  for (const timeframe of [...new Set(candidates)]) {
    const candle = closedCandle(timeframe);
    if (candle) {
      return {
        sourceTf: timeframe,
        candle,
        sourceState: inspectClosedCandleSource(
          timeframe,
          state.candles?.[timeframe] || []
        )
      };
    }
  }
  const sourceTf = state.tf || 'M15';
  return {
    sourceTf,
    candle: null,
    sourceState: inspectClosedCandleSource(sourceTf, [])
  };
}"""
)

replace_js_function(
    freshness,
    'normalizedContext',
    r"""function normalizedContext() {
  const snapshot = window.AmyFXMappingClarity?.snapshot?.() || {};
  const structure = snapshot.structure || {};
  const direction = structure.direction === 'BULLISH'
    ? 'BUY'
    : structure.direction === 'BEARISH'
      ? 'SELL'
      : null;
  const { sourceTf, candle, sourceState } = sourceContext(snapshot);
  const result = state.result || {};
  const invalidation = positive(structure.invalidation);
  const bsl = positive(result.bsl);
  const ssl = positive(result.ssl);
  const watchLevel = direction === 'BUY' ? ssl : direction === 'SELL' ? bsl : null;
  const targetLevel = direction === 'BUY' ? bsl : direction === 'SELL' ? ssl : null;
  const watchType = direction === 'BUY' ? 'SSL' : direction === 'SELL' ? 'BSL' : null;
  const targetType = direction === 'BUY' ? 'BSL' : direction === 'SELL' ? 'SSL' : null;
  const currentPrice = positive(state.price) || positive(result.price);
  const directionLabel = direction
    ? String(structure.label || structure.direction || direction)
    : 'Arah scalping belum jelas';
  const trigger = direction === 'BUY'
    ? 'Tunggu SSL sweep → reclaim → MSS bullish → candle close.'
    : direction === 'SELL'
      ? 'Tunggu BSL sweep → reclaim → MSS bearish → candle close.'
      : 'Tunggu M15/M5/M1 membentuk arah dan struktur yang jelas.';
  const invalidationText = invalidation
    ? structure.rule || `Batal bila protected structure ${p2(invalidation)} ditembus oleh candle close.`
    : 'Protected structure belum tersedia; entry tetap WAIT.';

  return {
    snapshot,
    structure,
    direction,
    directionLabel,
    sourceTf,
    sourceText: wita(candle),
    sourceCandle: candle,
    sourceState,
    hasClosedCandle: Boolean(candle),
    sourceCurrent: Boolean(candle && sourceState?.current),
    sourceDelayed: Boolean(candle && sourceState?.delayed),
    currentPrice,
    watchLevel,
    watchType,
    targetLevel,
    targetType,
    trigger,
    invalidation,
    invalidationText
  };
}"""
)

replace_js_function(
    freshness,
    'patchFreshnessLabels',
    r"""function patchFreshnessLabels(context) {
  const connection = document.getElementById('conn');
  if (connection) {
    connection.dataset.analysisFreshness = context.sourceDelayed
      ? 'PROVIDER_DELAYED'
      : context.hasClosedCandle
        ? 'CLOSED_CANDLE'
        : 'UNAVAILABLE';
    connection.classList.toggle('stale', context.sourceDelayed);
  }

  document.querySelectorAll('#mapping-command-strip *').forEach(node => {
    if (node.children.length) return;
    const text = String(node.textContent || '').trim().toUpperCase();
    if (!['STALE', 'EXPIRED', 'DATA USANG'].includes(text)) return;
    node.textContent = context.sourceDelayed
      ? `CANDLE TERTUNDA ${context.sourceState?.lagBars || '?'} BAR`
      : context.hasClosedCandle
        ? 'CANDLE TERTUTUP'
        : 'MENUNGGU DATA';
    node.classList.remove('expired');
    node.classList.toggle('stale', context.sourceDelayed);
    node.classList.toggle('live', context.sourceCurrent);
    node.classList.toggle('waiting', !context.sourceCurrent);
  });
}"""
)

old_source = r"""  const source = context.hasClosedCandle
    ? `Basis candle terakhir tertutup · ${context.sourceTf} · ${context.sourceText}`
    : 'Belum ada candle tertutup yang dapat digunakan.';"""
new_source = r"""  const source = context.sourceDelayed
    ? `Basis candle terakhir tertutup · ${context.sourceTf} · ${context.sourceText} · provider tertinggal ${context.sourceState?.lagBars || '?'} bar`
    : context.hasClosedCandle
      ? `Basis candle terakhir tertutup · ${context.sourceTf} · ${context.sourceText}`
      : 'Belum ada candle tertutup yang dapat digunakan.';"""
replace_all(freshness, old_source, new_source, expected=2)
replace_all(
    freshness,
    "execution-freshness--${context.hasClosedCandle ? 'live' : 'waiting'}",
    "execution-freshness--${context.sourceCurrent ? 'live' : 'waiting'}",
    expected=2
)
replace_once(
    freshness,
    """    context.invalidation,
    context.hasClosedCandle
  ]);""",
    """    context.invalidation,
    context.hasClosedCandle,
    context.sourceCurrent,
    context.sourceState?.lagBars
  ]);"""
)

write(
    'tests/closed-candle-source-state.test.mjs',
    r"""import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertCurrentClosedCandleSource,
  inspectClosedCandleSource
} from '../app/src/main/assets/apps/mapping/js/engine/closed-candle-source-state.js';

function candles({ count = 300, latestOpen, stepSeconds = 900 }) {
  return Array.from({ length: count }, (_, index) => {
    const time = latestOpen - (count - 1 - index) * stepSeconds;
    const open = 4100 + index * 0.01;
    return {
      time,
      open,
      high: open + 1,
      low: open - 1,
      close: open + 0.3,
      isClosed: true
    };
  });
}

test('300 stale candles are not current merely because fetch completed now', () => {
  const nowMs = Date.UTC(2026, 7, 5, 5, 5, 0);
  const expected = 1785905100;
  const values = candles({ latestOpen: expected - 8 * 900 });
  const state = inspectClosedCandleSource('M15', values, { nowMs });
  assert.equal(state.count, 300);
  assert.equal(state.delayed, true);
  assert.equal(state.blockingDelayed, true);
  assert.equal(state.lagBars, 8);
  assert.throws(
    () => assertCurrentClosedCandleSource('M15', values, { nowMs }),
    /tertinggal 8 bar/
  );
});

test('current M15 closed candle is accepted', () => {
  const nowMs = Date.UTC(2026, 7, 5, 5, 5, 0);
  const expected = 1785905100;
  const state = inspectClosedCandleSource(
    'M15',
    candles({ latestOpen: expected }),
    { nowMs }
  );
  assert.equal(state.current, true);
  assert.equal(state.delayed, false);
  assert.equal(state.lagBars, 0);
});
"""
)

write(
    'tests/mapping-break-and-timeframe-truth.test.mjs',
    r"""import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyBreak,
  resolveBreakInfo
} from '../app/src/main/assets/apps/mapping/js/integrity/mapping-integrity-core.js';
import {
  analyzeTimeframeSafely
} from '../app/src/main/assets/apps/mapping/js/engine/timeframe-analysis-contract.js';

function series(count = 300) {
  return Array.from({ length: count }, (_, index) => {
    const open = 4000 + index * 0.1;
    return {
      time: 1_700_000_000 + index * 900,
      open,
      high: open + 1,
      low: open - 1,
      close: open + 0.4,
      isClosed: true
    };
  });
}

test('modern confirmed structure schema resolves as valid break', () => {
  const result = {
    st: {
      trend: 'BULLISH',
      lastEvent: {
        concept: 'BOS',
        direction: 'BULLISH',
        level: 4105.94,
        status: 'CONFIRMED_BREAK',
        valid: true,
        hasDisplacement: true
      }
    }
  };
  const info = resolveBreakInfo(result);
  const classification = classifyBreak(info, 'BULLISH');
  assert.equal(info.breakType, 'VALID_BREAK');
  assert.equal(info.price, 4105.94);
  assert.equal(classification.state, 'CONFIRMED');
  assert.match(classification.title, /VALID BOS BULLISH/);
});

test('break candidate is not falsely described as no candle close', () => {
  const classification = classifyBreak({
    concept: 'MSS',
    direction: 'BULLISH',
    level: 4105.94,
    status: 'BREAK_CANDIDATE',
    valid: false
  });
  assert.equal(classification.state, 'CANDIDATE');
  assert.match(classification.title, /BREAK CANDIDATE/);
  assert.doesNotMatch(classification.explanation, /Belum ada candle close/);
});

test('analysis exception with 300 candles is ANALYSIS_ERROR', () => {
  const state = analyzeTimeframeSafely({
    timeframe: 'M15',
    candles: series(),
    analyze() {
      throw new Error('synthetic engine failure');
    },
    currentPrice: 4135,
    minimumCandles: 30,
    nowMs: Date.UTC(2026, 7, 5, 5, 5, 0)
  });
  assert.equal(state.candleCount, 300);
  assert.equal(state.status, 'ANALYSIS_ERROR');
  assert.match(state.error, /synthetic engine failure/);
});

test('300 candles with successful analyzer produce READY', () => {
  const state = analyzeTimeframeSafely({
    timeframe: 'M15',
    candles: series(),
    analyze(values, tf) {
      return { tf, count: values.length, st: { trend: 'BULLISH' } };
    },
    currentPrice: 4135,
    minimumCandles: 30,
    nowMs: Date.UTC(2026, 7, 5, 5, 5, 0)
  });
  assert.equal(state.status, 'READY');
  assert.equal(state.result.count, 300);
});
"""
)

print('Mapping truth repair patch applied.')
