(function () {
  'use strict';

  if (window.__amyFxStableAnalysisUiV4Installed) return;
  window.__amyFxStableAnalysisUiV4Installed = true;

  const MARKET_CONTEXT_KEY = 'market-context';
  let scheduled = false;
  let applying = false;
  let observer = null;

  function currentTab() {
    return window.state?.tab || localStorage.getItem('amy_mapping_tab') || '';
  }

  function installStaticStyle() {
    if (document.getElementById('amyfx-static-analysis-layout')) return;
    const style = document.createElement('style');
    style.id = 'amyfx-static-analysis-layout';
    style.textContent = `
      #app[data-analysis-static="true"] > details,
      #app[data-analysis-static="true"] details.amy-analysis-section,
      #app[data-analysis-static="true"] details.disclosure {
        display: block;
      }
      #app[data-analysis-static="true"] details > summary {
        cursor: default;
        user-select: text;
        pointer-events: none;
      }
      #app[data-analysis-static="true"] details > summary::-webkit-details-marker {
        display: none;
      }
      #app[data-analysis-static="true"] details > summary::marker {
        content: '';
      }
      #app[data-analysis-static="true"] details > summary::after {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function forceStaticDisclosure(details) {
    if (!details) return;
    details.removeAttribute('name');
    details.open = true;
    details.dataset.amyStaticAnalysis = 'true';

    const summary = details.querySelector(':scope > summary');
    if (summary) {
      summary.setAttribute('aria-disabled', 'true');
      summary.setAttribute('tabindex', '-1');
    }

    if (details.dataset.amyStaticBound === 'true') return;
    details.dataset.amyStaticBound = 'true';

    details.addEventListener('toggle', () => {
      if (!details.open) details.open = true;
    });

    summary?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      details.open = true;
    }, true);
  }

  function removeDashboardDuplicates() {
    if (currentTab() !== 'Dashboard') return;
    document.querySelector('.mapping-hero')?.remove();
    document.querySelectorAll('#app > section.card').forEach(section => {
      if ((section.textContent || '').includes('AMY FX v1.5 PREVIEW AKTIF')) section.remove();
    });
  }

  function qualityState(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return String(value.state || value.status || value.label || '');
  }

  function isM15Stale() {
    const result = window.state?.result;
    if (result?.dataStale) return true;
    const connection = document.getElementById('conn');
    const freshness = String(connection?.dataset?.analysisFreshness || '').toUpperCase();
    if (freshness === 'STALE' || freshness === 'EXPIRED') return true;
    const quality = window.AmyMappingIntegrity?.qualityByInterval || {};
    const m15 = quality['15min'] || quality.M15 || quality.m15;
    const status = qualityState(m15).toUpperCase();
    return status.includes('STALE') || status.includes('USANG');
  }

  function updateAnalysisBadge(card) {
    const badge = card?.querySelector('.regime-badge');
    if (!badge) return;
    const stale = isM15Stale();
    const text = stale ? 'M15 STALE' : 'M15 LIVE';
    if (badge.textContent !== text) badge.textContent = text;
    badge.classList.toggle('stale', stale);
    badge.classList.toggle('live', !stale);
    badge.setAttribute('aria-label', stale ? 'Data candle M15 sedang usang' : 'Data candle M15 aktif');
  }

  function removeHistoricalReliability(card) {
    if (!card) return;

    card.querySelectorAll('.amy-reliability-disclosure').forEach(node => node.remove());

    [...card.querySelectorAll('.market-health-title')].forEach(title => {
      if (title.querySelector('span')?.textContent?.trim() !== 'RELIABILITAS HISTORIS') return;
      const grid = title.nextElementSibling;
      if (grid?.classList.contains('reliability-grid')) grid.remove();
      title.remove();
    });

    card.querySelectorAll('details.professional-disclosure').forEach(details => {
      const summary = details.querySelector(':scope > summary')?.textContent || '';
      if (summary.includes('Performa Historis Model')) details.remove();
    });
  }

  function ensureMarketContextDisclosure(card) {
    if (!card || currentTab() !== 'Analyze') return;
    const currentParent = card.parentElement;
    if (currentParent?.classList.contains('amy-analysis-section')) {
      currentParent.dataset.stabilityKey = MARKET_CONTEXT_KEY;
      forceStaticDisclosure(currentParent);
      updateAnalysisBadge(card);
      return;
    }

    const details = document.createElement('details');
    details.className = 'card amy-analysis-section';
    details.dataset.stabilityKey = MARKET_CONTEXT_KEY;
    details.open = true;
    details.innerHTML = '<summary><span>Ringkasan Market</span><small>Struktur, arah, dan skenario</small></summary>';
    card.before(details);
    details.appendChild(card);
    forceStaticDisclosure(details);
    updateAnalysisBadge(card);
  }

  function stableKeyForSummary(text) {
    const value = String(text || '').trim();
    if (value.startsWith('Market Outlook') || value.startsWith('Amy Market Outlook')) return 'market-outlook';
    if (value.startsWith('Valid Break')) return 'valid-break';
    if (value.startsWith('Mapping Semua Timeframe') || value.startsWith('Mapping M1–H4')) return 'mapping-all-timeframes';
    if (value.startsWith('Penjelasan Mapping')) return 'mapping-explanation';
    if (value.startsWith('Setup Aktif')) return 'active-setup';
    return '';
  }

  function makeAnalyzeStatic(app) {
    if (!app || currentTab() !== 'Analyze') return;
    app.dataset.analysisStatic = 'true';

    app.querySelectorAll('details').forEach(details => {
      if (!details.dataset.stabilityKey) {
        const key = stableKeyForSummary(details.querySelector(':scope > summary')?.textContent);
        if (key) details.dataset.stabilityKey = key;
      }
      forceStaticDisclosure(details);
    });
  }

  function removeHistoricalOutlookStats() {
    document.querySelectorAll('.amy-outlook-backtest-note, .amy-outlook-historical-rate').forEach(node => node.remove());
  }

  function applyFixes() {
    scheduled = false;
    if (applying) return;
    applying = true;
    try {
      installStaticStyle();
      removeDashboardDuplicates();

      const app = document.getElementById('app');
      if (!app) return;

      if (currentTab() === 'Analyze') {
        const card = document.getElementById('amy-regime-router-v3');
        if (card) {
          removeHistoricalReliability(card);
          ensureMarketContextDisclosure(card);
          updateAnalysisBadge(card);
        }
        makeAnalyzeStatic(app);
        removeHistoricalOutlookStats();
      } else {
        delete app.dataset.analysisStatic;
      }
    } finally {
      applying = false;
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(applyFixes);
  }

  function start() {
    const app = document.getElementById('app');
    if (!app) return;

    observer = new MutationObserver(records => {
      if (applying) return;
      const topLevelChanged = records.some(record => record.target === app);
      if (topLevelChanged) schedule();
    });
    observer.observe(app, { childList: true, subtree: false });

    window.addEventListener('amyfx:mapping-state-change', schedule);
    schedule();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
