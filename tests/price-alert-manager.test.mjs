import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Setup Mock DOM and Browser Environment for Node environment testing
const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) || null,
  setItem: (key, val) => storage.set(key, String(val)),
  removeItem: key => storage.delete(key),
  clear: () => storage.clear()
};

const dispatchedEvents = [];
globalThis.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: (event) => {
    dispatchedEvents.push(event);
    return true;
  },
  Android: {
    notifications: [],
    haptics: [],
    soundPlayedCount: 0,
    playGoldChimeCount: 0,
    lastSoundType: null,
    showNotificationWithUrl(title, message, url) {
      this.notifications.push({ title, message, url });
    },
    showNotification(title, message) {
      this.notifications.push({ title, message });
    },
    triggerHaptic(ms) {
      this.haptics.push(ms);
    },
    playGoldChime() {
      this.playGoldChimeCount += 1;
    },
    playNotificationSound(type = 'default') {
      this.soundPlayedCount += 1;
      this.lastSoundType = type;
    }
  },
  amyfxCurrentPrice: 4280.50
};
globalThis.location = { href: 'http://localhost:8080/apps/mapping/index.html#Dashboard' };

// Import the module under test
import {
  getAlerts,
  saveAlerts,
  addAlert,
  removeAlert,
  resetAlert,
  clearAlerts,
  checkPrice,
  setPreviousPrice,
  getCurrentLivePrice,
  getStats,
  renderAlertList,
  checkIctIntrabarSweeps,
  clearIctCooldowns,
  getIctCooldowns,
  isGoldMarketOpen,
  playAlertBeep,
  getAvailableIctLevels
} from '../app/src/main/assets/apps/mapping/js/ict-workspace/price-alert-manager.js';

test('PriceAlertManager: getCurrentLivePrice retrieves configured live price', () => {
  const price = getCurrentLivePrice();
  assert.equal(price, 4280.50);
});

test('PriceAlertManager: addAlert sets CROSS_ABOVE when target > current price', () => {
  localStorage.clear();
  const alert = addAlert(4301.00, { currentPrice: 4280.50, note: 'Sweep Liquidity' });

  assert.ok(alert.id.startsWith('alert_'));
  assert.equal(alert.targetPrice, 4301.00);
  assert.equal(alert.direction, 'CROSS_ABOVE');
  assert.equal(alert.createdPrice, 4280.50);
  assert.equal(alert.status, 'ACTIVE');
  assert.equal(alert.note, 'Sweep Liquidity');

  const stored = getAlerts();
  assert.equal(stored.length, 1);
  assert.equal(stored[0].id, alert.id);
  assert.equal(stored[0].targetPrice, 4301.00);
});

test('PriceAlertManager: addAlert sets CROSS_BELOW when target < current price', () => {
  localStorage.clear();
  const alert = addAlert(4100.00, { currentPrice: 4280.50, note: 'Order Block Test' });

  assert.equal(alert.targetPrice, 4100.00);
  assert.equal(alert.direction, 'CROSS_BELOW');
  assert.equal(alert.status, 'ACTIVE');

  const stored = getAlerts();
  assert.equal(stored.length, 1);
  assert.equal(stored[0].direction, 'CROSS_BELOW');
});

test('PriceAlertManager: removeAlert deletes specific alert', () => {
  localStorage.clear();
  const a1 = addAlert(4300.00, { currentPrice: 4250.00 });
  const a2 = addAlert(4350.00, { currentPrice: 4250.00 });

  assert.equal(getAlerts().length, 2);
  removeAlert(a1.id);

  const remaining = getAlerts();
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, a2.id);
});

