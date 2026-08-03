from pathlib import Path

path = Path('app/src/main/assets/apps/mapping/js/execution-plan-core.js')
text = path.read_text(encoding='utf-8')


def replace_once(old, new, label):
    global text
    if old in text:
        text = text.replace(old, new, 1)
        return
    if new in text:
        return
    raise SystemExit(f'{label} anchor not found')


replace_once(
"""  const internalState = upper(
    supplied?.state
    || snapshot?.freshness?.state
    || (result?.dataStale ? 'STALE' : '')
    || 'UNKNOWN'
  );
  const closed = latestClosedCandle(input, result, snapshot);""",
"""  const internalState = upper(
    supplied?.state
    || snapshot?.freshness?.state
    || (result?.dataStale ? 'STALE' : '')
    || 'UNKNOWN'
  );
  const internalStale = /STALE/.test(internalState);
  const internalExpired = /EXPIRED/.test(internalState);
  const executable = !internalStale && !internalExpired;
  const closed = latestClosedCandle(input, result, snapshot);""",
'internal freshness flags'
)

replace_once(
"""      valid: true,
      stale: false,
      expired: false,
      label: 'CANDLE TERTUTUP',""",
"""      valid: true,
      executable,
      stale: internalStale,
      expired: internalExpired,
      label: 'CANDLE TERTUTUP',""",
'closed-candle freshness return'
)

replace_once(
"""      valid: true,
      stale: false,
      expired: false,
      label: 'ANALISIS TERAKHIR',""",
"""      valid: true,
      executable,
      stale: internalStale,
      expired: internalExpired,
      label: 'ANALISIS TERAKHIR',""",
'analysis-available freshness return'
)

replace_once(
"""    valid: false,
    stale: false,
    expired: false,
    label: 'BELUM TERSEDIA',""",
"""    valid: false,
    executable: false,
    stale: false,
    expired: false,
    label: 'BELUM TERSEDIA',""",
'unavailable freshness return'
)

replace_once(
"""function statusHeadline({
  decision,
  freshness,
  focusDirection,
  terminal,""",
"""function statusHeadline({
  decision,
  freshness,
  freshnessBlocked,
  focusDirection,
  terminal,""",
'headline signature'
)

replace_once(
"""}) {
  if (!freshness.valid) return 'WAIT — DATA MAPPING BELUM TERSEDIA';
  if (decision === 'BUY') return 'BUY — ENTRY SUDAH VALID';""",
"""}) {
  if (!freshness.valid) return 'WAIT — DATA MAPPING BELUM TERSEDIA';
  if (freshnessBlocked && freshness.expired) return 'WAIT — ANALISIS KEDALUWARSA';
  if (freshnessBlocked && freshness.stale) return 'WAIT — DATA MAPPING SUDAH LAMA';
  if (decision === 'BUY') return 'BUY — ENTRY SUDAH VALID';""",
'headline freshness gate'
)

old_complete = """  const complete = Boolean(
    freshness.valid
    && ACTIVE_DIRECTIONS.has(officialDirection)
    && execution?.active === true
    && execution?.terminal !== true
    && execution?.invalidated !== true
    && execution?.geometryValid === true
    && setup?.live !== false
    && watch?.active === true
    && watch?.entryAllowed === true
    && watch?.executionPlan?.locked === true
    && entryTriggered
    && aligned
    && !terminal
    && !targetOneSecured
    && levels.entry != null
    && hasEntryArea
    && levels.stopLoss != null
    && hasTargets
  );
  return {
    decision: complete ? officialDirection : 'WAIT',
    officialDirection,
    aligned,
    entryTriggered,
    complete,
    checks: {
      freshnessValid: freshness.valid,"""
