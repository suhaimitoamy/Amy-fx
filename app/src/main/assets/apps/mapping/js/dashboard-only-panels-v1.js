(function () {
  'use strict';

  if (window.__amyFxDashboardOnlyPanelsV1Installed) return;
  window.__amyFxDashboardOnlyPanelsV1Installed = true;

  const PANEL_IDS = Object.freeze([
    'amy-regime-router-v3',
    'amy-entry-watch-card',
    'amy-scalper-entry-watch'
  ]);
  const DASHBOARD_ORDER = Object.freeze([
    '.tf-card',
    '.session-card',
    '#amy-regime-router-v3',
    '.setup-focus',
    '#amy-scalper-entry-watch',
    '[data-execution-plan-card="compact"]'
  ]);
  const nativeInsertAdjacentHTML = Element.prototype.insertAdjacentHTML;
  let cleanupScheduled = false;
  let blockedInsertions = 0;
  let removedFromAnalyze = 0;
  let reorderedDashboard = 0;

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

  function reorderDashboardPanels() {
    const app = document.getElementById('app');
    if (!app) return;

    const ordered = DASHBOARD_ORDER
      .map(selector => app.querySelector(`:scope > ${selector}`))
      .filter(Boolean);
    if (ordered.length < 2) return;

    const currentSelected = [...app.children].filter(node => ordered.includes(node));
    if (currentSelected.length === ordered.length && currentSelected.every((node, index) => node === ordered[index])) {
      return;
    }

    const selected = new Set(ordered);
    const children = [...app.children];
    const firstIndex = Math.min(...ordered.map(node => children.indexOf(node)).filter(index => index >= 0));
    const anchor = children.slice(firstIndex).find(node => !selected.has(node)) || null;
    const fragment = document.createDocumentFragment();
    ordered.forEach(node => fragment.appendChild(node));
    app.insertBefore(fragment, anchor);
    reorderedDashboard += 1;
  }

  function syncCurrentView() {
    cleanupScheduled = false;
    if (currentView() === 'Dashboard') {
      reorderDashboardPanels();
      return;
    }

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
    requestAnimationFrame(syncCurrentView);
  }

  Element.prototype.insertAdjacentHTML = function (position, markup) {
    if (currentView() !== 'Dashboard' && isDashboardOnlyMarkup(markup)) {
      blockedInsertions += 1;
      scheduleCleanup();
      return;
    }
    const result = nativeInsertAdjacentHTML.call(this, position, markup);
    scheduleCleanup();
    return result;
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
    window.addEventListener('amyfx:scalper-state-change', scheduleCleanup);
    window.addEventListener('amyfx:mapping-state-change', scheduleCleanup);
    scheduleCleanup();
  }

  window.AmyFXDashboardOnlyPanels = Object.freeze({
    version: '1.1.0',
    stats: () => ({
      blockedInsertions,
      removedFromAnalyze,
      reorderedDashboard,
      view: currentView()
    })
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
