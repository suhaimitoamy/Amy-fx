(function () {
  'use strict';

  if (window.__amyFxDashboardOnlyPanelsV1Installed) return;
  window.__amyFxDashboardOnlyPanelsV1Installed = true;

  const PANEL_IDS = Object.freeze([
    'amy-regime-router-v3',
    'amy-entry-watch-card'
  ]);
  const nativeInsertAdjacentHTML = Element.prototype.insertAdjacentHTML;
  let cleanupScheduled = false;
  let blockedInsertions = 0;
  let removedFromAnalyze = 0;

  function currentView() {
    return String(window.state?.tab || localStorage.getItem('amy_mapping_tab') || 'Dashboard');
  }

  function isDashboardOnlyMarkup(markup) {
    const html = String(markup || '');
    return PANEL_IDS.some(id => html.includes(`id="${id}"`) || html.includes(`id='${id}'`));
  }

  function removePanel(node) {
    if (!node) return;
    const wrapper = node.closest('details.amy-analysis-section');
    if (wrapper && wrapper.contains(node)) wrapper.remove();
    else node.remove();
    removedFromAnalyze += 1;
  }

  function cleanupAnalyzeView() {
    cleanupScheduled = false;
    if (currentView() === 'Dashboard') return;

    PANEL_IDS.forEach(id => removePanel(document.getElementById(id)));

    document.querySelectorAll('#app > details.amy-analysis-section').forEach(wrapper => {
      const key = wrapper.dataset.stabilityKey || '';
      const summary = wrapper.querySelector(':scope > summary')?.textContent || '';
      if (key === 'market-context' || summary.includes('Ringkasan Market')) {
        wrapper.remove();
        removedFromAnalyze += 1;
      }
    });
  }

  function scheduleCleanup() {
    if (cleanupScheduled) return;
    cleanupScheduled = true;
    requestAnimationFrame(cleanupAnalyzeView);
  }

  Element.prototype.insertAdjacentHTML = function (position, markup) {
    if (currentView() !== 'Dashboard' && isDashboardOnlyMarkup(markup)) {
      blockedInsertions += 1;
      scheduleCleanup();
      return;
    }
    return nativeInsertAdjacentHTML.call(this, position, markup);
  };

  function start() {
    const app = document.getElementById('app');
    if (app) {
      new MutationObserver(scheduleCleanup).observe(app, {
        childList: true,
        subtree: true
      });
    }

    document.addEventListener('click', scheduleCleanup, true);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) scheduleCleanup();
    });
    window.addEventListener('amyfx:market-update', scheduleCleanup);
    window.addEventListener('amyfx:entry-watch-updated', scheduleCleanup);
    scheduleCleanup();
  }

  window.AmyFXDashboardOnlyPanels = Object.freeze({
    version: '1.0.0',
    stats: () => ({
      blockedInsertions,
      removedFromAnalyze,
      view: currentView()
    })
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