new_complete = """  const completeWithoutFreshness = Boolean(
    ACTIVE_DIRECTIONS.has(officialDirection)
    && execution?.active === true
    && execution?.terminal !== true
    && execution?.invalidated !== true
    && execution?.geometryValid === true
    && setup?.live !== false
    && watch?.active === true
    && watch?.entryAllowed === true
    && watch?.executionPlan?.locked === true
    && entryTriggered
    && aligned
    && !terminal
    && !targetOneSecured
    && levels.entry != null
    && hasEntryArea
    && levels.stopLoss != null
    && hasTargets
  );
  const freshnessExecutable = Boolean(freshness.valid && freshness.executable !== false);
  const complete = Boolean(freshnessExecutable && completeWithoutFreshness);
  const freshnessBlocked = Boolean(
    freshness.valid
    && freshness.executable === false
    && completeWithoutFreshness
  );
  return {
    decision: complete ? officialDirection : 'WAIT',
    officialDirection,
    aligned,
    entryTriggered,
    complete,
    freshnessBlocked,
    checks: {
      freshnessValid: freshnessExecutable,
      analysisAvailable: freshness.valid,"""
replace_once(old_complete, new_complete, 'execution completeness split')

replace_once(
"""    decision: display.decision,
    freshness: display.freshness,
    focusDirection,""",
"""    decision: display.decision,
    freshness: display.freshness,
    freshnessBlocked: display.freshnessBlocked,
    focusDirection,""",
'headline call freshnessBlocked'
)

replace_once(
"""  const area = !display.freshness.valid
    ? {
        kind: 'UNAVAILABLE',
        low: null,
        high: null,
        level: null,
        source: null,
        label: 'Data Mapping belum tersedia.'
      }
    : display.terminal || display.targetOneSecured""",
"""  const area = !display.freshness.valid || display.freshnessBlocked
    ? {
        kind: 'UNAVAILABLE',
        low: null,
        high: null,
        level: null,
        source: null,
        label: display.freshnessBlocked
          ? (display.freshness.expired
              ? 'Analisis terakhir tetap ditampilkan, tetapi setup sudah kedaluwarsa.'
              : 'Analisis terakhir tetap ditampilkan, tetapi izin entry menunggu pembaruan candle.')
          : 'Data Mapping belum tersedia.'
      }
    : display.terminal || display.targetOneSecured""",
'blocked execution area'
)

replace_once(
"""  const reasons = [];
  if (focusDirection) reasons.push(`Arah yang sedang dipantau oleh Mapping: ${focusDirection}.`);""",
"""  const reasons = [];
  if (display.freshnessBlocked) {
    reasons.push(display.freshness.expired
      ? 'Freshness internal menandai setup kedaluwarsa; analisis terakhir tetap terlihat tetapi entry dinonaktifkan.'
      : 'Freshness internal menunggu pembaruan; analisis terakhir tetap terlihat tetapi entry dinonaktifkan.');
  }
  if (focusDirection) reasons.push(`Arah yang sedang dipantau oleh Mapping: ${focusDirection}.`);""",
'blocked execution reason'
)

replace_once(
"""  } else if (!display.freshness.valid) {
    conclusion = 'Tunggu candle tertutup tersedia sebelum mempertimbangkan entry.';
  } else if (display.terminal || display.targetOneSecured) {""",
"""  } else if (!display.freshness.valid) {
    conclusion = 'Tunggu candle tertutup tersedia sebelum mempertimbangkan entry.';
  } else if (display.freshnessBlocked) {
    conclusion = 'Arah Mapping terakhir tetap berlaku sebagai konteks, tetapi jangan entry sampai freshness internal kembali valid.';
  } else if (display.terminal || display.targetOneSecured) {""",
'blocked execution conclusion'
)

replace_once(
"""  const visibleTarget = display.terminal || display.targetOneSecured || !display.freshness.valid
    ? { type: null, subtype: null, level: null }""",
"""  const visibleTarget = display.terminal
    || display.targetOneSecured
    || !display.freshness.valid
    || display.freshnessBlocked
    ? { type: null, subtype: null, level: null }""",
'blocked execution target'
)

path.write_text(text, encoding='utf-8')
print('execution freshness display/execution split applied')
