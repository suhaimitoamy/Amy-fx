import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  detectLiquiditySweep,
  renderLiveAssistant
} from '../app/src/main/assets/apps/mapping/js/ict-workspace/ict-presentation.js';

function setupDomMock() {
  const elements = {
    'amy-live-assistant': { className: '' },
    'assistant-badge': { textContent: '', className: '' },
    'assistant-primary-msg': { textContent: '' },
    'assistant-sub-msg': { textContent: '' },
    'assistant-confluence-tag': { textContent: '', innerHTML: '' },
    'assistant-clock': { textContent: '' }
  };

  globalThis.document = {
    getElementById: id => elements[id] || null
  };

  let notificationSent = null;
  globalThis.window = {
    Android: {
      showNotificationWithUrl: (title, body, url) => {
        notificationSent = { title, body, url };
      }
    },
    AmyMarketContext: { session: 'LONDON' }
  };

  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {}
  };

  return { elements, getNotification: () => notificationSent };
}

test('detectLiquiditySweep correctly detects SSL sweep with exact numbers', () => {
  const amy = {
    dashboard: {
      sweepStatus: 1,
      sweepDir: 1,
      sweep: { dir: 1, price: 2642.50, extreme: 2640.80 },
      ssl: 2642.50
    },
    entry: { text: 'SSL swept di M5' }
  };

  const sweep = detectLiquiditySweep(amy);
  assert.ok(sweep);
  assert.equal(sweep.name, 'SSL');
  assert.equal(sweep.level, 2642.50);
  assert.equal(sweep.extreme, 2640.80);
  assert.equal(sweep.side, 'BUY');
});

test('renderLiveAssistant produces non-generic SSL sweep notification with exact numbers and action', () => {
  const { elements, getNotification } = setupDomMock();

  const nowSec = Math.floor(Date.now() / 1000);
  const amy = {
    source: { M5: nowSec },
    dashboard: {
      sweepStatus: 1,
      sweepDir: 1,
      sweep: { dir: 1, price: 2642.50, extreme: 2640.80 },
      ssl: 2642.50
    },
    entry: { text: 'SSL swept di M5' }
  };

  renderLiveAssistant(amy, null, { assistantNotif: true }, { session: 'LONDON' });

  assert.equal(elements['assistant-badge'].textContent, 'SSL SWEPT');
  assert.equal(elements['assistant-primary-msg'].textContent, '💧 SSL @ 2642.50 Swept!');
  assert.equal(elements['assistant-sub-msg'].textContent, 'Tersapu hingga ekor 2640.80. Pantau pembentukan rejection untuk potensi BUY.');

  const notif = getNotification();
  assert.ok(notif, 'Notification should be dispatched');
  assert.equal(notif.title, '💧 Asisten Amy: SSL @ 2642.50 Swept!');
  assert.match(notif.body, /SSL @ 2642\.50 Swept!/);
  assert.match(notif.body, /tersapu hingga ekor 2640\.80/i);
  assert.match(notif.body, /Pantau pembentukan rejection untuk potensi BUY/);
  assert.doesNotMatch(notif.body, /Likuiditas terambil/);
});

test('detectLiquiditySweep and renderLiveAssistant handle BSL sweep', () => {
  const { elements, getNotification } = setupDomMock();

  const nowSec = Math.floor(Date.now() / 1000);
  const amy = {
    source: { M5: nowSec },
    dashboard: {
      sweepStatus: 1,
      sweepDir: -1,
      sweep: { dir: -1, price: 2665.30, extreme: 2667.10 },
      bsl: 2665.30
    },
    entry: { text: 'BSL swept di M5' }
  };

  const sweep = detectLiquiditySweep(amy);
  assert.equal(sweep.name, 'BSL');
  assert.equal(sweep.level, 2665.30);
  assert.equal(sweep.extreme, 2667.10);
  assert.equal(sweep.side, 'SELL');

  renderLiveAssistant(amy, null, { assistantNotif: true }, { session: 'LONDON' });

  assert.equal(elements['assistant-badge'].textContent, 'BSL SWEPT');
  assert.equal(elements['assistant-primary-msg'].textContent, '💧 BSL @ 2665.30 Swept!');
  assert.equal(elements['assistant-sub-msg'].textContent, 'Tersapu hingga ekor 2667.10. Pantau pembentukan rejection untuk potensi SELL.');

  const notif = getNotification();
  assert.equal(notif.title, '💧 Asisten Amy: BSL @ 2665.30 Swept!');
  assert.match(notif.body, /BSL @ 2665\.30 Swept!/);
  assert.match(notif.body, /tersapu hingga ekor 2667\.10/i);
  assert.match(notif.body, /Pantau pembentukan rejection untuk potensi SELL/);
});