test('PriceAlertManager: real-time check triggers notification when price crosses above target', () => {
  localStorage.clear();
  window.Android.notifications = [];
  window.Android.haptics = [];

  // Current price is 4280, alert at 4301.00
  const alert = addAlert(4301.00, { currentPrice: 4280.00 });
  assert.equal(alert.status, 'ACTIVE');

  // Sub-tick: 4295.00 -> not triggered
  const triggeredSub = checkPrice(4295.00);
  assert.equal(triggeredSub, false);
  assert.equal(getAlerts()[0].status, 'ACTIVE');
  assert.equal(window.Android.notifications.length, 0);

  // Cross tick: 4301.50 -> crosses 4301.00 -> TRIGGERED!
  const triggeredCross = checkPrice(4301.50);
  assert.equal(triggeredCross, true);

  const stored = getAlerts();
  assert.equal(stored[0].status, 'TRIGGERED');
  assert.ok(stored[0].triggeredAt > 0);

  // Check Android notification payload format
  assert.equal(window.Android.notifications.length, 1);
  const notif = window.Android.notifications[0];
  assert.equal(notif.title, '🔔 Alarm Harga: XAU/USD Menyentuh 4301.50');
  assert.equal(notif.message, 'Target harga 4301.00 telah tercapai! Pantau aksi harga di chart.');
  assert.equal(notif.url, 'http://localhost:8080/apps/mapping/index.html#Dashboard');

  // Check haptic feedback
  assert.equal(window.Android.haptics.length, 1);
  assert.equal(window.Android.haptics[0], 18);
});

test('PriceAlertManager: real-time check triggers notification when price crosses below target', () => {
  localStorage.clear();
  window.Android.notifications = [];

  // Current price is 4280, alert at 4200.00 (CROSS_BELOW)
  addAlert(4200.00, { currentPrice: 4280.00 });

  checkPrice(4250.00); // previous price updated to 4250
  assert.equal(window.Android.notifications.length, 0);

  // Cross tick down: 4198.00 -> crossed below 4200.00
  const triggered = checkPrice(4198.00);
  assert.equal(triggered, true);

  const stored = getAlerts();
  assert.equal(stored[0].status, 'TRIGGERED');
  assert.equal(window.Android.notifications.length, 1);
  assert.equal(window.Android.notifications[0].title, '🔔 Alarm Harga: XAU/USD Menyentuh 4198.00');
  assert.equal(window.Android.notifications[0].message, 'Target harga 4200.00 telah tercapai! Pantau aksi harga di chart.');
});

test('PriceAlertManager: resetAlert sets TRIGGERED alert back to ACTIVE', () => {
  localStorage.clear();
  const alert = addAlert(4300.00, { currentPrice: 4250.00 });
  checkPrice(4305.00); // Triggers it

  assert.equal(getAlerts()[0].status, 'TRIGGERED');

  const reset = resetAlert(alert.id, { currentPrice: 4290.00 });
  assert.equal(reset.status, 'ACTIVE');
  assert.equal(reset.triggeredAt, null);
  assert.equal(getAlerts()[0].status, 'ACTIVE');
});

test('PriceAlertManager: clearAlerts filters correctly', () => {
  localStorage.clear();
  addAlert(4300.00, { currentPrice: 4250.00 });
  addAlert(4400.00, { currentPrice: 4250.00 });
  checkPrice(4310.00); // 4300 is triggered, 4400 is still active

  assert.equal(getStats().total, 2);
  assert.equal(getStats().triggered, 1);
  assert.equal(getStats().active, 1);

  clearAlerts('triggered');
  assert.equal(getStats().total, 1);
  assert.equal(getStats().active, 1);

  clearAlerts('all');
  assert.equal(getStats().total, 0);
});

test('PriceAlertManager: renderAlertList creates UI structure with active items', () => {
  localStorage.clear();
  addAlert(4300.00, { currentPrice: 4250.00, note: 'Daily High' });

  // Mock DOM element
  const mockContainer = {
    innerHTML: '',
    querySelector: () => null,
    querySelectorAll: () => []
  };
  globalThis.document = {
    body: { contains: () => true },
    querySelector: () => mockContainer
  };

  renderAlertList(mockContainer);
  assert.ok(mockContainer.innerHTML.includes('Alarm Target Harga'));
  assert.ok(mockContainer.innerHTML.includes('4300.00'));
  assert.ok(mockContainer.innerHTML.includes('Daily High'));
  assert.ok(mockContainer.innerHTML.includes('1 Aktif'));
});

