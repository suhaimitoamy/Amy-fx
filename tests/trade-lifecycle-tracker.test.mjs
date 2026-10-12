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
const {
  loadTradeHistory,
  saveTradeHistory,
  trackAssistantPlan,
  updatePrice,
  computeWinRateStats,
  renderLifecycleArchive,
  STORAGE_KEY
} = await import('../app/src/main/assets/apps/mapping/js/ict-workspace/trade-lifecycle-tracker.js');

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
});
