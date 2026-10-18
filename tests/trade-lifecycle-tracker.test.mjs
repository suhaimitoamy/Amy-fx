import test from 'node:test';
import assert from 'node:assert/strict';

// Setup Mock DOM and Browser Environment for Node.js test
const localStorageStore = new Map();
globalThis.localStorage = {
  getItem: (key) => localStorageStore.get(key) || null,
  setItem: (key, val) => localStorageStore.set(key, String(val)),
  removeItem: (key) => localStorageStore.delete(key),
  clear: () => localStorageStore.clear()
};

const notificationsSent = [];
globalThis.window = {
  Android: {
    showNotificationWithUrl: (title, body, url) => {
      notificationsSent.push({ title, body, url });
    },
    showNotification: (title, body) => {
      notificationsSent.push({ title, body });
    },
    triggerHaptic: () => {}
  },
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {}
};

const elements = new Map();
globalThis.document = {
  getElementById: (id) => elements.get(id) || null,
  createElement: (tag) => ({ id: '', textContent: '', appendChild: () => {} }),
  head: { appendChild: () => {} },
  querySelectorAll: () => []
};

// Import module
const tradeLifecycleTracker = await import('../app/src/main/assets/apps/mapping/js/ict-workspace/trade-lifecycle-tracker.js');
const {
  loadTradeHistory,
  saveTradeHistory,
  trackAssistantPlan,
  updatePrice,
  computeWinRateStats,
  renderLifecycleArchive,
  UNIFIED_TRADE_STATES,
  STORAGE_KEY
} = tradeLifecycleTracker;

