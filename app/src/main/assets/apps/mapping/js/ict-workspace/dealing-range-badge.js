/**
 * Amy FX Pro — Dealing Range Mini-Badge Engine
 * Item 2.7 Blueprint: Mini-Badge Status Dealing Range di Header Chart Gold.
 *
 * Logika ICT murni:
 * - Harga < 50% Equilibrium: [ ZONA DISKON · BUY ONLY 🟢 ] (.dr-discount)
 * - Harga > 50% Equilibrium: [ ZONA PREMIUM · SELL ONLY 🔴 ] (.dr-premium)
 * - Kisaran 50% Equilibrium (CE): [ EQUILIBRIUM 50% · NETRAL ⚪ ] (.dr-neutral)
 */

export function getDealingRangeStatus(price, dealingRange) {
  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0) {
    return {
      zone: 'EQUILIBRIUM',
      text: 'EQUILIBRIUM 50% · NETRAL ⚪',
      className: 'dr-badge dr-neutral'
    };
  }

  // 1. Prioritas string lokasi terkonfirmasi dari model
  const loc = String(dealingRange?.location || dealingRange?.currentZone || '').toUpperCase();
  if (loc === 'DISCOUNT') {
    return {
      zone: 'DISCOUNT',
      text: 'ZONA DISKON · BUY ONLY 🟢',
      className: 'dr-badge dr-discount'
    };
  }
  if (loc === 'PREMIUM') {
    return {
      zone: 'PREMIUM',
      text: 'ZONA PREMIUM · SELL ONLY 🔴',
      className: 'dr-badge dr-premium'
    };
  }

  // 2. Perhitungan matematis level Equilibrium 50%
  let eq = Number(dealingRange?.equilibrium ?? dealingRange?.eq);
  const top = Number(dealingRange?.top ?? dealingRange?.high);
  const bottom = Number(dealingRange?.bottom ?? dealingRange?.low);

  if (!Number.isFinite(eq) && Number.isFinite(top) && Number.isFinite(bottom) && top > bottom) {
    eq = (top + bottom) / 2;
  }

  if (Number.isFinite(eq) && eq > 0) {
    const span = Number.isFinite(top) && Number.isFinite(bottom) && top > bottom ? (top - bottom) : 20.0;
    const threshold = Math.max(1.0, span * 0.05); // Band netral 5% di sekitar 50% CE

    if (Math.abs(p - eq) <= threshold) {
      return {
        zone: 'EQUILIBRIUM',
        text: 'EQUILIBRIUM 50% · NETRAL ⚪',
        className: 'dr-badge dr-neutral',
        eq
      };
    } else if (p < eq) {
      return {
        zone: 'DISCOUNT',
        text: 'ZONA DISKON · BUY ONLY 🟢',
        className: 'dr-badge dr-discount',
        eq
      };
    } else {
      return {
        zone: 'PREMIUM',
        text: 'ZONA PREMIUM · SELL ONLY 🔴',
        className: 'dr-badge dr-premium',
        eq
      };
    }
  }

  // Default fallback
  return {
    zone: 'EQUILIBRIUM',
    text: 'EQUILIBRIUM 50% · NETRAL ⚪',
    className: 'dr-badge dr-neutral'
  };
}

export function updateDealingRangeBadge(badgeEl, price, dealingRange) {
  if (!badgeEl) return;
  const status = getDealingRangeStatus(price, dealingRange);
  badgeEl.textContent = status.text;
  badgeEl.className = status.className;
}
