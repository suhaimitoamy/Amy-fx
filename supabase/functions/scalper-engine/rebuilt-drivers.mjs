import { normalizeCandles, wilderAtr, latestConfirmedSwing } from './candles.mjs';

// New rules are isolated from historical BT6 setups and their lifecycle.
export const REBUILD_VERSION = 'STRUCTURAL-2026-09-V1';
export const REBUILT_DRIVERS = Object.freeze(['RETEST_BOS', 'RANGE_EXPANSION', 'AMD', 'DISCIPLINE_SCALPER']);
const SECONDS = { M5: 300, M15: 900, M30: 1800, H1: 3600, H4: 14400 };
const signOf = direction => direction === 'BUY' ? 1 : -1;
const body = c => Math.abs(c.close - c.open);
const strength = (c, sign) => (sign > 0 ? c.close - c.low : c.high - c.close) / Math.max(c.high - c.low, 1e-9);
const high = rows => Math.max(...rows.map(c => c.high));
const low = rows => Math.min(...rows.map(c => c.low));
const contiguous = (rows, seconds) => rows.every((c, i) => c.close_time === c.open_time + seconds && (!i || c.open_time === rows[i - 1].close_time));
const aligned = (c, sign) => (c.close - c.open) * sign > 0;

export function rebuiltGeometry(candidate, entry = candidate?.quality?.planned_entry_price) {
  const q = candidate?.quality || {}, sign = signOf(candidate?.direction);
  if (!['BUY', 'SELL'].includes(candidate?.direction) || entry == null || candidate?.stop_reference == null || candidate?.atr_at_signal == null) return null;
  entry = Number(entry);
  const reference = Number(candidate.stop_reference), atr = Number(candidate.atr_at_signal);
  const stop = reference - sign * atr * .18;
  const risk = (entry - stop) * sign;
  const target = q.liquidity_target == null ? entry + sign * 20 : Number(q.liquidity_target);
  const reward = (target - entry) * sign;
  const minimumRR = candidate.driver_id === 'DISCIPLINE_SCALPER' ? 1.5 : 1;
  if (![entry, reference, atr, stop, risk, target, reward].every(Number.isFinite) || atr <= 0 || (entry - reference) * sign <= 0 || risk <= 0 || risk > 50 || reward / risk < minimumRR) return null;
  return { entry, stop, risk, target, reward_r: reward / risk };
}

