import test from 'node:test';
import assert from 'node:assert/strict';

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
    showNotificationWithUrl(title, message, url) {
      this.notifications.push({ title, message, url });
    },
    showNotification(title, message) {
      this.notifications.push({ title, message });
    },
    triggerHaptic(ms) {
      this.haptics.push(ms);
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
  isGoldMarketOpen
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

test('PriceAlertManager: checkIctIntrabarSweeps triggers instant 0s BSL sweep alert', () => {
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

  assert.equal(events.length, 1);
  assert.equal(events[0].key, 'BSL');
  assert.equal(events[0].type, 'SWEEP');
  assert.equal(events[0].level, 2660.00);
  assert.equal(events[0].price, 2660.50);

  assert.equal(window.Android.notifications.length, 1);
  assert.ok(window.Android.notifications[0].title.includes('BSL'));
  assert.ok(window.Android.notifications[0].message.includes('2660.50'));
});

test('PriceAlertManager: checkIctIntrabarSweeps triggers instant SSL sweep alert', () => {
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

  assert.equal(events.length, 1);
  assert.equal(events[0].key, 'SSL');
  assert.equal(events[0].type, 'SWEEP');
  assert.equal(events[0].level, 2635.00);
});

test('PriceAlertManager: checkIctIntrabarSweeps respects 5-minute anti-jitter cooldown', () => {
  clearIctCooldowns();
  window.Android.notifications = [];
  window.__amyfxMarketOpen = true;

  window.AmyMarketContext = {
    liquidity: [{ label: 'BSL', level: 2660.00, side: 'BUY', status: 'ACTIVE' }]
  };

  const first = checkIctIntrabarSweeps(2661.00, 2659.00);
  assert.equal(first.length, 1);
  assert.equal(window.Android.notifications.length, 1);

  const second = checkIctIntrabarSweeps(2662.00, 2659.50);
  assert.equal(second.length, 0);
  assert.equal(window.Android.notifications.length, 1);
});

test('PriceAlertManager: checkIctIntrabarSweeps triggers POI entry alert', () => {
  clearIctCooldowns();
  window.Android.notifications = [];
  window.__amyfxMarketOpen = true;

  window.AmyMarketContext = {
    m15: {
      poi: { low: 2645.00, high: 2648.00, label: 'Bullish Order Block M15', ce: 2646.50 }
    }
  };

  const events = checkIctIntrabarSweeps(2647.00, 2650.00);

  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'POI');
  assert.ok(events[0].key.startsWith('POI_'));
  assert.equal(window.Android.notifications.length, 1);
  assert.ok(window.Android.notifications[0].title.includes('UJI ZONA POI'));
});

test('PriceAlertManager: checkIctIntrabarSweeps triggers structure break / invalidation', () => {
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

  assert.equal(events.length, 1);
  assert.equal(events[0].key, 'INVALIDATION');
  assert.equal(events[0].type, 'BREAK');
  assert.ok(window.Android.notifications[0].title.includes('BREAK STRUKTUR'));
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

test('PriceAlertManager: checkPrice integrates live ICT sweeps even without manual custom alerts', () => {
  clearIctCooldowns();
  localStorage.clear();
  window.Android.notifications = [];
  window.__amyfxMarketOpen = true;

  window.AmyMarketContext = {
    liquidity: [{ label: 'PDH', level: 2670.00, side: 'BUY', status: 'ACTIVE' }]
  };

  setPreviousPrice(2668.00);

  const triggered = checkPrice(2671.00);

  assert.equal(triggered, true);
  assert.equal(window.Android.notifications.length, 1);
  assert.ok(window.Android.notifications[0].title.includes('PDH'));
});

