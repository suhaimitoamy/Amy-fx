function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function directionOf(event, isBsl = false, isSsl = false) {
  const value = event?.direction ?? event?.dir ?? event?.directionValue;
  if (value === 1 || String(value).toUpperCase().includes('BULL') || String(value).toUpperCase() === 'BUY') return 'BULLISH';
  if (value === -1 || String(value).toUpperCase().includes('BEAR') || String(value).toUpperCase() === 'SELL') return 'BEARISH';
  if (isBsl) return 'BEARISH';
  if (isSsl) return 'BULLISH';
  return 'NEUTRAL';
}

function eventLevel(event) {
  return number(event?.level ?? event?.price ?? event?.brokenLevel ?? event?.broken_level);
}

export function classifySweepAcceptance({ amySmcD = null, sourceCandle = null } = {}) {
  const descriptive = amySmcD?.descriptive || {};
  const predictive = amySmcD?.predictive || {};
  const candle = sourceCandle || amySmcD?.sourceCandle || {};
  const rawSweep = descriptive?.liquidity?.rawSweep || predictive?.sweepContinuation?.rawSweep || null;
  const validBreak = predictive?.qualifiedValidBreak || predictive?.rawValidBreak || null;

  if (rawSweep) {
    const level = eventLevel(rawSweep);
    const close = number(candle?.close);
    const side = String(rawSweep?.side || rawSweep?.liquiditySide || rawSweep?.kind || rawSweep?.type || rawSweep?.label || rawSweep?.pool || '').toUpperCase();
    const isBsl = side.includes('BSL') || side.includes('HIGH') || side === 'BUY' || side.includes('BUY_SIDE') || side.includes('PDH') || side.includes('PWH') || side.includes('EQH');
    const isSsl = side.includes('SSL') || side.includes('LOW') || side === 'SELL' || side.includes('SELL_SIDE') || side.includes('PDL') || side.includes('PWL') || side.includes('EQL');
    const reclaimed = (level == null || close == null)
      ? false
      : isBsl
        ? close < level
        : isSsl
          ? close > level
          : false;
    return {
      state: reclaimed ? 'SWEEP_REJECTION' : 'SWEEP_UNCONFIRMED',
      label: reclaimed ? 'Sweep + Rejection' : 'Sweep belum reclaim',
      direction: directionOf(rawSweep, isBsl, isSsl),
      level,
      authority: 'CONTEXT_ONLY',
      entryAuthority: false,
      source: 'AMY_SMC_D_LIQUIDITY',
      summary: reclaimed
        ? 'Liquidity sudah diambil dan candle kembali ke sisi level; tunggu displacement/MSS/retest sebelum entry.'
        : 'Liquidity tersapu tetapi reclaim belum cukup jelas; konteks tetap menunggu.'
    };
  }

  if (validBreak) {
    const direction = directionOf(validBreak);
    const level = eventLevel(validBreak);
    return {
      state: predictive?.qualifiedValidBreak ? 'BREAK_ACCEPTANCE' : 'BREAK_CANDIDATE',
      label: predictive?.qualifiedValidBreak ? 'Break + Acceptance' : 'Break terdeteksi',
      direction,
      level,
      authority: 'CONTEXT_ONLY',
      entryAuthority: false,
      source: predictive?.qualifiedValidBreak ? 'AMY_SMC_D_QUALIFIED_VALID_BREAK' : 'AMY_SMC_D_RAW_VALID_BREAK',
      summary: predictive?.qualifiedValidBreak
        ? 'Break sudah lolos qualifier baseline; tunggu retest/continuation evidence, bukan mengejar candle break.'
        : 'Break raw sudah terlihat tetapi belum lolos qualifier; jangan diperlakukan sebagai acceptance final.'
    };
  }

  return {
    state: 'WAITING_LEVEL_REACTION',
    label: 'Menunggu reaksi level',
    direction: 'NEUTRAL',
    level: null,
    authority: 'CONTEXT_ONLY',
    entryAuthority: false,
    source: 'AMY_SMC_D',
    summary: 'Belum ada sweep/rejection atau break/acceptance baru. Context struktur dan level tetap aktif.'
  };
}

export function createThrottledStatePersister(storageKey, minIntervalMs = 3000, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  let lastPersistTime = 0;
  let lastSavedSignature = '';
  let pendingTimer = null;
  let pendingValue = null;

  function flush() {
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
    if (pendingValue !== null) {
      const val = pendingValue;
      pendingValue = null;
      try {
        storage?.setItem(storageKey, JSON.stringify(val));
        lastPersistTime = Date.now();
      } catch (_) {}
    }
  }

  function save(value, signature, immediate = false) {
    if (!value) return false;
    const sig = signature !== undefined ? signature : JSON.stringify(value);
    if (sig === lastSavedSignature) {
      return false;
    }
    lastSavedSignature = sig;
    pendingValue = value;

    const now = Date.now();
    const elapsed = now - lastPersistTime;

    if (immediate || elapsed >= minIntervalMs) {
      flush();
      return true;
    }

    if (!pendingTimer) {
      pendingTimer = setTimeout(() => {
        flush();
      }, minIntervalMs - elapsed);
    }
    return false;
  }

  function cancel() {
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
    pendingValue = null;
  }

  return {
    save,
    flush,
    cancel,
    getLastSavedSignature: () => lastSavedSignature,
    getLastPersistTime: () => lastPersistTime
  };
}

