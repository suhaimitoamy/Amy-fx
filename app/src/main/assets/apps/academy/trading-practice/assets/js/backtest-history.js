(function () {
  'use strict';
  var ui = window.AmyPracticeUI;
  var core = window.AmyPracticeCore;
  var allTrades = [];

  function esc(value) {
    var node = document.createElement('span'); node.textContent = String(value == null ? '' : value); return node.innerHTML;
  }
  function resultClass(result) {
    if (result === 'WIN') return 'result-win';
    if (result === 'LOSS') return 'result-loss';
    if (result === 'MISSED') return 'result-missed';
    return 'result-open';
  }
  function level(value) { return value == null ? '—' : core.price(value); }
  function rValue(value) { return value == null ? '—' : Number(value).toFixed(2) + 'R'; }
  function decision(trade) {
    return esc(trade.bias) + (trade.locked ? '<small class="history-lock">TERKUNCI</small>' : '');
  }
  function outcome(trade) {
    var evidence = trade && trade.outcomeEvidence;
    if (trade.result === 'MISSED') {
      var missedDetail = evidence
        ? 'Target TP ' + level(evidence.level) + ' tercapai sebelum entry · candle ' + core.formatWita(evidence.candleTime, true)
        : 'Target TP tercapai sebelum limit entry tersentuh';
      return '<span class="badge-missed">[ ⏳ MISSED ]</span><small class="history-evidence">' + esc(missedDetail) + '</small>';
    }
    if (!evidence || !['SL', 'TP'].includes(evidence.type)) return esc(trade.result);
    var label = evidence.type + ' tersentuh';
    var detail = 'Level ' + level(evidence.level) + ' · candle ' + core.formatWita(evidence.candleTime, true) +
      ' · L/H ' + level(evidence.candleLow) + ' / ' + level(evidence.candleHigh);
    if (evidence.ambiguous) detail += ' · SL diprioritaskan karena SL dan TP tersentuh pada candle yang sama';
    return '<strong>' + esc(label) + '</strong><small class="history-evidence">' + esc(detail) + '</small>';
  }

  function renderTrades() {
    var result = ui.byId('resultFilter').value;
    var timeframe = ui.byId('timeframeFilter').value;
    var filtered = allTrades.filter(function (trade) { return (!result || trade.result === result) && (!timeframe || trade.timeframe === timeframe); });
    var rows = ui.byId('historyRows');
    rows.innerHTML = filtered.map(function (trade) {
      return '<tr data-trade-id="' + esc(trade.id) + '"><td>' + esc(core.formatWita(trade.tradeTime, true)) + '</td><td>' + esc(trade.timeframe) + '</td><td>' + decision(trade) + '</td><td>' + level(trade.entry) + ' / ' + level(trade.stopLoss) + ' / ' + level(trade.takeProfit) + '</td><td class="' + resultClass(trade.result) + '">' + outcome(trade) + '</td><td>' + rValue(trade.plannedR) + ' / ' + rValue(trade.r) + '</td><td title="' + esc(trade.notes) + '">' + esc((trade.notes || '—').slice(0, 60)) + '</td><td><button type="button" data-delete-trade="' + esc(trade.id) + '">Hapus</button></td></tr>';
    }).join('');
    if (!filtered.length) rows.innerHTML = '<tr><td colspan="8" class="empty-state">Belum ada catatan yang cocok.</td></tr>';
    rows.querySelectorAll('[data-delete-trade]').forEach(function (button) {
      button.addEventListener('click', async function () {
        if (!confirm('Hapus catatan lokal ini?')) return;
        await window.AmyPracticeStorage.deleteTrade(button.dataset.deleteTrade);
        await load();
      });
    });
    ui.status('historyStatus', filtered.length + ' dari ' + allTrades.length + ' catatan ditampilkan.');
  }

  async function renderGuided() {
    var items = await window.AmyPracticeStorage.listGuidedResults();
    items.sort(function (a, b) { return Number(b.createdAt || 0) - Number(a.createdAt || 0); });
    ui.byId('guidedHistory').innerHTML = items.length ? '<table class="practice-table"><thead><tr><th>Waktu</th><th>Latihan</th><th>Jawaban</th><th>Hasil</th></tr></thead><tbody>' + items.slice(0, 30).map(function (item) {
      return '<tr><td>' + esc(new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))) + ' WITA</td><td>' + esc(item.title) + '</td><td>' + esc(item.answer) + '</td><td class="' + (item.correct ? 'result-win' : 'result-loss') + '">' + (item.correct ? 'TEPAT' : 'COBA LAGI') + '</td></tr>';
    }).join('') + '</tbody></table>' : '<div class="empty-state">Belum ada hasil Latihan Soal.</div>';
  }

  function renderAnalytics(trades) {
    if (!window.AmyPracticeAnalytics) return;
    var stats = window.AmyPracticeAnalytics.computeStats(trades);

    ui.text('metricWinRate', stats.winRate + '%');
    ui.text('metricExpectancy', (stats.expectancyR >= 0 ? '+' : '') + stats.expectancyR.toFixed(2) + 'R');
    ui.text('metricProfitFactor', stats.profitFactor.toFixed(2));
    ui.text('metricMaxDD', stats.maxDrawdownR.toFixed(1) + 'R');

    var setupList = ui.byId('setupBreakdownList');
    if (setupList) {
      if (stats.breakdownBySetup && stats.breakdownBySetup.length) {
        setupList.innerHTML = stats.breakdownBySetup.map(function (s) {
          return '<div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.05);">' +
            '<span><strong>' + esc(s.setup) + '</strong> <small style="color:var(--text-muted); font-size:11px;">(' + s.wins + 'W / ' + s.losses + 'L' + (s.missed ? ' / ' + s.missed + 'M' : '') + ')</small></span>' +
            '<span style="font-weight:700; color:' + (s.winRate >= 50 ? '#00e676' : '#ff5252') + '">' + s.winRate + '% <small style="color:#f5c451;">(' + (s.totalR >= 0 ? '+' : '') + s.totalR + 'R)</small></span>' +
            '</div>';
        }).join('');
      } else {
        setupList.innerHTML = '<div class="empty-state" style="font-size:12px; padding:8px 0;">Belum ada setup tersimpan.</div>';
      }
    }

    var sessionList = ui.byId('sessionBreakdownList');
    if (sessionList) {
      var activeSessions = (stats.breakdownBySession || []).filter(function (s) { return s.total > 0; });
      if (activeSessions.length) {
        sessionList.innerHTML = activeSessions.map(function (s) {
          return '<div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.05);">' +
            '<span><strong>' + esc(s.session) + '</strong> <small style="color:var(--text-muted); font-size:11px;">(' + s.wins + 'W / ' + s.losses + 'L)</small></span>' +
            '<span style="font-weight:700; color:' + (s.winRate >= 50 ? '#00e676' : '#ff5252') + '">' + s.winRate + '% (' + s.total + ' trade)</span>' +
            '</div>';
        }).join('');
      } else {
        sessionList.innerHTML = '<div class="empty-state" style="font-size:12px; padding:8px 0;">Belum ada data sesi.</div>';
      }
    }

    if (window.AmyPracticeStorage && typeof window.AmyPracticeStorage.savePracticeAnalytics === 'function') {
      window.AmyPracticeStorage.savePracticeAnalytics({
        id: 'latest-summary',
        timestamp: Date.now(),
        winRate: stats.winRate,
        expectancyR: stats.expectancyR,
        profitFactor: stats.profitFactor,
        maxDrawdownR: stats.maxDrawdownR,
        totalTrades: stats.totalTrades,
        closedTrades: stats.closedTrades
      }).catch(function () {});
    }
  }

  async function load() {
    allTrades = await window.AmyPracticeStorage.listTrades();
    ui.text('metricTotal', allTrades.length);
    ui.text('metricWin', allTrades.filter(function (item) { return item.result === 'WIN'; }).length);
    ui.text('metricLoss', allTrades.filter(function (item) { return item.result === 'LOSS'; }).length);
    ui.text('metricOpen', allTrades.filter(function (item) { return item.result === 'OPEN'; }).length);
    renderAnalytics(allTrades);
    renderTrades(); await renderGuided();
  }
  function init() {
    ui.byId('resultFilter').addEventListener('change', renderTrades);
    ui.byId('timeframeFilter').addEventListener('change', renderTrades);
    load().catch(function (error) { ui.status('historyStatus', error.message, true); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
