const LABELS = [
  ['sweep', 'LIQUIDITY SWEEP'],
  ['mss', 'MSS / CHOCH'],
  ['entry', 'FVG / OB'],
  ['trigger', 'ENTRY'],
  ['target', 'TARGET']
];

export function lifecycleState(setup, liveState) {
  const se = setup?.setupExecution || liveState?.setupExecution || null;
  const stage = String(se?.lifecycleStage || '');
  const fatal = Boolean(se ? !se.active : liveState?.fatal) || /invalid|sl hit|expired|broken|missed|stopped|replaced|stale/i.test(stage);

  const sweep = Boolean(se?.alignedWithForecast) || (se && stage !== 'FORECAST_INVALIDATED');
  const mss = sweep && (Boolean(se?.geometryValid) || (se && stage !== 'INVALID_GEOMETRY'));
  const poi = mss && (se ? se.entryLow != null : true);
  const entered = poi && (Boolean(se?.entryTouched) || ['ENTRY_ACTIVE', 'TP1_SECURED', 'RUNNER_ACTIVE', 'TARGET_HIT'].includes(stage));
  const target = entered && (Boolean(se?.target1Secured) || ['TARGET_HIT', 'TP1_SECURED', 'RUNNER_ACTIVE'].includes(stage));

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
