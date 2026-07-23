(function () {
  'use strict';

  const APP_ID = 'app';
  const ANALYZE_TAB = 'Analyze';
  const MIN_RESTORE_Y = 120;
  const MAX_RESTORE_DELAY = 180;
  let lastStableY = 0;
  let lastUserScrollAt = 0;
  let navigationLockUntil = 0;
  let restoreTimer = 0;
  let mutationQueued = false;

  function currentTab() {
    return window.state?.tab || localStorage.getItem('amy_mapping_tab') || '';
  }

  function rememberScroll() {
    lastStableY = window.scrollY || 0;
    lastUserScrollAt = Date.now();
  }

  function markNavigation() {
    navigationLockUntil = Date.now() + 1000;
  }

  function shouldRestore() {
    if (currentTab() !== ANALYZE_TAB) return false;
    if (Date.now() < navigationLockUntil) return false;
    if (lastStableY < MIN_RESTORE_Y) return false;
    return Date.now() - lastUserScrollAt < 120_000;
  }

  function restorePosition() {
    mutationQueued = false;
    if (!shouldRestore()) return;
    const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const target = Math.min(lastStableY, maxY);
    if (Math.abs((window.scrollY || 0) - target) < 24) return;
    window.scrollTo({ top: target, left: 0, behavior: 'auto' });
  }

  function queueRestore() {
    if (mutationQueued || !shouldRestore()) return;
    mutationQueued = true;
    clearTimeout(restoreTimer);
    requestAnimationFrame(() => {
      restoreTimer = window.setTimeout(restorePosition, MAX_RESTORE_DELAY);
    });
  }

  function installObserver() {
    const app = document.getElementById(APP_ID);
    if (!app) return;
    new MutationObserver(queueRestore).observe(app, {
      childList: true,
      subtree: true
    });
  }

  window.addEventListener('scroll', rememberScroll, { passive: true });
  document.addEventListener('touchmove', rememberScroll, { passive: true });
  document.addEventListener('pointerdown', event => {
    if (event.target.closest('.nav, .tf-grid, [data-tab], button[onclick*="runAnalysis"]')) {
      markNavigation();
    } else {
      rememberScroll();
    }
  }, true);

  window.addEventListener('hashchange', markNavigation);
  window.addEventListener('popstate', markNavigation);
  window.addEventListener('amyfx:entry-watch-updated', queueRestore);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installObserver, { once: true });
  } else {
    installObserver();
  }
})();
