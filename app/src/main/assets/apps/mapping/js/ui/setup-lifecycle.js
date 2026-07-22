const LABELS = [
  ['sweep', 'LIQUIDITY SWEEP'],
  ['mss', 'MSS / CHOCH'],
  ['entry', 'FVG / OB'],
  ['trigger', 'ENTRY'],
  ['target', 'TARGET']
];

function has(value) {
  return value === true || Number(value) > 0 || /yes|valid|active|confirmed|fresh|strong/i.test(String(value || ''));
}

export function lifecycleState(setup, liveState) {
  const c = setup?.components || {};
  const se = setup?.setupExecution || liveState?.setupExecution || null;

  const status = String(se?.status || liveState?.status || setup?.status || 'WAIT');
  const stage = String(se?.lifecycleStage || liveState?.stage || '');
  const fatal = Boolean(se ? !se.active : liveState?.fatal) || /invalid|sl hit|expired|broken|missed|stopped/i.test(status);

  const sweep = has(c.sweep) || Boolean(se?.alignedWithForecast);
  const mss = sweep && (has(c.mss) || Boolean(se?.geometryValid));
  const poi = mss && (has(c.entry) || Boolean(se?.geometryValid) || /fvg|order block|ob/i.test(String(setup?.type || '')));
  const entered = poi && (Boolean(se?.entryTouched) || /entry touched|entry_active|tp1_secured|runner_active|target_hit/i.test(stage) || /dalam area|tp|entry aktif/i.test(status));
  const target = entered && (Boolean(se?.target1Secured) || /target_hit|tp1_secured|runner_active/i.test(stage) || /tp|target hit|completed/i.test(status));

  const values = [sweep, mss, poi, entered, target];
  const firstWaiting = values.findIndex(value => !value);
  return LABELS.map((item, index) => ({
    key: item[0], label: item[1],
    state: fatal && index >= Math.max(firstWaiting, 0) ? 'invalid' : values[index] ? 'confirmed' : index === firstWaiting ? 'active' : 'locked'
  }));
}

export function renderSetupLifecycle(setup, liveState) {
  const stages = lifecycleState(setup, liveState);
  return `<div class="setup-lifecycle" data-setup-lifecycle>${stages.map(stage => `
    <div class="lifecycle-step ${stage.state}">
      <span>${stage.state === 'confirmed' ? '✓' : stage.state === 'invalid' ? '×' : stage.state === 'active' ? '●' : '○'}</span>
      <small>${stage.label}</small>
    </div>`).join('')}</div>`;
}
