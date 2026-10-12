import test from 'node:test';
import assert from 'node:assert/strict';
import { isGoldMarketOpen, goldSession, buildMarketContext } from '../lib/scalper-engine/market-context.mjs';
import { evaluateSixDrivers } from '../lib/scalper-engine/six-drivers.mjs';
import {
  isGoldMarketOpen as isGoldMarketOpenPres,
  renderLiveAssistant
} from '../app/src/main/assets/apps/mapping/js/ict-workspace/ict-presentation.js';

test('isGoldMarketOpen correctly identifies weekend and market closures', () => {
  // Saturday 12:00 UTC (Saturday noon NY)
  const saturday = Date.parse('2026-10-03T16:00:00Z') / 1000;
  assert.equal(isGoldMarketOpen(saturday), false);
  assert.equal(isGoldMarketOpenPres(saturday), false);
  assert.equal(goldSession(saturday), 'PASAR TUTUP');

  // Friday 16:59 EDT (20:59 UTC) -> Open
  const friBeforeClose = Date.parse('2026-10-02T20:59:00Z') / 1000;
  assert.equal(isGoldMarketOpen(friBeforeClose), true);
  assert.equal(isGoldMarketOpenPres(friBeforeClose), true);

  // Friday 17:01 EDT (21:01 UTC) -> Market Closed for Weekend
  const friAfterClose = Date.parse('2026-10-02T21:01:00Z') / 1000;
  assert.equal(isGoldMarketOpen(friAfterClose), false);
  assert.equal(isGoldMarketOpenPres(friAfterClose), false);
  assert.equal(goldSession(friAfterClose), 'PASAR TUTUP');

  // Sunday 16:59 EDT (20:59 UTC) -> Still Closed
  const sunBeforeOpen = Date.parse('2026-10-04T20:59:00Z') / 1000;
  assert.equal(isGoldMarketOpen(sunBeforeOpen), false);
  assert.equal(isGoldMarketOpenPres(sunBeforeOpen), false);
  assert.equal(goldSession(sunBeforeOpen), 'PASAR TUTUP');

  // Sunday 17:01 EDT (21:01 UTC) -> Market Opens
  const sunAfterOpen = Date.parse('2026-10-04T21:01:00Z') / 1000;
  assert.equal(isGoldMarketOpen(sunAfterOpen), true);
  assert.equal(isGoldMarketOpenPres(sunAfterOpen), true);

  // Midweek daily rollover 17:30 EDT (21:30 UTC on Wednesday) -> Closed
  const wedRollover = Date.parse('2026-10-07T21:30:00Z') / 1000;
  assert.equal(isGoldMarketOpen(wedRollover), false);
  assert.equal(isGoldMarketOpenPres(wedRollover), false);
  assert.equal(goldSession(wedRollover), 'PASAR TUTUP');

  // Midweek NY core session 09:30 EDT (13:30 UTC on Wednesday) -> Open
  const wedNyCore = Date.parse('2026-10-07T13:30:00Z') / 1000;
  assert.equal(isGoldMarketOpen(wedNyCore), true);
  assert.equal(isGoldMarketOpenPres(wedNyCore), true);
  assert.equal(goldSession(wedNyCore), 'NEW YORK');
});

test('renderLiveAssistant suppresses notifications and displays PASAR TUTUP when market is closed', () => {
  // Setup DOM mock
  const domElements = {
    'amy-live-assistant': { className: '' },
    'assistant-badge': { textContent: '', className: '' },
    'assistant-primary-msg': { textContent: '' },
    'assistant-sub-msg': { textContent: '' },
    'assistant-confluence-tag': { textContent: '', innerHTML: '' },
    'assistant-clock': { textContent: '' }
  };

  globalThis.document = {
    getElementById: id => domElements[id] || null
  };

  let notifiedCall = null;
  globalThis.window = {
    Android: {
      showNotificationWithUrl: (title, body, url) => {
        notifiedCall = { title, body, url };
      }
    },
    AmyMarketContext: { session: 'PASAR TUTUP' }
  };

  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {}
  };

  // Mock Friday close context containing "SSL swept · Fresh"
  const amyData = {
    source: { M5: Math.floor(Date.now() / 1000) },
    dashboard: { biasDir: 1 },
    entry: {
      text: 'SSL swept · Fresh\nCari konfirmasi dari OB/FVG\nPosisi EQ Zone',
      score: 33,
      grade: 'NO_SETUP'
    }
  };

  renderLiveAssistant(amyData, null, { assistantNotif: true }, { session: 'PASAR TUTUP' });

  // Verify DOM state
  assert.equal(domElements['assistant-badge'].textContent, 'PASAR TUTUP');
  assert.equal(domElements['assistant-badge'].className, 'assistant-badge badge-neutral');
  assert.match(domElements['assistant-primary-msg'].textContent, /Pasar Gold.*Tutup/i);
  assert.match(domElements['assistant-sub-msg'].textContent, /Perdagangan libur akhir pekan/i);

  // CRITICAL: No notification must be sent!
  assert.equal(notifiedCall, null, 'No notification should be dispatched when market is closed');
});

