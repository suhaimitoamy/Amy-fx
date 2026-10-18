/**
 * Amy FX Pro · Economic Event Countdown & No-Trade Window Guard
 * Item 2.27 [ECONOMIC EVENT COUNTDOWN]
 *
 * Mendeteksi rilis berita makro berdampak tinggi (High Impact USD/XAU)
 * dan menampilkan peringatan anti-slippage di header Cockpit Mapping:
 * 1. 30 Menit Sebelum Rilis: Banner berkedip halus peringatan pelebaran spread.
 * 2. 5 Menit Sebelum s.d. 5 Menit Sesudah: Rekomendasi No-Trade Window ketat.
 */

export const ECONOMIC_STORAGE_KEY = 'amy_economic_calendar_v1';
export const NO_TRADE_WINDOW_MS = 5 * 60 * 1000; // ±5 menit
export const WARNING_WINDOW_MS = 30 * 60 * 1000; // 30 menit ke depan

export function cleanEventTitle(rawTitle) {
  return String(rawTitle || '')
    .replace(/^[A-Z]{3}\s*\|\s*/i, '')
    .trim();
}

export function parseCachedCalendar(raw) {
  if (!raw) return [];
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.events)) return data.events;
  } catch (_) {}
  return [];
}

export function filterHighImpactGoldEvents(events = []) {
  if (!Array.isArray(events)) return [];
  return events
    .filter(ev => {
      const country = String(ev?.country || 'USD').toUpperCase();
      const impact = String(ev?.impact || '').toLowerCase();
      const isGoldDriver = ['USD', 'US', 'XAU'].includes(country);
      const isHighImpact = impact === 'high';
      return isGoldDriver && isHighImpact;
    })
    .map(ev => {
      const timeMs = new Date(ev.date).getTime();
      return {
        ...ev,
        cleanTitle: cleanEventTitle(ev.title),
        timeMs
      };
    })
    .filter(ev => Number.isFinite(ev.timeMs));
}

export function evaluateEconomicRisk(events = [], nowMs = Date.now()) {
  const highImpact = filterHighImpactGoldEvents(events);
  if (!highImpact.length) {
    return { active: false, status: 'SAFE', level: 'none', text: '', event: null };
  }

  const noTradeEvents = [];
  const upcomingEvents = [];

  for (const ev of highImpact) {
    const diffMs = ev.timeMs - nowMs;
    // Jendela No-Trade: -5 menit s.d. +5 menit dari jadwal rilis
    if (diffMs >= -NO_TRADE_WINDOW_MS && diffMs <= NO_TRADE_WINDOW_MS) {
      noTradeEvents.push({ ev, diffMs, absDiff: Math.abs(diffMs) });
    }
    // Jendela Peringatan Mendatang: > 5 menit s.d. 30 menit ke depan
    else if (diffMs > NO_TRADE_WINDOW_MS && diffMs <= WARNING_WINDOW_MS) {
      upcomingEvents.push({ ev, diffMs });
    }
  }

  // 1. Prioritas Utama: No-Trade Window (Active Release)
  if (noTradeEvents.length > 0) {
    noTradeEvents.sort((a, b) => a.absDiff - b.absDiff);
    const target = noTradeEvents[0].ev;
    const diffMs = noTradeEvents[0].diffMs;
    const title = target.cleanTitle || target.title || 'US High-Impact Event';
    return {
      active: true,
      status: 'NO_TRADE_WINDOW',
      level: 'critical',
      event: target,
      title,
      country: target.country || 'US',
      diffMs,
      minutesLeft: Math.round(diffMs / 60000),
      text: `🛑 No-Trade Window — Rilis Berita High-Impact (${title})`
    };
  }

  // 2. Prioritas Kedua: Countdown Berita Mendatang (30 Menit)
  if (upcomingEvents.length > 0) {
    upcomingEvents.sort((a, b) => a.diffMs - b.diffMs);
    const target = upcomingEvents[0].ev;
    const diffMs = upcomingEvents[0].diffMs;
    const minutesLeft = Math.max(1, Math.ceil(diffMs / 60000));
    const title = target.cleanTitle || target.title || 'High-Impact Event';
    const country = target.country || 'US';
    return {
      active: true,
      status: 'UPCOMING_ALERT',
      level: 'warning',
      event: target,
      title,
      country,
      diffMs,
      minutesLeft,
      text: `🔴 ${country} ${title} dalam ${minutesLeft} Menit — Spread Berpotensi Melebar`
    };
  }

  return { active: false, status: 'SAFE', level: 'none', text: '', event: null };
}

export function formatEventCountdownBanner(risk) {
  if (!risk || !risk.active) {
    return { visible: false, className: '', html: '', text: '' };
  }

  if (risk.status === 'NO_TRADE_WINDOW') {
    return {
      visible: true,
      status: risk.status,
      level: 'critical',
      className: 'economic-event-banner is-no-trade',
      text: risk.text,
      html: `<span class="banner-pulse-dot dot-critical"></span>` +
            `<span class="banner-badge badge-critical">NO-TRADE WINDOW</span>` +
            `<span class="banner-message">${risk.text}</span>`
    };
  }

  return {
    visible: true,
    status: risk.status,
    level: 'warning',
    className: 'economic-event-banner is-upcoming',
    text: risk.text,
    html: `<span class="banner-pulse-dot dot-warning"></span>` +
          `<span class="banner-badge badge-warning">${risk.minutesLeft}M LAGI</span>` +
          `<span class="banner-message">${risk.text}</span>`
  };
}

export function mountEconomicEventBanner({
  containerId = 'economic-event-banner',
  storageKey = ECONOMIC_STORAGE_KEY,
  pollIntervalMs = 15000,
  fetchFallback = true
} = {}) {
  let timer = null;
  let isFetching = false;

  async function update() {
    const el = document.getElementById(containerId);
    if (!el) return;

    let raw = null;
    try {
      raw = localStorage.getItem(storageKey);
    } catch (_) {}

    let events = parseCachedCalendar(raw);

    // Fallback fetch jika cache lokal kosong
    if ((!events || !events.length) && fetchFallback && !isFetching) {
      isFetching = true;
      try {
        const controller = new AbortController();
        const fetchTimeout = setTimeout(() => controller.abort(), 4000);
        const res = await fetch('/api/calendar', { signal: controller.signal });
        clearTimeout(fetchTimeout);
        if (res.ok) {
          const json = await res.json();
          events = parseCachedCalendar(json);
          if (events.length > 0) {
            try {
              localStorage.setItem(storageKey, JSON.stringify({ savedAt: Date.now(), events }));
            } catch (_) {}
          }
        }
      } catch (_) {
      } finally {
        isFetching = false;
      }
    }

    const risk = evaluateEconomicRisk(events, Date.now());
    const formatted = formatEventCountdownBanner(risk);

    if (formatted.visible) {
      el.className = formatted.className;
      el.innerHTML = formatted.html;
      el.style.display = 'flex';
      el.removeAttribute('hidden');
    } else {
      el.style.display = 'none';
      el.setAttribute('hidden', '');
      el.innerHTML = '';
    }
  }

  // Jalankan segera
  update();

  // Jadwalkan polling interval
  if (pollIntervalMs > 0 && typeof setInterval !== 'undefined') {
    timer = setInterval(update, pollIntervalMs);
  }

  // Re-evaluasi saat tab menjadi aktif kembali
  function handleVisibilityChange() {
    if (!document.hidden) update();
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  return {
    update,
    destroy() {
      if (timer) clearInterval(timer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    }
  };
}
