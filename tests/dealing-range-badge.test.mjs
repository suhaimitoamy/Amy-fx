import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getDealingRangeStatus,
  updateDealingRangeBadge
} from '../app/src/main/assets/apps/mapping/js/ict-workspace/dealing-range-badge.js';

test('Dealing Range Mini-Badge Engine (Item 2.7)', async (t) => {
  await t.test('1. Menentukan status DISCOUNT saat location terkonfirmasi DISCOUNT', () => {
    const status = getDealingRangeStatus(2640.50, { location: 'DISCOUNT' });
    assert.equal(status.zone, 'DISCOUNT');
    assert.equal(status.text, 'ZONA DISKON · BUY ONLY 🟢');
    assert.equal(status.className, 'dr-badge dr-discount');
  });

  await t.test('2. Menentukan status PREMIUM saat location terkonfirmasi PREMIUM', () => {
    const status = getDealingRangeStatus(2690.00, { location: 'PREMIUM' });
    assert.equal(status.zone, 'PREMIUM');
    assert.equal(status.text, 'ZONA PREMIUM · SELL ONLY 🔴');
    assert.equal(status.className, 'dr-badge dr-premium');
  });

  await t.test('3. Menghitung status berdasarkan Equilibrium 50% matematis (Range: 2600 - 2700, EQ: 2650)', () => {
    const dr = { top: 2700, bottom: 2600 }; // eq = 2650, span = 100, threshold = 5

    // Harga di dekat EQ (2651.00)
    const eqStatus = getDealingRangeStatus(2651.00, dr);
    assert.equal(eqStatus.zone, 'EQUILIBRIUM');
    assert.equal(eqStatus.text, 'EQUILIBRIUM 50% · NETRAL ⚪');
    assert.equal(eqStatus.className, 'dr-badge dr-neutral');

    // Harga di bawah EQ (2630.00 -> Diskon)
    const discountStatus = getDealingRangeStatus(2630.00, dr);
    assert.equal(discountStatus.zone, 'DISCOUNT');
    assert.equal(discountStatus.text, 'ZONA DISKON · BUY ONLY 🟢');
    assert.equal(discountStatus.className, 'dr-badge dr-discount');

    // Harga di atas EQ (2680.00 -> Premium)
    const premiumStatus = getDealingRangeStatus(2680.00, dr);
    assert.equal(premiumStatus.zone, 'PREMIUM');
    assert.equal(premiumStatus.text, 'ZONA PREMIUM · SELL ONLY 🔴');
    assert.equal(premiumStatus.className, 'dr-badge dr-premium');
  });

  await t.test('4. Fallback aman ke EQUILIBRIUM NETRAL saat harga atau dealing range null/falsy', () => {
    const statusNull = getDealingRangeStatus(null, null);
    assert.equal(statusNull.zone, 'EQUILIBRIUM');
    assert.equal(statusNull.text, 'EQUILIBRIUM 50% · NETRAL ⚪');
    assert.equal(statusNull.className, 'dr-badge dr-neutral');

    const statusZero = getDealingRangeStatus(0, {});
    assert.equal(statusZero.zone, 'EQUILIBRIUM');
  });

  await t.test('5. updateDealingRangeBadge memodifikasi textContent dan className elemen DOM', () => {
    const mockBadge = { textContent: '', className: '' };
    updateDealingRangeBadge(mockBadge, 2635.00, { location: 'DISCOUNT' });

    assert.equal(mockBadge.textContent, 'ZONA DISKON · BUY ONLY 🟢');
    assert.equal(mockBadge.className, 'dr-badge dr-discount');

    updateDealingRangeBadge(mockBadge, 2675.00, { location: 'PREMIUM' });
    assert.equal(mockBadge.textContent, 'ZONA PREMIUM · SELL ONLY 🔴');
    assert.equal(mockBadge.className, 'dr-badge dr-premium');
  });
});
