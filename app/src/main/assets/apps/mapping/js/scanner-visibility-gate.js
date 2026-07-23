(function () {
  'use strict';

  const STORAGE_KEY = 'amy_entry_watch_state_v3';
  let desiredWatch = null;
  let lastAppliedKey = '';

  function readStoredWatch() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch (_) {
      return null;
    }
  }

  function price(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(2) : '0';
  }

  function shouldScan(watch) {
    return Boolean(
      watch?.active
      && !watch?.terminal
      && !watch?.entryAllowed
      && ['WATCHING_LEVEL', 'LEVEL_TESTING'].includes(String(watch?.lifecycleStage || ''))
      && Number(watch?.level) > 0
    );
  }

  function stopScanner() {
    if (lastAppliedKey === 'STOPPED') return;
    lastAppliedKey = 'STOPPED';
    window.Android?.stopBackgroundScanner?.();
  }

  function applyScannerState() {
    const watch = desiredWatch || readStoredWatch();
    if (!document.hidden || !shouldScan(watch)) {
      stopScanner();
      return;
    }

    const upper = watch.direction === 'SELL' ? Number(watch.level) : 0;
    const lower = watch.direction === 'BUY' ? Number(watch.level) : 0;
    const key = `${watch.id || 'WATCH'}:${watch.direction}:${price(watch.level)}`;
    if (key === lastAppliedKey) return;

    lastAppliedKey = key;
    window.Android?.startBackgroundScanner?.('amyfx-proxy', String(upper), String(lower));
  }

  window.addEventListener('amyfx:entry-watch-updated', event => {
    desiredWatch = event.detail?.watch || null;
    applyScannerState();
  });

  document.addEventListener('visibilitychange', applyScannerState);
  window.addEventListener('pageshow', applyScannerState);
  window.addEventListener('pagehide', applyScannerState);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyScannerState, { once: true });
  } else {
    applyScannerState();
  }
})();