test('PriceAlertManager: checkIctIntrabarSweeps is permanently disabled (anti-spam)', () => {
  clearIctCooldowns();
  window.Android.notifications = [];
  window.__amyfxMarketOpen = true;

  window.AmyMarketContext = {
    session: 'LONDON / NEW YORK OVERLAP',
    liquidity: [
      { label: 'BSL', level: 2660.00, side: 'BUY', status: 'ACTIVE' },
      { label: 'SSL', level: 2635.00, side: 'SELL', status: 'ACTIVE' }
    ],
    m15: { structure: 'BULLISH', invalidLevel: 2638.00 }
  };

  const events = checkIctIntrabarSweeps(2660.50, 2658.00);

  assert.equal(events.length, 0, 'Intrabar sweeps must be disabled to prevent spam');
  assert.equal(window.Android.notifications.length, 0, 'No spam notifications sent');
});

test('PriceAlertManager: checkIctIntrabarSweeps suppresses instant SSL sweep alert', () => {
  clearIctCooldowns();
  window.Android.notifications = [];
  window.__amyfxMarketOpen = true;

  window.AmyMarketContext = {
    session: 'NEW YORK',
    liquidity: [
      { label: 'SSL', level: 2635.00, side: 'SELL', status: 'ACTIVE' }
    ]
  };

  const events = checkIctIntrabarSweeps(2634.00, 2636.50);

  assert.equal(events.length, 0);
  assert.equal(window.Android.notifications.length, 0);
});

test('PriceAlertManager: checkIctIntrabarSweeps suppresses anti-jitter alerts', () => {
  clearIctCooldowns();
  window.Android.notifications = [];
  window.__amyfxMarketOpen = true;

  window.AmyMarketContext = {
    liquidity: [{ label: 'BSL', level: 2660.00, side: 'BUY', status: 'ACTIVE' }]
  };

  const first = checkIctIntrabarSweeps(2661.00, 2659.00);
  assert.equal(first.length, 0);
  assert.equal(window.Android.notifications.length, 0);

  const second = checkIctIntrabarSweeps(2662.00, 2659.50);
  assert.equal(second.length, 0);
  assert.equal(window.Android.notifications.length, 0);
});

test('PriceAlertManager: checkIctIntrabarSweeps suppresses POI entry alerts', () => {
  clearIctCooldowns();
  window.Android.notifications = [];
  window.__amyfxMarketOpen = true;

  window.AmyMarketContext = {
    m15: {
      poi: { low: 2645.00, high: 2648.00, label: 'Bullish Order Block M15', ce: 2646.50 }
    }
  };

  const events = checkIctIntrabarSweeps(2647.00, 2650.00);

  assert.equal(events.length, 0);
  assert.equal(window.Android.notifications.length, 0);
});

test('PriceAlertManager: checkIctIntrabarSweeps suppresses structure break alerts', () => {
  clearIctCooldowns();
  window.Android.notifications = [];
  window.__amyfxMarketOpen = true;

  window.AmyMarketContext = {
    m15: {
      structure: 'BULLISH',
      invalidLevel: 2640.00
    }
  };

  const events = checkIctIntrabarSweeps(2639.50, 2642.00);

  assert.equal(events.length, 0);
  assert.equal(window.Android.notifications.length, 0);
});

test('PriceAlertManager: checkIctIntrabarSweeps suppresses alerts during market closure', () => {
  clearIctCooldowns();
  window.Android.notifications = [];

  window.__amyfxMarketOpen = false;
  window.AmyMarketContext = {
    session: 'PASAR TUTUP',
    liquidity: [{ label: 'BSL', level: 2660.00, side: 'BUY', status: 'ACTIVE' }]
  };

  const events = checkIctIntrabarSweeps(2665.00, 2655.00);

  assert.equal(events.length, 0);
  assert.equal(window.Android.notifications.length, 0);
});