test('Trade Lifecycle Tracker: ARMED -> ACTIVE -> TP & SL Flow', async (t) => {
  localStorage.clear();
  notificationsSent.length = 0;

  await t.test('1. Menghasilkan setup baru dalam status ARMED_LIMIT saat harga belum menyentuh Entry', () => {
    const buyPlan = {
      side: 'BUY',
      entry: 2650.00,
      sl: 2642.00,
      tp1: 2658.00,
      tp2: 2665.00,
      signalName: 'BUY ENTRY (Trend Buy)',
      signalType: 1
    };

    // Harga saat ini 2652.00 (di atas entry 2650.00 untuk BUY limit)
    const trade = trackAssistantPlan(buyPlan, 2652.00);

    assert.ok(trade, 'Trade harus terbentuk');
    assert.equal(trade.status, 'ARMED_LIMIT', 'Status awal harus ARMED_LIMIT');
    assert.equal(notificationsSent.length, 0, 'Belum boleh ada notifikasi order terpicu saat ARMED_LIMIT');

    const history = loadTradeHistory();
    assert.equal(history.length, 1);
    assert.equal(history[0].status, 'ARMED_LIMIT');
  });

  await t.test('2. FILTER ANTI-SPAM: Setup ARMED_LIMIT dilarang masuk ke Tab Arsip', () => {
    const mockContainer = { innerHTML: '', querySelectorAll: () => [] };
    renderLifecycleArchive(mockContainer);

    assert.ok(
      mockContainer.innerHTML.includes('Tidak ada posisi yang sedang berjalan saat ini'),
      'ARMED_LIMIT tidak boleh muncul di daftar Posisi Berjalan'
    );
    assert.ok(
      !mockContainer.innerHTML.includes('BUY ENTRY (Trend Buy)'),
      'Setup ARMED_LIMIT dilarang di-render sebagai card aktif di Tab Arsip'
    );
    assert.ok(
      mockContainer.innerHTML.includes('0 AKTIF'),
      'Counter posisi aktif harus 0'
    );
  });

  await t.test('3. Harga menyentuh Entry -> Transisi ke ACTIVE_RUNNING dan kirim Notifikasi Trigger', () => {
    notificationsSent.length = 0;

    // Harga bergerak turun menyentuh entry 2650.00
    updatePrice(2650.00, 2652.00, 2649.80);

    const history = loadTradeHistory();
    const trade = history.find(t => t.side === 'BUY');

    assert.ok(trade);
    assert.equal(trade.status, 'ACTIVE_RUNNING', 'Status harus beralih ke ACTIVE_RUNNING');
    assert.ok(trade.triggeredAt, 'Waktu trigger harus tercatat');

    // Cek notifikasi Android
    assert.equal(notificationsSent.length, 1, 'Harus ada notifikasi trigger yang dikirim');
    const notif = notificationsSent[0];
    assert.ok(notif.title.includes('⚡ Order Terpicu: BUY XAUUSD @ 2650.00 Aktif!'), 'Judul notifikasi order terpicu sesuai format');
    assert.ok(notif.body.includes('Harga menyentuh limit entry'), 'Isi notifikasi sesuai format');
    assert.ok(notif.body.includes('SL: 2642.00 | TP: 2658.00'), 'Isi notifikasi mencantumkan SL dan TP');
  });

  await t.test('4. Posisi ACTIVE_RUNNING muncul di Tab Arsip dengan floating distance to TP/SL', () => {
    // Harga sekarang naik ke 2654.00 (profit +4.00 pts)
    updatePrice(2654.00);

    const mockContainer = { innerHTML: '', querySelectorAll: () => [] };
    renderLifecycleArchive(mockContainer);

    assert.ok(mockContainer.innerHTML.includes('1 AKTIF'), 'Counter posisi aktif harus 1');
    assert.ok(mockContainer.innerHTML.includes('LIVE RUNNING'), 'Harus ada badge LIVE RUNNING');
    assert.ok(mockContainer.innerHTML.includes('+4.00 pts'), 'Floating profit harus +4.00 pts');
    assert.ok(mockContainer.innerHTML.includes('4.00 pts lagi ke TP1'), 'Jarak ke TP1 harus dihitung');
    assert.ok(mockContainer.innerHTML.includes('12.00 pts dari SL'), 'Jarak ke SL harus dihitung');
  });

  await t.test('5. Harga menyentuh TP1 -> Transisi ke CLOSED_TP, kirim notifikasi TP, dan update Win Rate Card', () => {
    notificationsSent.length = 0;

    // Harga melonjak ke TP1 2658.00
    updatePrice(2658.50, 2659.00, 2653.00);

    const history = loadTradeHistory();
    const trade = history.find(t => t.side === 'BUY');

    assert.equal(trade.status, 'CLOSED_TP', 'Status trade harus CLOSED_TP');
    assert.equal(trade.profitPoints, 8.00, 'Profit poin harus +8.00 pts');

    // Cek notifikasi TP
    assert.equal(notificationsSent.length, 1, 'Harus kirim notifikasi TP tercapai');
    const notif = notificationsSent[0];
    assert.ok(notif.title.includes('🎯 TP Tercapai: BUY XAUUSD (+8.00 pts)'), 'Judul notifikasi TP sesuai format');
    assert.ok(notif.body.includes('Target profit 2658.00 sukses tercapai! Posisi selesai dengan profit penuh.'), 'Isi notifikasi TP sesuai');

    // Cek render Tab Arsip
    const mockContainer = { innerHTML: '', querySelectorAll: () => [] };
    renderLifecycleArchive(mockContainer);

    assert.ok(mockContainer.innerHTML.includes('0 AKTIF'), 'Posisi aktif harus 0');
    assert.ok(mockContainer.innerHTML.includes('1 SELESAI'), 'Posisi selesai harus 1');
    assert.ok(mockContainer.innerHTML.includes('100%'), 'Win Rate harus 100%');
    assert.ok(mockContainer.innerHTML.includes('1 Menang · 0 Kalah'), 'Rasio menang/kalah 1W / 0L');
    assert.ok(mockContainer.innerHTML.includes('+8.00 pts'), 'Total poin harus +8.00 pts');
  });

  await t.test('6. Setup SELL terkena Stop Loss -> Transisi CLOSED_SL, kirim notifikasi SL, dan rekap Win Rate', () => {
    notificationsSent.length = 0;

    // Buat setup SELL kedua
    const sellPlan = {
      side: 'SELL',
      entry: 2660.00,
      sl: 2666.00,
      tp1: 2652.00,
      signalName: 'SELL ENTRY (Trend Sell)',
      signalType: -1
    };

    // Langsung trigger di harga 2660.00
    const sellTrade = trackAssistantPlan(sellPlan, 2660.00);
    assert.equal(sellTrade.status, 'ACTIVE_RUNNING');
    assert.equal(notificationsSent.length, 1, 'Notifikasi trigger sell terkirim');

    notificationsSent.length = 0;

    // Harga melonjak ke SL 2666.00
    updatePrice(2666.50, 2667.00, 2659.00);

    const history = loadTradeHistory();
    const trade = history.find(t => t.side === 'SELL');

    assert.equal(trade.status, 'CLOSED_SL', 'Status trade harus CLOSED_SL');
    assert.equal(trade.profitPoints, -6.00, 'Loss poin harus -6.00 pts');

    // Cek notifikasi SL
    assert.equal(notificationsSent.length, 1, 'Harus kirim notifikasi SL kena');
    const notif = notificationsSent[0];
    assert.ok(notif.title.includes('🛑 Stop Loss Kena: SELL XAUUSD (-6.00 pts)'), 'Judul notifikasi SL sesuai format');
    assert.ok(notif.body.includes('Harga menyentuh batas risiko di 2666.00. Posisi ditutup secara disiplin. Evaluasi tercatat di Arsip.'), 'Isi notifikasi SL sesuai');

    // Cek Ringkasan Win Rate 2 Trade: 1 Win (+8), 1 Loss (-6) = 50% Win Rate, Net +2.00 pts
    const mockContainer = { innerHTML: '', querySelectorAll: () => [] };
    renderLifecycleArchive(mockContainer);

    assert.ok(mockContainer.innerHTML.includes('50%'), 'Win Rate harus 50%');
    assert.ok(mockContainer.innerHTML.includes('1 Menang · 1 Kalah'), '1W / 1L');
    assert.ok(mockContainer.innerHTML.includes('+2.00 pts'), 'Net poin harus +2.00 pts');
    assert.ok(mockContainer.innerHTML.includes('2 SELESAI'), 'Total selesai harus 2');
  });

  await t.test('7. DRIVER LIMIT (ARMED_LIMIT) dengan stopLoss & target -> Trigger saat harga menyentuh entry', () => {
    notificationsSent.length = 0;

    const driverSetup = {
      id: 'driver_sniper_buy_1',
      driverName: 'Sniper · Deep OTE',
      direction: 'BUY',
      entry: 2640.00,
      stopLoss: 2635.00,
      target: 2648.00,
      status: 'WAITING_TRIGGER'
    };

    // Harga saat ini 2644.00 (di atas entry limit 2640.00)
    const trade = trackAssistantPlan(driverSetup, 2644.00);
    assert.ok(trade, 'Driver setup harus berhasil didaftarkan');
    assert.equal(trade.status, 'ARMED_LIMIT', 'Status awal harus ARMED_LIMIT');
    assert.equal(trade.signalName, 'Sniper · Deep OTE');

    // Harga bergerak turun menyentuh entry 2640.00
    updatePrice(2640.00, 2644.00, 2639.50);

    const history = loadTradeHistory();
    const updated = history.find(t => t.id === trade.id);
    assert.ok(updated);
    assert.equal(updated.status, 'ACTIVE_RUNNING', 'Status driver harus beralih ke ACTIVE_RUNNING saat limit tersentuh');
    assert.ok(notificationsSent.some(n => n.title.includes('2640.00 Aktif!')), 'Notifikasi trigger driver harus dikirim');
  });

  await t.test('8. Item 1.41: Menolak registrasi plan baru jika harga saat registrasi sudah melampaui TP1 (BUY/SELL)', () => {
    const buyPlanStale = {
      side: 'BUY',
      entry: 2700.00,
      sl: 2690.00,
      tp1: 2715.00,
      signalName: 'BUY ENTRY (Stale TP reached)'
    };

    // Kasus 1: Harga saat registrasi sudah menyentuh / melebihi TP1 BUY (2715.00 atau 2720.00)
    const rejectedBuyAtTp = trackAssistantPlan(buyPlanStale, 2715.00);
    assert.equal(rejectedBuyAtTp, null, 'Plan BUY harus ditolak jika harga saat registrasi sudah mencapai TP1');

    const rejectedBuyBeyondTp = trackAssistantPlan(buyPlanStale, 2720.50);
    assert.equal(rejectedBuyBeyondTp, null, 'Plan BUY harus ditolak jika harga saat registrasi sudah melampaui TP1');

    const sellPlanStale = {
      side: 'SELL',
      entry: 2700.00,
      sl: 2710.00,
      tp1: 2685.00,
      signalName: 'SELL ENTRY (Stale TP reached)'
    };

    // Kasus 2: Harga saat registrasi sudah menyentuh / melebihi TP1 SELL (2685.00 atau 2680.00)
    const rejectedSellAtTp = trackAssistantPlan(sellPlanStale, 2685.00);
    assert.equal(rejectedSellAtTp, null, 'Plan SELL harus ditolak jika harga saat registrasi sudah mencapai TP1');

    const rejectedSellBeyondTp = trackAssistantPlan(sellPlanStale, 2680.20);
    assert.equal(rejectedSellBeyondTp, null, 'Plan SELL harus ditolak jika harga saat registrasi sudah melampaui TP1');
  });

  await t.test('9. Item 1.42: Guard MISSED ketika harga menyentuh TP1 sebelum Entry tersentuh pada status ARMED_LIMIT (BUY/SELL)', () => {
    // 1. Kasus BUY: Pending limit di 2750, TP1 di 2765. Harga dari 2755 langsung meroket ke 2766 tanpa jemput entry.
    const buyArmed = {
      side: 'BUY',
      entry: 2750.00,
      sl: 2740.00,
      tp1: 2765.00,
      signalName: 'BUY LIMIT (Missed setup test)'
    };
    const buyTrade = trackAssistantPlan(buyArmed, 2755.00);
    assert.ok(buyTrade, 'Order BUY harus berhasil didaftarkan');
    assert.equal(buyTrade.status, 'ARMED_LIMIT');

    // Harga melesat ke 2766 (high 2766.50, low 2754.00 > entry 2750.00)
    updatePrice(2766.00, 2766.50, 2754.00);

    let history = loadTradeHistory();
    let updatedBuy = history.find(t => t.id === buyTrade.id);
    assert.ok(updatedBuy);
    assert.equal(updatedBuy.status, 'MISSED', 'Status order BUY harus bertransisi ke MISSED');
    assert.equal(updatedBuy.cancelReason, 'TP1 reached before Entry fill');
    assert.ok(updatedBuy.closedAt != null, 'closedAt harus tercatat');

    // Saat harga kemudian retrace turun ke 2748 (di bawah entry), order tidak boleh aktif
    updatePrice(2748.00, 2752.00, 2748.00);
    history = loadTradeHistory();
    updatedBuy = history.find(t => t.id === buyTrade.id);
    assert.equal(updatedBuy.status, 'MISSED', 'Status order MISSED tidak boleh berubah menjadi ACTIVE_RUNNING saat entry tersentuh belakangan');

    // 2. Kasus SELL: Pending limit di 2780, TP1 di 2765. Harga dari 2775 langsung anjlok ke 2764 tanpa jemput entry.
    const sellArmed = {
      side: 'SELL',
      entry: 2780.00,
      sl: 2790.00,
      tp1: 2765.00,
      signalName: 'SELL LIMIT (Missed setup test)'
    };
    const sellTrade = trackAssistantPlan(sellArmed, 2775.00);
    assert.ok(sellTrade, 'Order SELL harus berhasil didaftarkan');
    assert.equal(sellTrade.status, 'ARMED_LIMIT');

    // Harga anjlok ke 2764 (high 2776.00 < entry 2780.00, low 2764.00 <= TP1 2765.00)
    updatePrice(2764.00, 2776.00, 2764.00);

    history = loadTradeHistory();
    let updatedSell = history.find(t => t.id === sellTrade.id);
    assert.ok(updatedSell);
    assert.equal(updatedSell.status, 'MISSED', 'Status order SELL harus bertransisi ke MISSED');
    assert.equal(updatedSell.cancelReason, 'TP1 reached before Entry fill');
    assert.ok(updatedSell.closedAt != null, 'closedAt harus tercatat');

    // Saat harga kemudian rally naik ke 2782 (di atas entry), order tidak boleh aktif
    updatePrice(2782.00, 2785.00, 2778.00);
    history = loadTradeHistory();
    updatedSell = history.find(t => t.id === sellTrade.id);
    assert.equal(updatedSell.status, 'MISSED', 'Status order MISSED tidak boleh berubah menjadi ACTIVE_RUNNING saat entry tersentuh belakangan');
  });

  await t.test('10. Item 2.19: UNIFIED_TRADE_STATES dan rendering badge MISSED & CANCELLED di Arsip', () => {
    const { UNIFIED_TRADE_STATES } = tradeLifecycleTracker;
    assert.ok(UNIFIED_TRADE_STATES, 'UNIFIED_TRADE_STATES harus diekspor');
    assert.equal(UNIFIED_TRADE_STATES.ARMED_LIMIT, 'ARMED_LIMIT');
    assert.equal(UNIFIED_TRADE_STATES.ACTIVE_RUNNING, 'ACTIVE_RUNNING');
    assert.equal(UNIFIED_TRADE_STATES.CLOSED_TP, 'CLOSED_TP');
    assert.equal(UNIFIED_TRADE_STATES.CLOSED_SL, 'CLOSED_SL');
    assert.equal(UNIFIED_TRADE_STATES.MISSED, 'MISSED');
    assert.equal(UNIFIED_TRADE_STATES.CANCELLED_GAP, 'CANCELLED_GAP');
    assert.equal(UNIFIED_TRADE_STATES.CANCELLED, 'CANCELLED');

    // Uji render archive dengan entri MISSED dan CANCELLED
    const mockContainer = {
      innerHTML: '',
      querySelectorAll: () => []
    };

    saveTradeHistory([
      { id: 't1', side: 'BUY', status: 'CLOSED_TP', entry: 2650, sl: 2640, tp1: 2660, profitPoints: 10, closedAt: Date.now() },
      { id: 't2', side: 'SELL', status: 'MISSED', entry: 2680, sl: 2690, tp1: 2670, profitPoints: 0, cancelReason: 'TP1 reached before Entry fill', closedAt: Date.now() },
      { id: 't3', side: 'BUY', status: 'CANCELLED_GAP', entry: 2640, sl: 2630, tp1: 2650, profitPoints: 0, cancelReason: 'Gapped through SL', closedAt: Date.now() }
    ]);

    renderLifecycleArchive(mockContainer);
    assert.ok(mockContainer.innerHTML.includes('closed-outcome-badge tp'), 'Badge TP harus ada');
    assert.ok(mockContainer.innerHTML.includes('closed-outcome-badge missed'), 'Badge MISSED harus ada');
    assert.ok(mockContainer.innerHTML.includes('MISSED (TP Duluan)'), 'Teks MISSED (TP Duluan) harus tampil');
    assert.ok(mockContainer.innerHTML.includes('closed-outcome-badge cancelled'), 'Badge CANCELLED harus ada');
    assert.ok(mockContainer.innerHTML.includes('CANCELLED (Gap SL)'), 'Teks CANCELLED (Gap SL) harus tampil');
  });
});



