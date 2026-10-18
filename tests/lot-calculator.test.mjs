import test from 'node:test';
import assert from 'node:assert/strict';

// Setup Mock DOM and Storage for Node test environment
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, val) => storage.set(key, String(val)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear()
};

const domElements = new Map();
function createMockElement(id = '', tag = 'div') {
  const el = {
    id,
    tagName: tag.toUpperCase(),
    value: '',
    textContent: '',
    innerHTML: '',
    className: '',
    classList: {
      _classes: new Set(),
      add(c) { this._classes.add(c); el.className = Array.from(this._classes).join(' '); },
      remove(c) { this._classes.delete(c); el.className = Array.from(this._classes).join(' '); },
      contains(c) { return this._classes.has(c); }
    },
    dataset: {},
    style: {},
    addEventListener: () => {},
    appendChild: (child) => child,
    focus: () => {},
    querySelectorAll: (sel) => []
  };
  if (id) domElements.set(id, el);
  return el;
}

globalThis.document = {
  getElementById: (id) => domElements.get(id) || null,
  createElement: (tag) => createMockElement('', tag),
  head: { appendChild: () => {} },
  body: { appendChild: () => {} },
  querySelectorAll: (sel) => [],
  querySelector: (sel) => null
};

globalThis.window = {
  addEventListener: () => {},
  dispatchEvent: () => {}
};

const {
  calculateLotAndRisk,
  getSavedBalance,
  saveBalance,
  getSavedRiskPercent,
  saveRiskPercent,
  openLotCalculator,
  closeLotCalculator,
  recalculateModalUI,
  BALANCE_KEY,
  RISK_PERCENT_KEY
} = await import('../app/src/main/assets/apps/mapping/js/ict-workspace/lot-calculator.js');

test('Lot & Risk Calculator Engine: Formula Matematis & Presisi (Item 2.1)', async (t) => {
  storage.clear();

  await t.test('1. Hitung ukuran lot ideal BUY dengan modal $1000 dan risiko 1%', () => {
    const res = calculateLotAndRisk({
      balance: 1000,
      riskPercent: 1.0,
      entry: 2650.00,
      sl: 2645.00,
      tp1: 2660.00,
      tp2: 2675.00,
      side: 'BUY'
    });

    assert.equal(res.balance, 1000);
    assert.equal(res.riskPercent, 1.0);
    assert.equal(res.riskAmount, 10.00, 'Risiko 1% dari $1000 harus tepat $10.00');
    assert.equal(res.slDiff, 5.00, 'Jarak SL harus 5.00 pts');
    assert.equal(res.slPips, 50.0, 'Jarak SL pips harus 50.0 pips');
    // $10 / (5.00 * 100) = 10 / 500 = 0.02
    assert.equal(res.lot, 0.02, 'Ukuran lot harus 0.02 lot');
    // Profit TP1: 0.02 * (2660 - 2650) * 100 = 0.02 * 10 * 100 = $20.00
    assert.equal(res.tp1Profit, 20.00, 'Profit TP1 harus $20.00');
    assert.equal(res.rr1, 2.0, 'R:R TP1 harus 1:2.0');
    // Profit TP2: 0.02 * (2675 - 2650) * 100 = 0.02 * 25 * 100 = $50.00
    assert.equal(res.tp2Profit, 50.00, 'Profit TP2 harus $50.00');
    assert.equal(res.rr2, 5.0, 'R:R TP2 harus 1:5.0');
  });

  await t.test('2. Hitung ukuran lot SELL dengan pembulatan ke bawah kelipatan 0.01', () => {
    const res = calculateLotAndRisk({
      balance: 2000,
      riskPercent: 2.0,
      entry: 2680.00,
      sl: 2686.00,
      tp1: 2670.00,
      tp2: 2660.00,
      side: 'SELL'
    });

    assert.equal(res.riskAmount, 40.00, 'Risiko 2% dari $2000 = $40.00');
    assert.equal(res.slDiff, 6.00, 'Jarak SL 6.00 pts');
    // $40 / 600 = 0.06666... Dibulatkan ke bawah ke 0.06 lot
    assert.equal(res.lot, 0.06, 'Ukuran lot harus dibulatkan ke bawah ke 0.06 lot');
    // Profit TP1: 0.06 * 10 * 100 = $60.00
    assert.equal(res.tp1Profit, 60.00);
    // Profit TP2: 0.06 * 20 * 100 = $120.00
    assert.equal(res.tp2Profit, 120.00);
  });

  await t.test('3. Batas minimum 0.01 lot saat modal kecil atau jarak SL sangat lebar', () => {
    const res = calculateLotAndRisk({
      balance: 50,
      riskPercent: 1.0,
      entry: 2650.00,
      sl: 2630.00,
      tp1: 2660.00
    });

    assert.equal(res.riskAmount, 0.50);
    // 0.50 / (20 * 100) = 0.00025 -> Floor ke minimum 0.01 lot
    assert.equal(res.lot, 0.01, 'Batas minimum lot adalah 0.01');
  });

  await t.test('4. Persistensi Saldo dan Persentase Risiko di LocalStorage', () => {
    assert.equal(getSavedBalance(), 1000, 'Default balance 1000');
    assert.equal(getSavedRiskPercent(), 1.0, 'Default risk 1.0%');

    saveBalance(5000);
    assert.equal(getSavedBalance(), 5000);
    assert.equal(storage.get(BALANCE_KEY), '5000');

    saveRiskPercent(0.5);
    assert.equal(getSavedRiskPercent(), 0.5);
    assert.equal(storage.get(RISK_PERCENT_KEY), '0.5');
  });

  await t.test('5. Integrasi Modal UI dan kalkulasi responsif Bloomberg-style', () => {
    const modalEl = createMockElement('amy-lot-calc-modal');
    const bInput = createMockElement('lot-calc-balance');
    const rInput = createMockElement('lot-calc-risk-pct');
    const eInput = createMockElement('lot-calc-entry');
    const sInput = createMockElement('lot-calc-sl');
    const t1Input = createMockElement('lot-calc-tp1');
    const t2Input = createMockElement('lot-calc-tp2');

    const lotRes = createMockElement('lot-res-lot');
    const riskRes = createMockElement('lot-res-risk');
    const tp1Res = createMockElement('lot-res-tp1');
    const tp2Res = createMockElement('lot-res-tp2');
    const pipsRes = createMockElement('lot-res-pips');

    openLotCalculator({
      entry: 2648.50,
      sl: 2642.00,
      tp1: 2658.00,
      tp2: 2670.00,
      side: 'BUY'
    });

    assert.ok(modalEl.classList.contains('active'), 'Modal harus aktif');
    assert.equal(eInput.value, 2648.50);
    assert.equal(sInput.value, 2642.00);

    // Recalculate
    bInput.value = '3000';
    rInput.value = '1.0';
    recalculateModalUI();

    // SL diff = 6.50 pts. Risk = $30.00. Raw lot = 30 / 650 = 0.0461 -> 0.04 lot.
    assert.equal(lotRes.textContent, '0.04 LOT');
    assert.ok(riskRes.textContent.includes('-$30.00'));
    assert.ok(riskRes.textContent.includes('-65 pips'));

    closeLotCalculator();
    assert.ok(!modalEl.classList.contains('active'), 'Modal harus ditutup');
  });
});