test('PriceAlertManager: checkPrice suppresses automatic intrabar spam when no manual alerts set', () => {
  clearIctCooldowns();
  localStorage.clear();
  window.Android.notifications = [];
  window.__amyfxMarketOpen = true;

  window.AmyMarketContext = {
    liquidity: [{ label: 'PDH', level: 2670.00, side: 'BUY', status: 'ACTIVE' }]
  };

  setPreviousPrice(2668.00);

  const triggered = checkPrice(2671.00);

  assert.equal(triggered, false);
  assert.equal(window.Android.notifications.length, 0);
});

test('PriceAlertManager: playAlertBeep delegates to native Android.playNotificationSound when available (item 1.60)', () => {
  const initialCount = window.Android.soundPlayedCount;
  playAlertBeep();
  assert.equal(window.Android.soundPlayedCount, initialCount + 1, 'playAlertBeep must delegate to Android.playNotificationSound');

  // Verify MainActivity.kt defines @JavascriptInterface fun playNotificationSound()
  const mainActivity = fs.readFileSync('app/src/main/java/com/amyelitesuite/MainActivity.kt', 'utf8');
  assert.match(mainActivity, /@JavascriptInterface\s+fun playNotificationSound\(\)/, 'MainActivity.kt must expose playNotificationSound bridge');
  assert.match(mainActivity, /RingtoneManager\.getDefaultUri/, 'MainActivity.kt must use RingtoneManager');
});

test('PriceAlertManager: loaded in index.html (Beranda) to prevent silent alert failure (item 1.11)', () => {
  const indexHtml = fs.readFileSync('app/src/main/assets/index.html', 'utf8');
  assert.match(indexHtml, /<script type="module" src="apps\/mapping\/js\/ict-workspace\/price-alert-manager\.js"><\/script>/, 'index.html must load price-alert-manager.js module');
});

test('PriceAlertManager: playAlertBeep prioritizes native Android.playGoldChime and soundType (item 2.28)', () => {
  const initialGold = window.Android.playGoldChimeCount;
  playAlertBeep('gold');
  assert.equal(window.Android.playGoldChimeCount, initialGold + 1, 'playAlertBeep("gold") must call playGoldChime');

  // Verify MainActivity.kt defines playGoldChime and playNotificationSound overload
  const mainActivity = fs.readFileSync('app/src/main/java/com/amyelitesuite/MainActivity.kt', 'utf8');
  assert.match(mainActivity, /@JavascriptInterface\s+fun playGoldChime\(\)/, 'MainActivity.kt must expose playGoldChime');
  assert.match(mainActivity, /@JavascriptInterface\s+fun playNotificationSound\(soundType:\s*String\?\)/, 'MainActivity.kt must support soundType overload');
  assert.match(mainActivity, /ToneGenerator/, 'MainActivity.kt must use ToneGenerator for gold chime');
});
test('PriceAlertManager: eliminates spurious immediate trigger when target equals current price (item 1.46)', () => {
  localStorage.clear();
  window.Android.notifications = [];
  setPreviousPrice(null);

  // User adds alert at 2650.00 while current price is 2650.00
  const alert = addAlert(2650.00, { currentPrice: 2650.00 });
  assert.equal(alert.status, 'ACTIVE');
  assert.equal(alert.lastCheckedPrice, 2650.00);

  // Tick 1 at 2650.00 -> should NOT fire immediately (spurious trigger prevented)
  const fired1 = checkPrice(2650.00);
  assert.equal(fired1, false);
  assert.equal(getAlerts()[0].status, 'ACTIVE');
  assert.equal(window.Android.notifications.length, 0);

  // Tick 2 price moves slightly down to 2649.50
  const fired2 = checkPrice(2649.50);
  assert.equal(fired2, false);
  assert.equal(getAlerts()[0].status, 'ACTIVE');

  // Tick 3 price crosses back above 2650.00 to 2650.50 -> NOW fires!
  const fired3 = checkPrice(2650.50);
  assert.equal(fired3, true);
  assert.equal(getAlerts()[0].status, 'TRIGGERED');
  assert.equal(window.Android.notifications.length, 1);
});