export function detectRebuiltCandidates({ driver, timeframe, rows, h1, series, minSignalTime, buildCandidate }) {
  const seconds = SECONDS[timeframe], values = normalizeCandles(rows, seconds), atr = wilderAtr(values), out = [];
  function emit(direction, signalIndex, anchor, bottom, top, stop, quality = {}, status = 'WAITING_NEXT_OPEN') {
    const c = values[signalIndex];
    if (c.close_time < minSignalTime || !(atr[signalIndex] > 0)) return;
    const candidate = buildCandidate({ driver, timeframe, direction, signal: c, anchor, bottom, top, stopReference: stop, atrValue: atr[signalIndex], h1,
      reason: `${driver.name}: confirmed structure, causal entry and bounded reward/risk`, status,
      quality: { ...quality, rebuild_version: REBUILD_VERSION, structural_confirmation: true,
        planned_entry_price: quality.planned_entry_price ?? c.close,
        entry_model: status === 'WAITING_TRIGGER' ? (quality.entry_model || 'STRUCTURAL_LIMIT') : 'NEXT_OPEN',
        entry_deadline: c.close_time + (status === 'WAITING_TRIGGER' ? Math.min(4 * seconds, 14400) : 900),
        lifecycle_policy: 'STRUCTURAL_V1', max_hold_seconds: 86400, break_even_enabled: false }
    });
    if (candidate) out.push(candidate);
  }
  // A break owns exactly its first touch. A failed touch or close back through
  // the level consumes it; a later bounce cannot resurrect the same breakout.
  function firstRetest(i, direction, level, anchor, invalidation) {
    const sign = signOf(direction);
    for (let j = i + 1; j < values.length && j <= i + 4; j++) {
      const c = values[j];
      if (!contiguous(values.slice(i, j + 1), seconds)) break;
      if ((c.close - level) * sign <= 0 || (sign > 0 ? c.low <= invalidation : c.high >= invalidation)) break;
      const touch = c.low <= level && c.high >= level;
      if (!touch) continue;
      if (aligned(c, sign) && strength(c, sign) >= .65) {
        const width = atr[j] * .08;
        emit(direction, j, anchor, level - width, level + width, sign > 0 ? c.low : c.high,
          { first_retest: true, break_candle_open_time: values[i].open_time, structure_level: level });
      }
      break;
    }
  }
  if (driver.id === 'RETEST_BOS') {
    const used = new Set();
    for (let i = 16; i < values.length; i++) {
      const c = values[i];
      for (const direction of ['BUY', 'SELL']) {
        const sign = signOf(direction), kind = sign > 0 ? 'HIGH' : 'LOW';
        const pivot = latestConfirmedSwing(values, i - 1, 2, kind);
        if (!pivot || used.has(`${kind}:${pivot.time}`)) continue;
        // Only the first crossing after pivot confirmation can be a BOS.
        if (!((c.close - pivot.price) * sign > 0)) continue;
        used.add(`${kind}:${pivot.time}`);
        if (values.slice(pivot.confirmed_index + 1, i).some(x => (x.close - pivot.price) * sign > 0)) continue;
        if (!aligned(c, sign) || body(c) < atr[i] * .6 || strength(c, sign) < .7) continue;
        const opposite = latestConfirmedSwing(values, i - 1, 2, sign > 0 ? 'LOW' : 'HIGH');
        if (!opposite) continue;
        firstRetest(i, direction, pivot.price, `BOS4:${pivot.time}:${c.open_time}`, opposite.price);
      }
    }
  } else if (driver.id === 'RANGE_EXPANSION') {
    for (let i = 27; i < values.length; i++) {
      const compression = values.slice(i - 6, i), baseline = values.slice(i - 26, i - 6), c = values[i];
      if (!contiguous(values.slice(i - 6, i + 1), seconds)) continue;
      const top = high(compression), bottom = low(compression);
      const average = list => list.reduce((s, x) => s + x.high - x.low, 0) / list.length;
      if (average(compression) > average(baseline) * .7 || top - bottom > atr[i - 1] * 2) continue;
      const direction = c.close > top ? 'BUY' : c.close < bottom ? 'SELL' : null;
      if (!direction) continue;
      const sign = signOf(direction);
      if (!aligned(c, sign) || body(c) < atr[i] * .6 || strength(c, sign) < .7) continue;
      firstRetest(i, direction, sign > 0 ? top : bottom, `RANGE4:${compression[0].open_time}:${c.open_time}`, sign > 0 ? bottom : top);
    }
  } else if (driver.id === 'AMD') {
    const windows = timeframe === 'M30' ? [6, 8, 12] : [4, 6, 8];
    for (let i = 15; i < values.length - 2; i++) {
      const m = values[i], a = atr[i];
      if (!(a > 0)) continue;
      const accumulation = windows.map(n => values.slice(i - n, i)).find(part => contiguous(part, seconds) && (high(part) - low(part)) / a >= 2 && (high(part) - low(part)) / a <= 3);
      if (!accumulation) continue;
      const top = high(accumulation), bottom = low(accumulation);
      // Sweeping both boundaries is ambiguous, even when only one exceeds .03 ATR.
      if (m.high > top && m.low < bottom) continue;
      const direction = m.low < bottom - .03 * a && m.close > bottom && m.close < top ? 'BUY'
        : m.high > top + .03 * a && m.close < top && m.close > bottom ? 'SELL' : null;
      if (!direction) continue;
      const sign = signOf(direction), extreme = sign > 0 ? m.low : m.high;
      for (let j = i + 2; j < values.length && j <= i + 6; j++) {
        const part = values.slice(i + 1, j + 1);
        if (!contiguous(values.slice(i, j + 1), seconds) || part.some(c => sign > 0 ? c.low <= extreme : c.high >= extreme)) break;
        const first = values[j - 2], distribution = values[j - 1], confirmation = values[j];
        const fb = sign > 0 ? first.high : confirmation.high, ft = sign > 0 ? confirmation.low : first.low;
        if (!(ft > fb) || !aligned(distribution, sign) || body(distribution) < atr[j - 1] * .5 || strength(distribution, sign) < .65) continue;
        if ((distribution.close - (sign > 0 ? m.high : m.low)) * sign <= 0 || (distribution.close - (top + bottom) / 2) * sign <= 0) continue;
        const midpoint = (fb + ft) / 2;
        emit(direction, j, `AMD4:${m.open_time}`, fb, ft, extreme, {
          accumulation_window: accumulation.length, manipulation_extreme: extreme, manipulation_open_time: m.open_time,
          distribution_open_time: distribution.open_time, fvg_midpoint: midpoint, planned_entry_price: midpoint,
          entry_model: 'FVG_MIDPOINT_LIMIT', feature_candle_open_time: distribution.open_time
        }, 'WAITING_TRIGGER');
        break;
      }
    }
  } else if (driver.id === 'DISCIPLINE_SCALPER') {
    const h4 = normalizeCandles(series.H4 || [], 14400), m15 = normalizeCandles(series.M15 || [], 900);
    for (let i = 15; i < values.length - 1; i++) {
      const sweep = values[i], context = h4.filter(c => c.close_time <= sweep.open_time).slice(-50);
      if (context.length < 20) continue;
      let ema = context[0].close, previousEma = ema;
      for (const c of context.slice(1)) { previousEma = ema; ema += (c.close - ema) * 2 / 21; }
      const direction = context.at(-1).close > ema && ema > previousEma ? 'BUY' : context.at(-1).close < ema && ema < previousEma ? 'SELL' : null;
      if (!direction) continue;
      const sign = signOf(direction), day = Math.floor(sweep.open_time / 86400) * 86400;
      const previous = h4.filter(c => c.open_time >= day - 86400 && c.close_time <= day);
      const asiaEnd = sweep.open_time >= day + 21600 ? day + 21600 : day - 86400 + 21600;
      const asia = m15.filter(c => c.open_time >= asiaEnd - 28800 && c.close_time <= asiaEnd);
      const levels = [];
      if (previous.length === 6 && contiguous(previous, 14400)) levels.push({ name: 'PDH', p: high(previous), side: 'HIGH' }, { name: 'PDL', p: low(previous), side: 'LOW' });
      if (asia.length === 32 && contiguous(asia, 900)) levels.push({ name: 'ASIA_HIGH', p: high(asia), side: 'HIGH' }, { name: 'ASIA_LOW', p: low(asia), side: 'LOW' });
      for (const level of levels) {
        if (level.side !== (sign > 0 ? 'LOW' : 'HIGH')) continue;
        const extreme = sign > 0 ? sweep.low : sweep.high;
        if ((level.p - extreme) * sign <= 0 || (sweep.close - level.p) * sign <= 0 || Math.abs(level.p - extreme) > atr[i] * .5) continue;
        for (let j = i + 1; j < values.length && j <= i + 4; j++) {
          const c = values[j];
          if (!contiguous(values.slice(i, j + 1), seconds) || (sign > 0 ? c.low <= extreme : c.high >= extreme)) break;
          if (!aligned(c, sign) || (c.close - (sign > 0 ? sweep.high : sweep.low)) * sign <= 0 || body(c) < atr[j] * .5 || strength(c, sign) < .65) continue;
          const target = levels.map(l => l.p).filter(p => (p - level.p) * sign > 0).sort((a, b) => Math.abs(a - level.p) - Math.abs(b - level.p))[0];
          if (target == null) break;
          emit(direction, j, `DISCIPLINE4:${sweep.open_time}:${level.name}`, level.p - atr[j] * .08, level.p + atr[j] * .08, extreme,
            { liquidity_target: target, planned_entry_price: level.p, liquidity_name: level.name, h4_close_time: context.at(-1).close_time,
              sweep_open_time: sweep.open_time, confirmation_open_time: c.open_time, entry_model: 'LIQUIDITY_RETEST_LIMIT' }, 'WAITING_TRIGGER');
          break;
        }
      }
    }
  }
  return out;
}