test('buildMarketContext enforces market closed state, rejects A+, and sets event to null during weekend', () => {
  const saturday = Date.parse('2026-10-03T16:00:00Z') / 1000;
  const candle = (t, close) => ({
    open_time: t,
    close_time: t + 900,
    open: close,
    high: close + 2,
    low: close - 2,
    close,
    is_closed: true
  });
  const m15 = Array.from({ length: 50 }, (_, i) => candle(saturday - (50 - i) * 900, 2650 + i * 0.5));
  const m5 = Array.from({ length: 50 }, (_, i) => ({
    open_time: saturday - (50 - i) * 300,
    close_time: saturday - (49 - i) * 300,
    open: 2670,
    high: 2672,
    low: 2668,
    close: 2670,
    is_closed: true
  }));
  const h1 = Array.from({ length: 40 }, (_, i) => ({
    open_time: saturday - (40 - i) * 3600,
    close_time: saturday - (39 - i) * 3600,
    open: 2640,
    high: 2675,
    low: 2635,
    close: 2670,
    is_closed: true
  }));

  const ctx = buildMarketContext({ h1, m15, m5, nowSeconds: saturday });
  assert.equal(ctx.marketState, 'PASAR TUTUP (LIBUR AKHIR PEKAN)');
  assert.equal(ctx.execution.status, 'NOT READY');
  assert.equal(ctx.execution.aPlusReady, false);
  assert.equal(ctx.event, null, 'No notification event allowed on market closure');

  // Checklist must show market closed check failed
  const marketOpenCheck = ctx.execution.checklist.find(c => c.label.includes('Jam perdagangan aktif'));
  assert.ok(marketOpenCheck);
  assert.equal(marketOpenCheck.ok, false);
});

test('evaluateSixDrivers marks all drivers as MARKET_CLOSED during market closure', () => {
  const saturday = Date.parse('2026-10-03T16:00:00Z') / 1000;
  const candle = (t, close) => ({
    open_time: t,
    close_time: t + 900,
    open: close,
    high: close + 2,
    low: close - 2,
    close,
    is_closed: true
  });
  const m15 = Array.from({ length: 50 }, (_, i) => candle(saturday - (50 - i) * 900, 2650 + i * 0.5));
  const m5 = Array.from({ length: 50 }, (_, i) => ({
    open_time: saturday - (50 - i) * 300,
    close_time: saturday - (49 - i) * 300,
    open: 2670,
    high: 2672,
    low: 2668,
    close: 2670,
    is_closed: true
  }));
  const h1 = Array.from({ length: 40 }, (_, i) => ({
    open_time: saturday - (40 - i) * 3600,
    close_time: saturday - (39 - i) * 3600,
    open: 2640,
    high: 2675,
    low: 2635,
    close: 2670,
    is_closed: true
  }));

  const context = buildMarketContext({ h1, m15, m5, nowSeconds: saturday });
  const evalResult = evaluateSixDrivers({ m15, m5, h1, context, nowSeconds: saturday });

  assert.equal(evalResult.candidates.length, 0, 'No candidate setups when market closed');
  for (const driver of evalResult.drivers) {
    assert.equal(driver.state, 'MARKET_CLOSED');
    assert.match(driver.reason, /Pasar Gold tutup/);
  }
});

test('AmyFxNotificationGate code guarantees strict market closure silence', async () => {
  const fs = await import('node:fs');
  const gateCode = fs.readFileSync('app/src/main/java/com/amyelitesuite/AmyFxNotificationGate.java', 'utf8');
  assert.ok(gateCode.includes('isGoldMarketOpen'));
  assert.ok(gateCode.includes('isTradingAlert'));
  assert.ok(gateCode.includes('if (isTradingAlert(gateKey) && !isGoldMarketOpen(nowMs))'));

  const workerCode = fs.readFileSync('app/src/main/java/com/amyelitesuite/DriverSetupSyncWorker.kt', 'utf8');
  assert.ok(workerCode.includes('isGoldMarketOpen'));
  assert.ok(workerCode.includes('PASAR TUTUP'));
});