test('detectLiquiditySweep detects Asia High and Asia Low sweeps', () => {
  const amyAsiaHigh = {
    dashboard: {},
    trigger: {
      candle: { high: 2660.10, close: 2657.80, low: 2655.00 }
    },
    levels: { asiaHigh: 2658.20, asiaLow: 2638.50 }
  };
  const sweepHigh = detectLiquiditySweep(amyAsiaHigh);
  assert.ok(sweepHigh);
  assert.equal(sweepHigh.name, 'Asia High');
  assert.equal(sweepHigh.level, 2658.20);
  assert.equal(sweepHigh.extreme, 2660.10);
  assert.equal(sweepHigh.side, 'SELL');

  const amyAsiaLow = {
    dashboard: {},
    trigger: {
      candle: { high: 2641.00, close: 2639.10, low: 2636.90 }
    },
    levels: { asiaHigh: 2658.20, asiaLow: 2638.50 }
  };
  const sweepLow = detectLiquiditySweep(amyAsiaLow);
  assert.ok(sweepLow);
  assert.equal(sweepLow.name, 'Asia Low');
  assert.equal(sweepLow.level, 2638.50);
  assert.equal(sweepLow.extreme, 2636.90);
  assert.equal(sweepLow.side, 'BUY');
});

test('detectLiquiditySweep detects PDH and PDL sweeps', () => {
  const amyPdh = {
    dashboard: {},
    trigger: {
      candle: { high: 2672.40, close: 2669.50, low: 2665.00 }
    },
    levels: { pdh: 2670.00, pdl: 2630.00 }
  };
  const sweepPdh = detectLiquiditySweep(amyPdh);
  assert.ok(sweepPdh);
  assert.equal(sweepPdh.name, 'PDH');
  assert.equal(sweepPdh.level, 2670.00);
  assert.equal(sweepPdh.extreme, 2672.40);
  assert.equal(sweepPdh.side, 'SELL');

  const amyPdl = {
    dashboard: {},
    trigger: {
      candle: { high: 2635.00, close: 2631.00, low: 2628.10 }
    },
    levels: { pdh: 2670.00, pdl: 2630.00 }
  };
  const sweepPdl = detectLiquiditySweep(amyPdl);
  assert.ok(sweepPdl);
  assert.equal(sweepPdl.name, 'PDL');
  assert.equal(sweepPdl.level, 2630.00);
  assert.equal(sweepPdl.extreme, 2628.10);
  assert.equal(sweepPdl.side, 'BUY');
});

test('DriverSetupSyncWorker code audit verifies numeric sweep formatting and no generic messages', () => {
  const workerCode = fs.readFileSync('app/src/main/java/com/amyelitesuite/DriverSetupSyncWorker.kt', 'utf8');

  // Verify generic text is completely gone
  assert.ok(!workerCode.includes('Likuiditas terambil, pantau reaksi harga.'));
  assert.ok(!workerCode.includes('Sell-Side (SSL) Swept di M5'));
  assert.ok(!workerCode.includes('Buy-Side (BSL) Swept di M5'));

  // Verify helper and precision format exists
  assert.ok(workerCode.includes('resolveSweepDetails'));
  assert.ok(workerCode.includes('SweepDetails'));
  assert.ok(workerCode.includes('Swept!'));
  assert.ok(workerCode.includes('Tersapu hingga ekor'));
  assert.ok(workerCode.includes('Pantau pembentukan rejection untuk potensi'));

  // Verify all 4 categories handled
  assert.ok(workerCode.includes('Asia High'));
  assert.ok(workerCode.includes('Asia Low'));
  assert.ok(workerCode.includes('PDH'));
  assert.ok(workerCode.includes('PDL'));
  assert.ok(workerCode.includes('SSL'));
  assert.ok(workerCode.includes('BSL'));
});