test('PriceAlertManager: persists lastCheckedPrice to localStorage during ticks (item 1.46)', () => {
  localStorage.clear();
  setPreviousPrice(null);

  // Create alert at 2700.00 when price is 2650.00
  addAlert(2700.00, { currentPrice: 2650.00 });
  assert.equal(getAlerts()[0].lastCheckedPrice, 2650.00);

  // Tick to 2660.00
  checkPrice(2660.00);

  // Check that localStorage persisted the updated lastCheckedPrice
  const reloaded = JSON.parse(localStorage.getItem('amyfx_custom_price_alerts'));
  assert.equal(reloaded[0].lastCheckedPrice, 2660.00, 'lastCheckedPrice must be saved to localStorage');
});

test('PriceAlertManager: getAvailableIctLevels extracts SSL, BSL, POI, and PDH/PDL presets', () => {
  window.AmyMarketContext = {
    liquidity: [
      { label: 'SSL', level: 2640.20 },
      { label: 'BSL', level: 2655.80 },
      { label: 'PDH', level: 2662.00 },
      { label: 'PDL', level: 2636.50 },
      { label: 'ASIA H', level: 2648.00 },
      { label: 'ASIA L', level: 2642.00 }
    ],
    m15: {
      poi: { label: 'Demand FVG', low: 2641.00, high: 2644.00, ce: 2642.50 }
    },
    plan: {
      entry: 2643.00,
      sl: 2639.00,
      tp1: 2655.00,
      signalName: 'BUY ENTRY'
    }
  };

  const levels = getAvailableIctLevels();
  assert.ok(Array.isArray(levels));
  assert.ok(levels.length >= 6);

  const ssl = levels.find(l => l.id === 'ssl');
  assert.ok(ssl);
  assert.equal(ssl.price, 2640.20);
  assert.equal(ssl.direction, 'CROSS_BELOW');
  assert.ok(ssl.note.includes('SSL Sweep'));

  const bsl = levels.find(l => l.id === 'bsl');
  assert.ok(bsl);
  assert.equal(bsl.price, 2655.80);
  assert.equal(bsl.direction, 'CROSS_ABOVE');
  assert.ok(bsl.note.includes('BSL Sweep'));

  const poi = levels.find(l => l.id === 'poi');
  assert.ok(poi);
  assert.equal(poi.price, 2642.50);

  const planEntry = levels.find(l => l.id === 'plan_entry');
  assert.ok(planEntry);
  assert.equal(planEntry.price, 2643.00);
});

test('PriceAlertManager: SSL Sweep alert triggers custom sweep notification and gold chime', () => {
  localStorage.clear();
  window.Android.notifications = [];
  window.Android.playGoldChimeCount = 0;
  setPreviousPrice(null);

  // Set alert for SSL Sweep at 2640.00 when price is 2645.00
  addAlert(2640.00, {
    direction: 'CROSS_BELOW',
    note: '⚡ SSL Sweep (Likuiditas Bawah)',
    currentPrice: 2645.00
  });

  // Price crosses below to 2639.50
  const triggered = checkPrice(2639.50);
  assert.equal(triggered, true);

  assert.equal(window.Android.notifications.length, 1);
  const notif = window.Android.notifications[0];
  assert.ok(notif.title.includes('⚡ SSL Sweep'));
  assert.ok(notif.message.includes('Level Likuiditas 2640.00 telah tersapu (Sweep)!'));
  assert.ok(window.Android.playGoldChimeCount > 0, 'Must play gold chime on ICT sweep');
});
