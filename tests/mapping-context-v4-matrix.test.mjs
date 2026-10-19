import test from 'node:test';
import assert from 'node:assert/strict';
import {dashboardContextV4Rows, renderBiasDashboardV2} from '../app/src/main/assets/apps/mapping/js/ict-workspace/ict-presentation.js';

function setupDomMock() {
  const elements = {};
  const mockEl = (id) => {
    const el = {
      id,
      innerHTML: '',
      textContent: '',
      style: {},
      className: ''
    };
    elements[id] = el;
    return el;
  };

  globalThis.document = {
    getElementById: (id) => elements[id] || mockEl(id)
  };

  return {
    elements,
    cleanup: () => {
      delete globalThis.document;
    }
  };
}

test('dashboardContextV4Rows produces exactly 11 pure market context rows', () => {
  const amy = {
    dashboard: {
      biasDir: 1,
      mssDir: 1,
      rangeHigh: 2680.00,
      rangeLow: 2640.00,
      eqLow: 2658.00,
      eqHigh: 2662.00,
      priceZone: -1,
      bsl: 2680.00,
      ssl: 2640.00,
      sweepStatus: 0,
      poi: { kind: 'OB', side: 'BUY', low: 2645.00, high: 2648.00, ce: 2646.50 },
      candle: { close: 2646.00 }
    },
    levels: {
      pdh: 2675.00,
      pdl: 2635.00,
      asiaHigh: 2660.00,
      asiaLow: 2642.00
    },
    currentPrice: 2646.00
  };

  const context = {
    h1: { bias: 'BULLISH', swingHigh: 2685.00, swingLow: 2630.00 },
    m15: { structure: 'BULLISH' },
    m5: { status: 'WAITING' },
    session: 'LONDON',
    price: 2646.00
  };

  const rows = dashboardContextV4Rows(amy, context);
  assert.equal(rows.length, 11, 'Must have exactly 11 rows');

  const keys = rows.map(r => r[0]);
  assert.deepEqual(keys, [
    'MATRIKS 3-TIMEFRAME',
    'FASE NARASI MARKET',
    'DEALING RANGE & ZONA',
    'MAGNET ATAS (BSL/PDH)',
    'MAGNET BAWAH (SSL/PDL)',
    'SESI & ASIA RANGE',
    'INDUCEMENT (IDM)',
    'ZONA SUPPLY (M15)',
    'ZONA DEMAND (M15)',
    'BATAS CHoCH (H1)',
    'PANDUAN KONTEKS'
  ]);
});

test('dashboardContextV4Rows detects Bullish Pullback in Demand zone with Anti-Sell guidance', () => {
  const amy = {
    dashboard: {
      biasDir: 1,
      mssDir: -1,
      rangeHigh: 2680.00,
      rangeLow: 2640.00,
      priceZone: -1,
      poiLocation: -1,
      poi: { kind: 'OB', side: 'BUY', low: 2645.00, high: 2648.00, ce: 2646.50 },
      candle: { close: 2646.00 }
    },
    currentPrice: 2646.00
  };

  const context = {
    h1: { bias: 'BULLISH', swingHigh: 2685.00, swingLow: 2630.00 },
    m15: { structure: 'BEARISH' },
    m5: { status: 'WAITING' },
    session: 'LONDON',
    price: 2646.00
  };

  const rows = dashboardContextV4Rows(amy, context);
  const phaseRow = rows.find(r => r[0] === 'FASE NARASI MARKET');
  const guideRow = rows.find(r => r[0] === 'PANDUAN KONTEKS');

  assert.match(phaseRow[1], /PULLBACK DI ZONA DEMAND/);
  assert.match(guideRow[1], /JANGAN SELL! Tunggu M5 CHoCH Bullish/);
});

test('dashboardContextV4Rows detects Lower Liquidity Manipulation on SSL Sweep', () => {
  const amy = {
    dashboard: {
      biasDir: 1,
      mssDir: 1,
      rangeHigh: 2680.00,
      rangeLow: 2640.00,
      priceZone: -1,
      sweepStatus: 1,
      sweepDir: 1,
      sweep: { dir: 1, price: 2640.00, extreme: 2638.50 },
      ssl: 2640.00,
      candle: { close: 2641.00 }
    },
    currentPrice: 2641.00
  };

  const context = {
    h1: { bias: 'BULLISH', swingHigh: 2685.00, swingLow: 2630.00 },
    m15: { structure: 'BULLISH' },
    session: 'NEW YORK',
    price: 2641.00
  };

  const rows = dashboardContextV4Rows(amy, context);
  const phaseRow = rows.find(r => r[0] === 'FASE NARASI MARKET');
  const guideRow = rows.find(r => r[0] === 'PANDUAN KONTEKS');

  assert.match(phaseRow[1], /MANIPULASI BAWAH/);
  assert.match(guideRow[1], /Likuiditas Bawah Sudah Diambil/);
});

test('renderBiasDashboardV2 populates DOM with V4 header and 11 table rows', () => {
  const { elements, cleanup } = setupDomMock();

  const amy = {
    dashboard: {
      biasDir: 1,
      mssDir: 1,
      rangeHigh: 2680.00,
      rangeLow: 2640.00,
      priceZone: -1,
      bsl: 2680.00,
      ssl: 2640.00,
      candle: { close: 2650.00 }
    },
    currentPrice: 2650.00
  };

  const context = {
    h1: { bias: 'BULLISH' },
    m15: { structure: 'BULLISH' },
    session: 'LONDON'
  };

  renderBiasDashboardV2(amy, context);

  assert.match(elements['bias-table-header'].textContent, /AMY ICT CONTEXT V4 \[INTRADAY\]/);
  assert.ok(elements['bias-table-body'].innerHTML.includes('MATRIKS 3-TIMEFRAME'));
  assert.ok(elements['bias-table-body'].innerHTML.includes('FASE NARASI MARKET'));
  assert.ok(elements['bias-table-body'].innerHTML.includes('PANDUAN KONTEKS'));

  cleanup();
});
