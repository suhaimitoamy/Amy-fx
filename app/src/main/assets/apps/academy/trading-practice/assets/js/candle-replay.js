(function () {
  'use strict';
  var ui = window.AmyPracticeUI;
  var core = window.AmyPracticeCore;
  var storage = window.AmyPracticeStorage;
  var provider = window.AmyPracticeData;
  var chart;
  var replay;
  var latestPayload = null;
  var firstRender = true;
  var playing = false;
  var savingDecision = false;
  var outcomeQueue = Promise.resolve();
  var historySequence = 0;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function dateLabel(timestamp) {
    var value = Number(timestamp || 0);
    if (!value) return 'tanpa tanggal';
    return new Date(value * 1000).toISOString().slice(0, 7);
  }

  function optionLabel(item) {
    if (item.sampleOnly) return 'Sample · Maret 2009';
    return dateLabel(item.start) + ' · ' + Number(item.rowCount || 0).toLocaleString('id-ID') + ' bar (M1–D1)' + (item.repairedAudited ? ' · audited' : '');
  }

  async function refreshSources(preferredId) {
    var select = ui.byId('datasetSource');
    var sources = await provider.listSources('XAUUSD');
    select.innerHTML = sources.map(function (item) {
      return '<option value="' + escapeHtml(item.id) + '">' + escapeHtml(optionLabel(item)) + '</option>';
    }).join('');
    var desired = preferredId;
    if (!desired || !sources.some(function (item) { return item.id === desired; })) {
      desired = provider.selectedSourceId();
    }
    var packCandidate = sources.find(function (item) { return item.kind === 'pack' || (item.id && item.id.indexOf('pack:') === 0); });
    if (!sources.some(function (item) { return item.id === desired; })) {
      desired = packCandidate ? packCandidate.id : (sources[0] ? sources[0].id : provider.SAMPLE_ID);
    } else if (desired === provider.SAMPLE_ID && packCandidate && !preferredId) {
      desired = packCandidate.id;
    }
    select.value = desired;
    provider.setSelectedSourceId(desired);
    return desired;
  }

  function timelineIndex(value) {
    var list = replay.timeline;
    var index = window.AmyReplayEngine.lowerBound(list, value);
    return Math.max(0, Math.min(index, list.length - 1));
  }

  function isReplayTrade(item) {
    return item && (item.locked === true || String(item.id || '').indexOf('decision-') === 0);
  }

  async function renderHistory() {
    var sequence = ++historySequence;
    var trades = (await storage.listTrades()).filter(isReplayTrade);
    if (sequence !== historySequence) return;
    var rows = ui.byId('replayHistoryRows');
    var markup = trades.map(function (trade) {
      var evidence = trade.outcomeEvidence;
      var label = trade.bias === 'WAIT' ? 'WAIT · tidak entry' :
        (trade.result === 'WIN' ? 'TP tercapai' : trade.result === 'LOSS' ? 'SL tercapai' :
        trade.entryStatus === 'ACTIVE' ? 'Aktif · menunggu SL/TP' : 'Menunggu entry tersentuh');
      var detail = '';
      if (evidence) {
        detail = '<p>Bukti ' + escapeHtml(evidence.type) + ': level ' + core.price(evidence.level) +
          ' · ' + escapeHtml(core.formatWita(evidence.candleTime, true)) +
          ' · Low ' + core.price(evidence.candleLow) + ' / High ' + core.price(evidence.candleHigh) +
          (evidence.ambiguous ? ' · SL diprioritaskan: SL dan TP tersentuh pada candle yang sama.' : '') + '</p>';
      } else if (trade.result !== 'OPEN') {
        detail = '<p>Catatan lama: bukti candle belum tersimpan.</p>';
      }
      var tone = trade.result === 'WIN' ? 'result-win' : trade.result === 'LOSS' ? 'result-loss' : 'result-open';
      return '<article class="replay-history-item"><strong>' + escapeHtml(trade.bias) + ' · ' + escapeHtml(trade.timeframe) +
        ' · ' + escapeHtml(core.formatWita(trade.tradeTime, true)) + '</strong>' +
        '<p class="' + tone + '">' + label + '</p>' +
        (trade.bias === 'WAIT' ? '' : '<p>Entry ' + core.price(trade.entry) + ' · SL ' + core.price(trade.stopLoss) + ' · TP ' + core.price(trade.takeProfit) + '</p>') +
        detail + '<p>' + escapeHtml(trade.notes || 'Tanpa catatan') + '</p>' +
        '<div class="replay-history-footer"><small>Pack: ' + escapeHtml(trade.sourceId || 'Data lama') + '</small>' +
        '<button type="button" class="replay-history-delete" data-delete-replay-trade="' + escapeHtml(trade.id) + '" aria-label="Hapus keputusan Replay ini">Hapus</button></div></article>';
    }).join('') || '<p class="empty-state">Belum ada keputusan Replay tersimpan. Isi Catat keputusan lalu tekan Kunci keputusan.</p>';
    if (rows.innerHTML !== markup) rows.innerHTML = markup;
    ui.text('replayHistoryStatus', trades.length + ' keputusan Replay · semua pack dan timeframe');
  }

  async function deleteHistoryTrade(event) {
    var button = event.target.closest('[data-delete-replay-trade]');
    if (!button || !confirm('Hapus keputusan Replay ini dari perangkat?')) return;
    var id = button.dataset.deleteReplayTrade;
    button.disabled = true;
    try {
      await storage.deleteTrade(id);
      var form = ui.byId('tradeForm');
      if (form.dataset.lockedDecisionId === id) delete form.dataset.lockedDecisionId;
      await renderHistory();
      if (latestPayload) await syncDecisionState(latestPayload);
      ui.status('replayHistoryStatus', 'Keputusan Replay berhasil dihapus.', false, true);
    } catch (error) {
      button.disabled = false;
      ui.status('replayHistoryStatus', error.message || 'Riwayat gagal dihapus.', true);
    }
  }

  async function updateOutcomes(payload) {
    var trades = await storage.listTrades();
    var matching = trades.filter(function (item) {
      var needsEvidenceRepair = ['WIN', 'LOSS'].includes(item.result) && !item.outcomeEvidence;
      return isReplayTrade(item) && item.symbol === payload.symbol && (item.result === 'OPEN' || needsEvidenceRepair) && item.bias !== 'WAIT' &&
        item.sourceId === payload.sourceId;
    });
    var candlesByTimeframe = {};
    candlesByTimeframe[payload.timeframe] = payload.candles;
    for (var i = 0; i < matching.length; i += 1) {
      var trade = matching[i];
      if (!candlesByTimeframe[trade.timeframe]) {
        var data = await provider.getCandles({ symbol: payload.symbol, sourceId: payload.sourceId,
          timeframe: trade.timeframe, cursor: payload.cursor });
        candlesByTimeframe[trade.timeframe] = data.candles;
      }
      var evaluated = window.AmyPracticeTrades.evaluate(trade, candlesByTimeframe[trade.timeframe]);
      if (evaluated.result !== trade.result || evaluated.entryStatus !== trade.entryStatus ||
          JSON.stringify(evaluated.outcomeEvidence || null) !== JSON.stringify(trade.outcomeEvidence || null)) {
        await storage.saveTrade(evaluated);
      }
    }
  }

  async function syncDecisionState(payload) {
    var id = window.AmyPracticeTrades.decisionId({
      symbol: payload.symbol, timeframe: payload.timeframe,
      sourceId: payload.sourceId, tradeTime: payload.cursor
    });
    var existing = await storage.getTrade(id);
    if (latestPayload !== payload) return;
    if (!existing) {
      delete ui.byId('tradeForm').dataset.lockedDecisionId;
      chart.setTradeLevels([]);
      ui.tradeReady(true);
      ui.decisionState('idle', 'Belum dikunci', 'Cursor ' + core.formatWita(payload.cursor, true));
      return;
    }
    ui.byId('tradeForm').dataset.lockedDecisionId = existing.id;
    ui.tradeReady(false);
    ui.decisionState('locked', 'Keputusan terkunci ✓', existing.bias + ' · ' + core.formatWita(existing.tradeTime, true) + ' · tersimpan permanen');
    chart.setTradeLevels(existing.bias === 'WAIT' ? [] : [
      { type: 'entry', price: existing.entry, title: 'Entry' }, { type: 'stop', price: existing.stopLoss, title: 'SL' }, { type: 'target', price: existing.takeProfit, title: 'TP' }
    ]);
  }

  async function render(payload) {
    latestPayload = payload;
    ui.tradeReady(false);
    delete ui.byId('tradeForm').dataset.lockedDecisionId;
    chart.setTradeLevels([]);
    chart.options.timeframeSeconds = ({M1:60,M5:300,M15:900,M30:1800,H1:3600,H4:14400,D1:86400})[payload.timeframe] || 900;
    chart.setDrawingTimeBoundary(payload.cursor);
    chart.setCandles(payload.candles, firstRender);
    if (firstRender && chart.chart && chart.chart.timeScale) {
      chart.chart.timeScale().fitContent();
    }
    firstRender = false;
    var current = ui.currentCandle(payload.candles);
    ui.renderOhlc('ohlc', current, current ? current.time : payload.cursor);
    if (ui.byId('ohlcTf')) ui.text('ohlcTf', payload.timeframe);
    ui.text('visibleCount', payload.candles.length + ' candle');
    var slider = ui.byId('replaySlider');
    slider.max = Math.max(0, replay.timeline.length - 1);
    slider.value = timelineIndex(payload.cursor);
    ui.status('replayStatus', '[' + payload.timeframe + '] · Candle ' + core.formatWita(current ? current.time : payload.cursor, true) + ' · data sesudah cursor tidak dikirim ke chart.');
    ui.text('sourceNote', 'Sumber: ' + payload.source + (payload.sampleOnly ? ' · sample UI, bukan hasil backtest.' : ' · pack historis lokal (' + payload.timeframe + ').'));
    storage.saveReplayState({
      timeframe: payload.timeframe,
      cursor: payload.cursor,
      speedMs: replay.speedMs,
      sourceId: payload.sourceId
    });
    outcomeQueue = outcomeQueue.catch(function () {}).then(function () { return updateOutcomes(payload); });
    await outcomeQueue;
    await renderHistory();
    if (latestPayload === payload) await syncDecisionState(payload);
  }

  async function move(count) {
    try { await replay.move(count); }
    catch (error) { ui.status('replayStatus', error.message, true); }
  }

  async function saveTrade(event) {
    event.preventDefault();
    var form = event.currentTarget;
    if (savingDecision) return;
    if (!latestPayload) {
      ui.status('tradeStatus', 'Cursor replay belum siap. Tunggu data selesai dimuat.', true);
      return;
    }
    var payload = latestPayload;
    var current = ui.currentCandle(payload.candles);
    savingDecision = true;
    playing = false;
    replay.pause();
    ui.text('playPause', 'Putar');
    var submit = ui.byId('tradeSubmit');
    var saved = false;
    try {
      ui.tradeReady(false);
      if (submit) submit.textContent = 'Menyimpan keputusan…';
      ui.decisionState('saving', 'Sedang menyimpan', 'Menunggu commit IndexedDB pada cursor ini…');
      ui.status('tradeStatus', 'Menyimpan dan memverifikasi keputusan lokal…');
      var id = window.AmyPracticeTrades.decisionId({
        symbol: payload.symbol, timeframe: payload.timeframe,
        sourceId: payload.sourceId, tradeTime: payload.cursor
      });
      var alreadyLocked = await storage.getTrade(id);
      if (alreadyLocked) {
        saved = true;
        if (latestPayload !== payload) return;
        form.dataset.lockedDecisionId = alreadyLocked.id;
        chart.setTradeLevels(alreadyLocked.bias === 'WAIT' ? [] : [
          { type: 'entry', price: alreadyLocked.entry, title: 'Entry' }, { type: 'stop', price: alreadyLocked.stopLoss, title: 'SL' }, { type: 'target', price: alreadyLocked.takeProfit, title: 'TP' }
        ]);
        ui.decisionState('locked', 'Keputusan terkunci ✓', alreadyLocked.bias + ' · ' + core.formatWita(alreadyLocked.tradeTime, true) + ' · tidak dapat ditimpa');
        ui.status('tradeStatus', 'Keputusan pada cursor ini sudah tersimpan di Riwayat.', false, true);
        return;
      }
      var record = await ui.saveTrade(form, {
        symbol: payload.symbol, timeframe: payload.timeframe,
        tradeTime: payload.cursor, replayStartTime: payload.startTime,
        currentPrice: current && current.close, sourceId: payload.sourceId,
        lockDecision: true
      });
      var persisted = await storage.getTrade(record.id);
      if (!persisted || persisted.tradeTime !== record.tradeTime) throw new Error('Keputusan belum terverifikasi di penyimpanan lokal. Coba lagi.');
      saved = true;
      if (latestPayload !== payload) return;
      chart.setTradeLevels(record.bias === 'WAIT' ? [] : [
        { type: 'entry', price: record.entry, title: 'Entry' }, { type: 'stop', price: record.stopLoss, title: 'SL' }, { type: 'target', price: record.takeProfit, title: 'TP' }
      ]);
      form.dataset.lockedDecisionId = record.id;
      ui.decisionState('locked', 'Keputusan terkunci ✓', record.bias + ' · ' + core.formatWita(record.tradeTime, true) + ' · tersimpan permanen');
      ui.status('tradeStatus', '✓ ' + record.bias + ' berhasil dikunci dan sudah dapat dibaca kembali melalui Riwayat.', false, true);
    } catch (error) {
      ui.decisionState('error', 'Gagal mengunci', error.message);
      ui.status('tradeStatus', error.message, true);
    } finally {
      savingDecision = false;
      await renderHistory().catch(function (error) { ui.status('replayHistoryStatus', error.message, true); });
      if (latestPayload && latestPayload !== payload) {
        await syncDecisionState(latestPayload);
      } else {
        ui.tradeReady(Boolean(latestPayload) && !saved && !form.dataset.lockedDecisionId);
      }
      if (submit) submit.textContent = 'Kunci keputusan di cursor ini';
    }
  }

  async function initCloudLibrary() {
    var yearSelect = ui.byId('cloudYearSelect');
    var monthSelect = ui.byId('cloudMonthSelect');
    var installBtn = ui.byId('cloudInstallBtn');
    if (!yearSelect || !monthSelect || !installBtn) return;

    var manifest = null;
    function updateMonthOptions() {
      var y = yearSelect.value;
      monthSelect.innerHTML = '<option value="ALL">Semua Bulan (Tahun Penuh)</option>';
      if (manifest && manifest[y]) {
        manifest[y].forEach(function (m) {
          var opt = document.createElement('option');
          opt.value = m.file;
          opt.textContent = m.label + ' (' + m.sizeKb + ' KB)';
          monthSelect.appendChild(opt);
        });
      }
    }

    async function refreshManifest() {
      try {
        manifest = await provider.loadCloudManifest();
        updateMonthOptions();
      } catch (_) {}
    }

    yearSelect.addEventListener('change', updateMonthOptions);
    updateMonthOptions();
    refreshManifest();

    installBtn.addEventListener('click', async function () {
      var year = yearSelect.value;
      var month = monthSelect.value;
      installBtn.disabled = true;
      var originalText = installBtn.textContent;
      installBtn.textContent = 'Mengunduh…';
      ui.status('cloudInstallStatus', 'Menghubungkan ke Cloud…');
      try {
        var results = await provider.installCloudPack(year, month, function (prog) {
          if (prog && prog.message) ui.status('cloudInstallStatus', prog.message);
        });
        ui.status('cloudInstallStatus', '✓ ' + (results.length || 1) + ' pack berhasil dipasang!', false, true);
        var firstId = results[0] ? results[0].id : null;
        if (firstId) {
          await refreshSources(firstId);
          await changeSource(firstId);
        } else {
          await refreshSources();
        }
      } catch (err) {
        ui.status('cloudInstallStatus', 'Gagal: ' + err.message, true);
      } finally {
        installBtn.disabled = false;
        installBtn.textContent = originalText;
      }
    });
  }

  async function changeSource(value) {
    playing = false;
    ui.text('playPause', 'Putar');
    replay.pause();
    latestPayload = null;
    ui.tradeReady(false);
    ui.decisionState('saving', 'Memuat pack', 'Keputusan dapat dikunci setelah cursor pack baru siap.');
    chart.setTradeLevels([]);
    provider.setSelectedSourceId(value);
    firstRender = true;
    ui.status('replayStatus', 'Memuat pack historis…');
    try {
      await replay.setSource(value, null);
      if (chart) {
        chart.resize();
        if (chart.chart && chart.chart.timeScale) chart.chart.timeScale().fitContent();
      }
    }
    catch (error) { ui.status('replayStatus', error.message, true); }
  }

  async function init() {
    ui.tradeReady(false);
    ui.byId('tradeForm').addEventListener('submit', saveTrade);
    ui.byId('replayHistoryRows').addEventListener('click', deleteHistoryTrade);
    await renderHistory();
    await initCloudLibrary();
    var saved = storage.loadReplayState() || {};
    ui.byId('timeframe').value = saved.timeframe || 'M15';
    ui.byId('speed').value = String(saved.speedMs || 900);
    var activeGlobalSource = provider.selectedSourceId();
    var preferredSource = (activeGlobalSource && activeGlobalSource !== provider.SAMPLE_ID)
      ? activeGlobalSource
      : (saved.sourceId || activeGlobalSource);
    var selectedSource = await refreshSources(preferredSource);
    chart = new window.AmyCandleChart.CandleChart(ui.byId('chart'), {
      storageKey: 'amy.practice.v1.drawings.replay',
      allowDrawingProjection: true, stayInDrawingMode: false, followReplay: true,
      onCrosshair: function (candle, time) { if (candle) ui.renderOhlc('ohlc', candle, Number(time)); }
    });
    ui.bindDrawingToolbar(chart);
    window.addEventListener('resize', function () {
      if (chart) chart.resize();
    });
    replay = new window.AmyReplayEngine.ReplayController({
      symbol: 'XAUUSD', timeframe: ui.byId('timeframe').value, sourceId: selectedSource,
      speedMs: Number(ui.byId('speed').value), onChange: render,
      onEnd: function () { playing = false; ui.text('playPause', 'Putar'); }
    });
    ui.byId('previousCandle').addEventListener('click', function () { move(-1); });
    ui.byId('nextCandle').addEventListener('click', function () { move(1); });
    ui.byId('nextFive').addEventListener('click', function () { move(5); });
    ui.byId('resetReplay').addEventListener('click', function () {
      playing = false;
      firstRender = true;
      chart.followReplay = true;
      chart.chart.applyOptions({ timeScale: { shiftVisibleRangeOnNewBar: true } });
      ui.text('playPause', 'Putar');
      var initial = replay.timeline[Math.min(80, replay.timeline.length - 1)];
      replay.start(initial).then(function () {
        if (chart) {
          chart.resize();
          if (chart.chart && chart.chart.timeScale) chart.chart.timeScale().fitContent();
        }
      }).catch(function (error) { ui.status('replayStatus', error.message, true); });
    });
    ui.byId('playPause').addEventListener('click', function () {
      playing = !playing;
      if (playing) replay.play(); else replay.pause();
      ui.text('playPause', playing ? 'Jeda' : 'Putar');
    });
    ui.byId('speed').addEventListener('change', function () { replay.setSpeed(Number(this.value)); });
    ui.byId('timeframe').addEventListener('change', async function () {
      playing = false;
      ui.text('playPause', 'Putar');
      firstRender = true;
      latestPayload = null;
      ui.tradeReady(false);
      ui.decisionState('saving', 'Mengganti timeframe ' + this.value, 'Menyelaraskan candle ' + this.value + ' tanpa membuka masa depan.');
      chart.setTradeLevels([]);
      try {
        await replay.setTimeframe(this.value);
        if (chart) {
          chart.resize();
          if (chart.chart && chart.chart.timeScale) chart.chart.timeScale().fitContent();
        }
      } catch (error) { ui.status('replayStatus', error.message, true); }
    });
    ui.byId('datasetSource').addEventListener('change', function () { changeSource(this.value); });
    ui.byId('replaySlider').addEventListener('input', function () {
      playing = false;
      ui.text('playPause', 'Putar');
      var time = replay.timeline[Number(this.value)];
      if (time != null) replay.seek(time).catch(function (error) { ui.status('replayStatus', error.message, true); });
    });
    window.addEventListener('pagehide', function () { replay.destroy(); chart.destroy(); }, { once: true });
    try {
      firstRender = true;
      var targetCursor = (saved.sourceId === selectedSource && saved.cursor) ? saved.cursor : null;
      await replay.start(targetCursor);
      if (chart) {
        chart.resize();
        if (chart.chart && chart.chart.timeScale) chart.chart.timeScale().fitContent();
      }
    } catch (error) {
      ui.status('replayStatus', error.message, true);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init().catch(function (error) { ui.status('replayStatus', error.message, true); }); }, { once: true });
  else init().catch(function (error) { ui.status('replayStatus', error.message, true); });
})();
