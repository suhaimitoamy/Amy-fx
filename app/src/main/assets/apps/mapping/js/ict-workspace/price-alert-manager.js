/**
 * Amy FX Pro — Custom Price Alert Manager (Alarm Harga Kustom)
 * Manages user-defined price targets for XAU/USD with real-time threshold monitoring,
 * multi-channel notification dispatch (Android native bridge, Web Notification API, in-app banner),
 * Web Audio API alarm chimes, haptic feedback, and responsive UI helpers.
 */

const STORAGE_KEY = 'amyfx_custom_price_alerts';

let previousPrice = null;
let lastPersistenceTime = 0;
let audioCtx = null;
const registeredContainers = new Set();
let observerInitialized = false;

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('beforeunload', () => {
    try {
      const active = getAlerts();
      if (active.length > 0) saveAlerts(active);
    } catch (_) {}
  });
}

/**
 * Safely parse numbers
 */
function parsePrice(val) {
  const num = Number(val);
  return Number.isFinite(num) && num > 0 ? num : null;
}

/**
 * Retrieve current price from multiple live market sources
 */
export function getCurrentLivePrice() {
  if (typeof window === 'undefined') return 2650.0;

  // 1. window.amyfxCurrentPrice
  if (parsePrice(window.amyfxCurrentPrice)) {
    return Number(window.amyfxCurrentPrice);
  }

  // 2. window.state?.price (WebSocket tick)
  if (parsePrice(window.state?.price)) {
    return Number(window.state?.price);
  }

  // 3. Last closed candle from M15 / M5
  if (window.amyfxLastCandles?.length) {
    const c = window.amyfxLastCandles.at(-1);
    if (parsePrice(c?.close)) return Number(c.close);
  }
  if (window.amyfxLastContext?.amy?.chartCandles?.M15?.length) {
    const c = window.amyfxLastContext.amy.chartCandles.M15.at(-1);
    if (parsePrice(c?.close)) return Number(c.close);
  }

  // 4. DOM chart price element
  if (typeof document !== 'undefined') {
    const chartPriceEl = document.getElementById('chart-price');
    if (chartPriceEl) {
      const p = parseFloat(chartPriceEl.textContent.replace(/[^0-9.]/g, ''));
      if (parsePrice(p)) return p;
    }
  }

  // 5. Stored last price
  try {
    const stored = parseFloat(localStorage.getItem('last_price') || '');
    if (parsePrice(stored)) return stored;
  } catch (_) {}

  return 2650.0;
}

/**
 * Read all stored price alerts from localStorage
 */
export function getAlerts() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[PriceAlert] Gagal membaca storage:', err);
    return [];
  }
}

/**
 * Persist price alerts to localStorage
 */
export function saveAlerts(alerts) {
  try {
    if (typeof localStorage === 'undefined') return false;
    const safeList = Array.isArray(alerts) ? alerts : [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeList));
    return true;
  } catch (err) {
    console.error('[PriceAlert] Gagal menyimpan alerts:', err);
    return false;
  }
}

/**
 * Add a new target price alert
 * @param {number|string} targetPrice - Price level to alert on
 * @param {Object} options - Optional config { direction, note, currentPrice }
 */
export function addAlert(targetPrice, options = {}) {
  const target = parsePrice(targetPrice);
  if (!target) {
    throw new Error('Target harga harus berupa angka positif yang valid.');
  }

  const curPrice = parsePrice(options.currentPrice) || getCurrentLivePrice();

  // Automatic direction detection:
  // CROSS_ABOVE if target > current price
  // CROSS_BELOW if target < current price
  let direction = options.direction;
  if (!direction || !['CROSS_ABOVE', 'CROSS_BELOW'].includes(direction)) {
    direction = target >= curPrice ? 'CROSS_ABOVE' : 'CROSS_BELOW';
  }

  const alert = {
    id: 'alert_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    targetPrice: Math.round(target * 100) / 100,
    direction,
    createdPrice: Math.round(curPrice * 100) / 100,
    lastCheckedPrice: Math.round(curPrice * 100) / 100,
    createdAt: Date.now(),
    triggeredAt: null,
    status: 'ACTIVE',
    note: String(options.note || '').trim() || 'Alarm Target Harga'
  };

  const list = getAlerts();
  list.push(alert);
  saveAlerts(list);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('amyfx:price-alerts-updated', {
      detail: { action: 'add', alert, alerts: list }
    }));
  }

  renderAllRegisteredContainers();
  return alert;
}

/**
 * Remove an alert by its ID
 */
export function removeAlert(id) {
  const list = getAlerts();
  const filtered = list.filter(a => a.id !== id);
  saveAlerts(filtered);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('amyfx:price-alerts-updated', {
      detail: { action: 'remove', id, alerts: filtered }
    }));
  }

  renderAllRegisteredContainers();
  return filtered;
}

/**
 * Reset a TRIGGERED alert back to ACTIVE
 */
export function resetAlert(id, options = {}) {
  const list = getAlerts();
  const alert = list.find(a => a.id === id);
  if (!alert) return null;

  const curPrice = parsePrice(options.currentPrice) || getCurrentLivePrice();

  alert.status = 'ACTIVE';
  alert.triggeredAt = null;
  alert.createdPrice = Math.round(curPrice * 100) / 100;

  if (options.direction && ['CROSS_ABOVE', 'CROSS_BELOW'].includes(options.direction)) {
    alert.direction = options.direction;
  } else {
    alert.direction = alert.targetPrice >= curPrice ? 'CROSS_ABOVE' : 'CROSS_BELOW';
  }

  saveAlerts(list);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('amyfx:price-alerts-updated', {
      detail: { action: 'reset', alert, alerts: list }
    }));
  }

  renderAllRegisteredContainers();
  return alert;
}

/**
 * Clear alerts (all or only triggered)
 */
export function clearAlerts(mode = 'all') {
  const list = getAlerts();
  const filtered = mode === 'triggered'
    ? list.filter(a => a.status !== 'TRIGGERED')
    : [];

  saveAlerts(filtered);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('amyfx:price-alerts-updated', {
      detail: { action: 'clear', mode, alerts: filtered }
    }));
  }

  renderAllRegisteredContainers();
  return filtered;
}

/**
 * Play a clear, high-fidelity 2-tone melodic notification chime via Web Audio API
 */
export function playAlertBeep(soundType = 'default') {
  if (typeof window === 'undefined') return;
  try {
    if (typeof window.Android?.playNativeChime === 'function') {
      window.Android.playNativeChime(soundType);
      return;
    }
    if (soundType === 'gold' && typeof window.Android?.playGoldChime === 'function') {
      window.Android.playGoldChime();
      return;
    }
    if (typeof window.Android?.playNotificationSound === 'function') {
      window.Android.playNotificationSound(soundType);
      return;
    }
  } catch (_) {}
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioCtx) audioCtx = new AudioCtx();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    const t = audioCtx.currentTime;
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, t); // A5
    osc1.frequency.setValueAtTime(1174.66, t + 0.18); // D6

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(587.33, t); // D5
    osc2.frequency.setValueAtTime(880, t + 0.18); // A5

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioCtx.destination);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.65);
    osc2.stop(t + 0.65);
  } catch (err) {
    console.warn('[PriceAlert] Gagal memutar audio beep:', err);
  }
}

/**
 * Trigger vibration / haptic feedback on Android or modern browser
 */
export function triggerHapticFeedback(patternType = 'TOUCH') {
  if (typeof window === 'undefined') return;
  try {
    if (typeof window.Android?.triggerPatternHaptic === 'function') {
      window.Android.triggerPatternHaptic(patternType);
      return;
    }
    if (window.Android?.triggerHaptic) {
      window.Android.triggerHaptic(18);
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 300]);
    }
  } catch (_) {}
}

/**
 * Show in-app glassmorphism notification banner
 */
export function showInAppBanner(alert, price) {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function' || typeof document.createElement !== 'function') return;

  const isIctSweep = alert.note && (alert.note.includes('SSL') || alert.note.includes('BSL') || alert.note.includes('Sweep'));
  const isPoi = alert.note && (alert.note.includes('POI') || alert.note.includes('Zone'));
  const bannerIcon = isIctSweep ? '⚡' : isPoi ? '🎯' : '🔔';
  const badgeTitle = isIctSweep ? 'LIKUIDITAS SWEEP TERCAPAI' : isPoi ? 'AREA POI TERSENTUH' : 'ALARM HARGA TERCAPAI';
  const badgeColor = isIctSweep ? '#38BDF8' : isPoi ? '#A855F7' : '#F5C451';

  const bannerId = 'amyfx-price-alert-banner';
  let banner = document.getElementById(bannerId);
  if (!banner) {
    banner = document.createElement('div');
    banner.id = bannerId;
    banner.setAttribute('role', 'alert');
    banner.style.cssText = `
      position: fixed;
      top: 18px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 999999;
      width: calc(100% - 32px);
      max-width: 440px;
      background: rgba(19, 30, 45, 0.95);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1px solid ${badgeColor};
      box-shadow: 0 12px 36px rgba(0,0,0,0.65), 0 0 18px ${badgeColor}55;
      border-radius: 14px;
      padding: 14px 18px;
      color: #fff;
      font-family: inherit;
      box-sizing: border-box;
      transition: opacity 0.35s ease, transform 0.35s ease;
    `;
    document.body.appendChild(banner);
  } else {
    banner.style.borderColor = badgeColor;
    banner.style.boxShadow = `0 12px 36px rgba(0,0,0,0.65), 0 0 18px ${badgeColor}55`;
  }

  const directionSymbol = alert.direction === 'CROSS_ABOVE' ? '▲' : '▼';
  const directionText = alert.direction === 'CROSS_ABOVE' ? 'Menembus Ke Atas' : 'Menembus Ke Bawah';
  const dirColor = alert.direction === 'CROSS_ABOVE' ? '#32D583' : '#FF5C6C';

  banner.innerHTML = `
    <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
      <div style="font-size:26px; line-height:1; filter:drop-shadow(0 0 6px ${badgeColor}99);">${bannerIcon}</div>
      <div style="flex:1;">
        <div style="font-size:11px; font-weight:800; color:${badgeColor}; letter-spacing:0.08em; text-transform:uppercase;">
          ${badgeTitle}
        </div>
        <div style="font-size:16px; font-weight:800; margin:3px 0; color:#fff; display:flex; align-items:center; gap:8px;">
          <span>XAU/USD $${price.toFixed(2)}</span>
          <span style="font-size:11px; font-weight:700; padding:2px 6px; border-radius:4px; background:rgba(255,255,255,0.08); color:${dirColor};">
            ${directionSymbol} ${directionText}
          </span>
        </div>
        <div style="font-size:12px; color:#94A3B8; line-height:1.4;">
          Target $${alert.targetPrice.toFixed(2)} telah tercapai! ${alert.note ? '· <strong>' + escapeHtml(alert.note) + '</strong>' : ''}
        </div>
      </div>
      <button type="button" id="close-price-alert-banner" aria-label="Tutup notifikasi" style="background:transparent; border:0; color:#94A3B8; font-size:22px; cursor:pointer; padding:0 4px; line-height:1;">&times;</button>
    </div>
  `;

  const closeBtn = document.getElementById('close-price-alert-banner');
  if (closeBtn) {
    closeBtn.onclick = () => { banner.remove(); };
  }

  setTimeout(() => {
    if (banner && banner.parentNode) {
      banner.style.opacity = '0';
      banner.style.transform = 'translate(-50%, -15px)';
      setTimeout(() => banner.remove(), 350);
    }
  }, 8000);
}

/**
 * Dispatch multi-channel notification for a triggered alert
 */
export function notifyTriggeredAlert(alert, currentPrice) {
  const price = Number(currentPrice);
  const priceStr = price.toFixed(2);
  const targetStr = alert.targetPrice.toFixed(2);

  const isIctSweep = alert.note && (alert.note.includes('SSL') || alert.note.includes('BSL') || alert.note.includes('Sweep'));
  const isPoi = alert.note && (alert.note.includes('POI') || alert.note.includes('Zone'));

  let title = `🔔 Alarm Harga: XAU/USD Menyentuh ${priceStr}`;
  let message = `Target harga ${targetStr} telah tercapai! Pantau aksi harga di chart.`;

  if (isIctSweep) {
    title = `⚡ ${alert.note.split('(')[0].trim()}: XAU/USD ${priceStr}`;
    message = `Level Likuiditas ${targetStr} telah tersapu (Sweep)! Pantau reaksi konfirmasi di chart.`;
  } else if (isPoi) {
    title = `🎯 ${alert.note.split('(')[0].trim()}: XAU/USD ${priceStr}`;
    message = `Harga telah menyentuh area POI ${targetStr}! Bersiap cek konfirmasi entry.`;
  } else if (alert.note && alert.note !== 'Alarm Target Harga') {
    title = `🔔 ${alert.note}: XAU/USD ${priceStr}`;
  }

  const url = (typeof location !== 'undefined' ? location.href.split('#')[0] : '') + '#Dashboard';

  // 1. Android Native Notification Bridge
  try {
    if (window.Android?.showNotificationWithUrl) {
      window.Android.showNotificationWithUrl(title, message, url);
    } else if (window.Android?.showNotification) {
      window.Android.showNotification(title, message);
    }
  } catch (err) {
    console.warn('[PriceAlert] Gagal memanggil Android notification bridge:', err);
  }

  // 2. Web Notification API (browser permissions)
  try {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        icon: '/favicon.ico',
        tag: 'amyfx_alert_' + alert.id
      });
    }
  } catch (_) {}

  // 3. In-App Glassmorphism Banner
  showInAppBanner(alert, price);

  // 4. Audio Beep & Haptic
  playAlertBeep(isIctSweep || isPoi ? 'gold' : 'default');
  triggerHapticFeedback();
}

export const ICT_COOLDOWN_MS = 300000; // 5 menit per level
const ictAlertCooldowns = new Map();

/**
 * Check if Gold market is open (filtering weekends and closed sessions)
 */
export function isGoldMarketOpen(nowSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof window !== 'undefined' && typeof window.__amyfxMarketOpen === 'boolean') {
    return window.__amyfxMarketOpen;
  }
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hourCycle: 'h23',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short'
    }).formatToParts(new Date(nowSeconds * 1000));
    const values = Object.fromEntries(parts.map(x => [x.type, x.value]));
    const weekday = values.weekday;
    const hour = Number(values.hour) + Number(values.minute) / 60;
    if (weekday === 'Sat') return false;
    if (weekday === 'Sun') return hour >= 17;
    if (weekday === 'Fri') return hour < 17;
    if (hour >= 17 && hour < 18) return false;
    return true;
  } catch (_) {
    return true;
  }
}

/**
 * Retrieve active ICT market context from window or localStorage
 */
export function getIctContext() {
  if (typeof window !== 'undefined') {
    if (window.AmyMarketContext) return window.AmyMarketContext;
    if (window.amyfxLastContext) return window.amyfxLastContext;
    try {
      const stored = localStorage.getItem('amyfx.market-context.v1');
      if (stored) return JSON.parse(stored);
    } catch (_) {}
  }
  return null;
}

export function getIctCooldowns() {
  return new Map(ictAlertCooldowns);
}

export function clearIctCooldowns() {
  ictAlertCooldowns.clear();
}

/**
 * Show in-app glassmorphism banner for ICT intrabar event
 */
export function showIctBanner(event) {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function' || typeof document.createElement !== 'function') return;

  const bannerId = 'amyfx-price-alert-banner';
  let banner = document.getElementById(bannerId);
  if (!banner) {
    banner = document.createElement('div');
    banner.id = bannerId;
    banner.setAttribute('role', 'alert');
    banner.style.cssText = `
      position: fixed;
      top: 18px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 999999;
      width: calc(100% - 32px);
      max-width: 440px;
      background: rgba(19, 30, 45, 0.95);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1px solid #38BDF8;
      box-shadow: 0 12px 36px rgba(0,0,0,0.65), 0 0 18px rgba(56, 189, 248, 0.35);
      border-radius: 14px;
      padding: 14px 18px;
      color: #fff;
      font-family: inherit;
      box-sizing: border-box;
      transition: opacity 0.35s ease, transform 0.35s ease;
    `;
    document.body.appendChild(banner);
  } else {
    banner.style.borderColor = '#38BDF8';
    banner.style.boxShadow = '0 12px 36px rgba(0,0,0,0.65), 0 0 18px rgba(56, 189, 248, 0.35)';
  }

  const icon = event.type === 'SWEEP' ? '⚡' : event.type === 'POI' ? '🎯' : '⚠️';
  const badgeColor = event.type === 'SWEEP' ? '#38BDF8' : event.type === 'POI' ? '#A855F7' : '#EF4444';

  banner.innerHTML = `
    <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
      <div style="font-size:26px; line-height:1; filter:drop-shadow(0 0 6px ${badgeColor});">${icon}</div>
      <div style="flex:1;">
        <div style="font-size:11px; font-weight:800; color:${badgeColor}; letter-spacing:0.08em; text-transform:uppercase;">
          LIVE ICT INTRABAR · 0s DELAY
        </div>
        <div style="font-size:15px; font-weight:800; margin:3px 0; color:#fff; display:flex; align-items:center; gap:8px;">
          <span>${escapeHtml(event.title)}</span>
        </div>
        <div style="font-size:12px; color:#94A3B8; line-height:1.4;">
          ${escapeHtml(event.message)}
        </div>
      </div>
      <button type="button" id="close-price-alert-banner" aria-label="Tutup notifikasi" style="background:transparent; border:0; color:#94A3B8; font-size:22px; cursor:pointer; padding:0 4px; line-height:1;">&times;</button>
    </div>
  `;

  const closeBtn = document.getElementById('close-price-alert-banner');
  if (closeBtn) {
    closeBtn.onclick = () => { banner.remove(); };
  }

  setTimeout(() => {
    if (banner && banner.parentNode) {
      banner.style.opacity = '0';
      banner.style.transform = 'translate(-50%, -15px)';
      setTimeout(() => banner.remove(), 350);
    }
  }, 8000);
}

/**
 * Multi-channel dispatch for ICT live intrabar event
 */
export function dispatchIctLiveNotification(event) {
  // Dinonaktifkan total atas instruksi pengguna (anti-spam intrabar).
  // Sinyal intrabar tick 0s dilarang mengirimkan notifikasi Android, banner popup, getar, maupun suara beep.
  // Sistem push FCM (Firebase Cloud Messaging) dan konfirmasi candle tertutup tetap bekerja 100% normal tanpa terganggu.
  return;
}

/**
 * Check real-time live intrabar sweeps and breaks (0s latency)
 * Dinonaktifkan total atas instruksi pengguna (anti-spam).
 * @param {number} current - Current live price tick
 * @param {number|null} prev - Previous price tick
 * @returns {Array} List of triggered ICT events
 */
export function checkIctIntrabarSweeps(current, prev) {
  // Dinonaktifkan total atas instruksi pengguna (anti-spam intrabar).
  return [];
}

/**
 * Reset or set previous price reference (useful for testing or reconnect)
 */
export function setPreviousPrice(price) {
  previousPrice = parsePrice(price);
}

/**
 * Real-time price check comparing previous price with incoming new price tick
 * @param {number|string} newPrice - Newly arrived live market price
 */
export function checkPrice(newPrice) {
  const current = parsePrice(newPrice);
  if (!current) return false;

  const prev = previousPrice;
  let ictTriggered = false;

  if (prev !== null) {
    const ictEvents = checkIctIntrabarSweeps(current, prev);
    if (ictEvents && ictEvents.length > 0) {
      ictTriggered = true;
    }
  }

  const alerts = getAlerts();
  const activeAlerts = alerts.filter(a => a.status === 'ACTIVE');
  if (!activeAlerts.length) {
    previousPrice = current;
    return ictTriggered;
  }

  const triggeredAlerts = [];
  let hasChange = false;
  let lastCheckedDirty = false;

  for (const alert of activeAlerts) {
    const target = alert.targetPrice;
    // Base previous price: prioritize alert's last checked price, fallback to createdPrice, then global previousPrice
    const p = alert.lastCheckedPrice != null
      ? alert.lastCheckedPrice
      : (alert.createdPrice != null ? alert.createdPrice : (prev !== null ? prev : current));

    let isTriggered = false;

    if (alert.direction === 'CROSS_ABOVE') {
      // Strictly crossed from below to above (eliminate spurious instant trigger when p == target)
      if (p < target && current >= target) {
        isTriggered = true;
      }
    } else if (alert.direction === 'CROSS_BELOW') {
      // Strictly crossed from above to below (eliminate spurious instant trigger when p == target)
      if (p > target && current <= target) {
        isTriggered = true;
      }
    }

    if (alert.lastCheckedPrice !== current) {
      alert.lastCheckedPrice = current;
      lastCheckedDirty = true;
    }

    if (isTriggered) {
      alert.status = 'TRIGGERED';
      alert.triggeredAt = Date.now();
      triggeredAlerts.push(alert);
      hasChange = true;
      notifyTriggeredAlert(alert, current);
    }
  }

  previousPrice = current;

  if (hasChange) {
    saveAlerts(alerts);
    lastPersistenceTime = Date.now();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('amyfx:price-alert-triggered', {
        detail: { triggeredAlerts, price: current }
      }));
      window.dispatchEvent(new CustomEvent('amyfx:price-alerts-updated', {
        detail: { alerts }
      }));
    }
    renderAllRegisteredContainers();
  } else if (lastCheckedDirty) {
    const now = Date.now();
    // Persist lastCheckedPrice regularly (throttled 3s or Node test environment) to avoid losing state on reload
    if (now - lastPersistenceTime >= 3000 || typeof process !== 'undefined') {
      saveAlerts(alerts);
      lastPersistenceTime = now;
    }
  }

  return (triggeredAlerts.length > 0) || ictTriggered;
}

/**
 * Render the price alerts list into a DOM container
 * @param {HTMLElement|string} target - Container element or selector
 */
export function renderAlertList(target) {
  if (typeof document === 'undefined') return;
  const container = typeof target === 'string' ? document.querySelector(target) : target;
  if (!container) return;

  registeredContainers.add(container);

  const alerts = getAlerts();
  const currentPrice = getCurrentLivePrice();
  const activeCount = alerts.filter(a => a.status === 'ACTIVE').length;

  let html = `
    <div class="price-alert-widget-box" style="margin-top:14px; padding:14px 16px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <strong style="font-size:13px; color:#fff; display:flex; align-items:center; gap:6px;">
            <span>🔔</span> Alarm Target Harga
          </strong>
          <span style="font-size:10px; font-weight:700; padding:2px 7px; border-radius:10px; background:${activeCount > 0 ? 'rgba(245,196,81,0.2)' : 'rgba(255,255,255,0.08)'}; color:${activeCount > 0 ? '#F5C451' : 'var(--muted,#94A3B8)'};">
            ${activeCount} Aktif
          </span>
        </div>
        <div style="display:flex; gap:6px;">
          <button type="button" class="amyfx-add-alert-btn" style="display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:700; color:var(--amy-accent,#69b7ff); background:rgba(105,183,255,0.12); padding:5px 10px; border-radius:6px; border:1px solid rgba(105,183,255,0.28); cursor:pointer;">
            <span>+ Tambah Alarm</span>
          </button>
          ${alerts.some(a => a.status === 'TRIGGERED') ? `
            <button type="button" class="amyfx-clear-triggered-btn" title="Hapus alarm tercapai" style="background:transparent; border:1px solid rgba(255,255,255,0.15); color:var(--muted,#94A3B8); font-size:11px; padding:5px 8px; border-radius:6px; cursor:pointer;">
              Bersihkan
            </button>
          ` : ''}
        </div>
      </div>
  `;

  if (!alerts.length) {
    html += `
      <div style="padding:16px 12px; text-align:center; font-size:12px; color:var(--muted,#94A3B8); background:rgba(0,0,0,0.15); border-radius:8px;">
        Belum ada alarm target harga. Tekan <strong>+ Tambah Alarm</strong> untuk memantau level penting.
      </div>
    `;
  } else {
    html += `<div style="display:flex; flex-direction:column; gap:8px; max-height:260px; overflow-y:auto; padding-right:2px;">`;

    // Sort: ACTIVE first (closest to current price), then TRIGGERED
    const sorted = [...alerts].sort((a, b) => {
      if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
      if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
      return Math.abs(a.targetPrice - currentPrice) - Math.abs(b.targetPrice - currentPrice);
    });

    for (const item of sorted) {
      const isTriggered = item.status === 'TRIGGERED';
      const isAbove = item.direction === 'CROSS_ABOVE';
      const dirSymbol = isAbove ? '▲' : '▼';
      const dirColor = isAbove ? '#32D583' : '#FF5C6C';
      const dist = Math.abs(item.targetPrice - currentPrice);
      const distPips = (dist * 10).toFixed(0);

      html += `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 10px; background:${isTriggered ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)'}; border:1px solid ${isTriggered ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.12)'}; border-radius:8px; opacity:${isTriggered ? '0.75' : '1'};">
          <div style="display:flex; align-items:center; gap:8px; min-width:0;">
            <span style="font-size:14px; font-weight:800; color:${dirColor};">${dirSymbol}</span>
            <div>
              <div style="display:flex; align-items:center; gap:6px;">
                <strong style="font-size:13px; font-variant-numeric:tabular-nums; color:#fff;">$${item.targetPrice.toFixed(2)}</strong>
                <span style="font-size:10px; padding:1px 5px; border-radius:4px; font-weight:700; ${isTriggered ? 'background:rgba(105,183,255,0.15); color:#69b7ff;' : 'background:rgba(245,196,81,0.15); color:#F5C451;'}">
                  ${isTriggered ? 'TERCAPAI' : 'MENUNGGU'}
                </span>
              </div>
              <div style="font-size:11px; color:var(--muted,#94A3B8); margin-top:2px;">
                ${isTriggered
                  ? `Tersentuh pada ${new Date(item.triggeredAt || item.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA`
                  : `Selisih: ${dist.toFixed(2)} pts (${distPips} pips) · Base $${item.createdPrice.toFixed(2)}`
                }
                ${item.note && item.note !== 'Alarm Target Harga' ? `· <span style="color:#CBD5E1;">${escapeHtml(item.note)}</span>` : ''}
              </div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
            ${isTriggered ? `
              <button type="button" class="amyfx-reset-alert-btn" data-id="${item.id}" title="Reset Alarm" style="background:rgba(105,183,255,0.15); border:1px solid rgba(105,183,255,0.3); color:#69b7ff; border-radius:6px; font-size:11px; padding:4px 8px; cursor:pointer;">
                ↺ Reset
              </button>
            ` : ''}
            <button type="button" class="amyfx-del-alert-btn" data-id="${item.id}" aria-label="Hapus alarm" title="Hapus Alarm" style="background:transparent; border:0; color:#EF4444; font-size:14px; cursor:pointer; padding:4px 6px;">
              🗑
            </button>
          </div>
        </div>
      `;
    }

    html += `</div>`;
  }

  html += `</div>`;
  container.innerHTML = html;

  // Bind UI Events
  container.querySelector('.amyfx-add-alert-btn')?.addEventListener('click', () => {
    openAddAlertDialog(currentPrice);
  });

  container.querySelector('.amyfx-clear-triggered-btn')?.addEventListener('click', () => {
    clearAlerts('triggered');
  });

  container.querySelectorAll('.amyfx-del-alert-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (id) removeAlert(id);
    });
  });

  container.querySelectorAll('.amyfx-reset-alert-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (id) resetAlert(id);
    });
  });
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function renderAllRegisteredContainers() {
  for (const container of registeredContainers) {
    if (document.body.contains(container)) {
      renderAlertList(container);
    } else {
      registeredContainers.delete(container);
    }
  }
}

/**
 * Extract active key ICT levels from market context (SSL, BSL, POI, PDH, PDL, Asia H/L, Plan)
 */
export function getAvailableIctLevels() {
  const ctx = getIctContext();
  const levels = [];
  if (!ctx) return levels;

  // 1. SSL (Sell-Side Liquidity)
  let sslVal = null;
  if (Array.isArray(ctx.liquidity)) {
    const s = ctx.liquidity.find(l => l.label === 'SSL' && Number.isFinite(Number(l.level)));
    if (s) sslVal = Number(s.level);
  }
  if (!sslVal && Number.isFinite(Number(ctx.amy?.dashboard?.ssl))) {
    sslVal = Number(ctx.amy.dashboard.ssl);
  }
  if (sslVal) {
    levels.push({
      id: 'ssl',
      label: '⚡ SSL Sweep',
      price: Math.round(sslVal * 100) / 100,
      direction: 'CROSS_BELOW',
      note: '⚡ SSL Sweep (Likuiditas Bawah)',
      category: 'liquidity',
      badgeColor: '#EF4444'
    });
  }

  // 2. BSL (Buy-Side Liquidity)
  let bslVal = null;
  if (Array.isArray(ctx.liquidity)) {
    const b = ctx.liquidity.find(l => l.label === 'BSL' && Number.isFinite(Number(l.level)));
    if (b) bslVal = Number(b.level);
  }
  if (!bslVal && Number.isFinite(Number(ctx.amy?.dashboard?.bsl))) {
    bslVal = Number(ctx.amy.dashboard.bsl);
  }
  if (bslVal) {
    levels.push({
      id: 'bsl',
      label: '⚡ BSL Sweep',
      price: Math.round(bslVal * 100) / 100,
      direction: 'CROSS_ABOVE',
      note: '⚡ BSL Sweep (Likuiditas Atas)',
      category: 'liquidity',
      badgeColor: '#10B981'
    });
  }

  // 3. POI M15 (Area & 50% CE)
  const poi = ctx.m15?.poi || ctx.amy?.dashboard?.poi;
  if (poi) {
    const ce = Number(poi.ce);
    const poiPrice = Number.isFinite(ce) && ce > 0 ? ce : (Number(poi.high) + Number(poi.low)) / 2;
    if (Number.isFinite(poiPrice) && poiPrice > 0) {
      levels.push({
        id: 'poi',
        label: `🎯 POI: ${poi.label || poi.kind || 'M15'}`,
        price: Math.round(poiPrice * 100) / 100,
        direction: 'AUTO',
        note: `🎯 Area POI M15 (${poi.label || poi.kind || 'Zone'})`,
        category: 'poi',
        badgeColor: '#A855F7'
      });
    }
  }

  // 4. PDH & PDL
  let pdhVal = null, pdlVal = null;
  if (Array.isArray(ctx.liquidity)) {
    const h = ctx.liquidity.find(l => l.label === 'PDH' && Number.isFinite(Number(l.level)));
    if (h) pdhVal = Number(h.level);
    const l = ctx.liquidity.find(l => l.label === 'PDL' && Number.isFinite(Number(l.level)));
    if (l) pdlVal = Number(l.level);
  }
  if (!pdhVal && Number.isFinite(Number(ctx.amy?.dashboard?.pdh))) pdhVal = Number(ctx.amy.dashboard.pdh);
  if (!pdlVal && Number.isFinite(Number(ctx.amy?.dashboard?.pdl))) pdlVal = Number(ctx.amy.dashboard.pdl);

  if (pdhVal) {
    levels.push({
      id: 'pdh',
      label: '📅 PDH (High Kemarin)',
      price: Math.round(pdhVal * 100) / 100,
      direction: 'CROSS_ABOVE',
      note: '📅 Break PDH (High Kemarin)',
      category: 'daily',
      badgeColor: '#F59E0B'
    });
  }
  if (pdlVal) {
    levels.push({
      id: 'pdl',
      label: '📅 PDL (Low Kemarin)',
      price: Math.round(pdlVal * 100) / 100,
      direction: 'CROSS_BELOW',
      note: '📅 Break PDL (Low Kemarin)',
      category: 'daily',
      badgeColor: '#F59E0B'
    });
  }

  // 5. Asia High & Asia Low
  if (Array.isArray(ctx.liquidity)) {
    const ah = ctx.liquidity.find(l => (l.label === 'ASIA H' || l.label === 'ASIA HIGH') && Number.isFinite(Number(l.level)));
    if (ah) {
      levels.push({
        id: 'asiah',
        label: '🌏 Asia High',
        price: Math.round(Number(ah.level) * 100) / 100,
        direction: 'CROSS_ABOVE',
        note: '🌏 Asia High Sweep',
        category: 'session',
        badgeColor: '#0EA5E9'
      });
    }
    const al = ctx.liquidity.find(l => (l.label === 'ASIA L' || l.label === 'ASIA LOW') && Number.isFinite(Number(l.level)));
    if (al) {
      levels.push({
        id: 'asial',
        label: '🌏 Asia Low',
        price: Math.round(Number(al.level) * 100) / 100,
        direction: 'CROSS_BELOW',
        note: '🌏 Asia Low Sweep',
        category: 'session',
        badgeColor: '#0EA5E9'
      });
    }
  }

  // 6. Plan Entry / TP
  const plan = ctx.plan || ctx.amy?.assistant?.plan || ctx.amy?.plan;
  if (plan) {
    if (Number.isFinite(Number(plan.entry))) {
      levels.push({
        id: 'plan_entry',
        label: `🚀 Entry: ${plan.signalName || 'Plan'}`,
        price: Math.round(Number(plan.entry) * 100) / 100,
        direction: 'AUTO',
        note: `🚀 Target Entry Plan (${plan.signalName || 'Tactical'})`,
        category: 'plan',
        badgeColor: '#10B981'
      });
    }
    if (Number.isFinite(Number(plan.tp1 || plan.target))) {
      const tp = Number(plan.tp1 || plan.target);
      levels.push({
        id: 'plan_tp',
        label: '🎯 Target TP 1',
        price: Math.round(tp * 100) / 100,
        direction: 'AUTO',
        note: '🎯 Target Take Profit 1 (TP1)',
        category: 'plan',
        badgeColor: '#38BDF8'
      });
    }
  }

  return levels;
}

/**
 * Open modal prompt dialog to set a custom price alert
 * @param {number|string} prefillPrice - Default suggested price level
 * @param {Object} options - Optional defaults { direction, note }
 */
export function openAddAlertDialog(prefillPrice, options = {}) {
  if (typeof document === 'undefined') return;

  const curPrice = parsePrice(prefillPrice) || getCurrentLivePrice();
  const initialNote = options.note || '';
  const initialDirection = options.direction || 'AUTO';
  const ictPresets = getAvailableIctLevels();

  const modalId = 'amyfx-add-price-alert-modal';
  let modal = document.getElementById(modalId);
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = modalId;
  modal.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 9999999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(4, 8, 14, 0.75);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    padding: 16px;
    box-sizing: border-box;
    animation: fadeIn 0.2s ease-out;
  `;

  modal.innerHTML = `
    <div style="background:var(--amy-surface-solid,#131e2d); border:1px solid var(--amy-border-strong,rgba(177,214,255,0.25)); border-radius:16px; width:100%; max-width:400px; padding:20px; box-shadow:0 20px 40px rgba(0,0,0,0.6); color:#fff; box-sizing:border-box;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
        <h3 style="margin:0; font-size:16px; font-weight:800; display:flex; align-items:center; gap:8px;">
          <span>🔔</span> Pasang Alarm Harga &amp; Likuiditas
        </h3>
        <button type="button" id="amyfx-modal-close" style="background:transparent; border:0; color:#94A3B8; font-size:22px; cursor:pointer; line-height:1; padding:0 4px;">&times;</button>
      </div>
      <p style="margin:0 0 12px; font-size:12px; color:#94A3B8; line-height:1.4;">
        Notifikasi otomatis (Heads-Up HP, melodi, &amp; getar) akan aktif begitu harga XAU/USD menyentuh atau menyapu level ini.
      </p>

      ${ictPresets.length > 0 ? `
        <div style="margin-bottom:14px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
            <label style="font-size:11px; font-weight:700; color:#CBD5E1; text-transform:uppercase; letter-spacing:0.04em;">
              ⚡ Preset Cepat Level ICT (Sekali Klik)
            </label>
            <span style="font-size:10px; color:#94A3B8;">Isi instan level &amp; arah</span>
          </div>
          <div id="amyfx-alert-preset-chips" style="display:flex; flex-wrap:wrap; gap:6px; max-height:120px; overflow-y:auto; padding-right:2px;">
            ${ictPresets.map(p => `
              <button type="button" class="amyfx-preset-chip" data-price="${p.price.toFixed(2)}" data-dir="${p.direction}" data-note="${escapeHtml(p.note)}" style="display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:700; color:#fff; background:rgba(255,255,255,0.06); border:1px solid ${p.badgeColor}55; border-radius:6px; padding:5px 9px; cursor:pointer; transition:all 0.15s ease;">
                <span style="color:${p.badgeColor}; font-size:12px;">●</span>
                <span>${escapeHtml(p.label)}</span>
                <span style="color:#CBD5E1; font-variant-numeric:tabular-nums;">$${p.price.toFixed(2)}</span>
              </button>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div style="margin-bottom:12px;">
        <label style="display:block; font-size:11px; font-weight:700; color:#CBD5E1; margin-bottom:6px;">
          Target Harga XAU/USD (Harga Saat Ini: $${curPrice.toFixed(2)})
        </label>
        <div style="display:flex; align-items:center; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.18); border-radius:8px; padding:0 10px;">
          <span style="color:#94A3B8; font-weight:700;">$</span>
          <input type="number" id="amyfx-alert-input-price" step="0.10" value="${curPrice.toFixed(2)}" placeholder="4301.00" style="flex:1; background:transparent; border:0; color:#fff; padding:10px 8px; font-size:15px; font-weight:700; font-family:inherit; outline:none;" />
        </div>
      </div>

      <div style="margin-bottom:12px;">
        <label style="display:block; font-size:11px; font-weight:700; color:#CBD5E1; margin-bottom:6px;">
          Arah Pemicu (Trigger Direction)
        </label>
        <select id="amyfx-alert-input-direction" style="width:100%; background:#0c1320; color:#fff; border:1px solid rgba(255,255,255,0.18); border-radius:8px; padding:9px 10px; font-size:13px; outline:none;">
          <option value="AUTO" ${initialDirection === 'AUTO' ? 'selected' : ''}>Otomatis (Berdasarkan Level Harga)</option>
          <option value="CROSS_ABOVE" ${initialDirection === 'CROSS_ABOVE' ? 'selected' : ''}>▲ Tembus Ke Atas (CROSS_ABOVE / BSL)</option>
          <option value="CROSS_BELOW" ${initialDirection === 'CROSS_BELOW' ? 'selected' : ''}>▼ Tembus Ke Bawah (CROSS_BELOW / SSL)</option>
        </select>
      </div>

      <div style="margin-bottom:18px;">
        <label style="display:block; font-size:11px; font-weight:700; color:#CBD5E1; margin-bottom:6px;">
          Catatan / Label Notifikasi
        </label>
        <input type="text" id="amyfx-alert-input-note" value="${escapeHtml(initialNote)}" placeholder="Contoh: ⚡ SSL Sweep / Target TP 1" style="width:100%; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.18); border-radius:8px; padding:9px 10px; font-size:13px; color:#fff; outline:none; box-sizing:border-box;" />
      </div>

      <div style="display:flex; gap:10px;">
        <button type="button" id="amyfx-modal-cancel" style="flex:1; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.14); color:#fff; border-radius:8px; padding:10px; font-size:13px; font-weight:700; cursor:pointer;">
          Batal
        </button>
        <button type="button" id="amyfx-modal-save" style="flex:1; background:var(--amy-accent,#69b7ff); border:0; color:#0c1320; border-radius:8px; padding:10px; font-size:13px; font-weight:800; cursor:pointer;">
          Simpan Alarm
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const priceInput = document.getElementById('amyfx-alert-input-price');
  const dirInput = document.getElementById('amyfx-alert-input-direction');
  const noteInput = document.getElementById('amyfx-alert-input-note');
  const closeBtn = document.getElementById('amyfx-modal-close');
  const cancelBtn = document.getElementById('amyfx-modal-cancel');
  const saveBtn = document.getElementById('amyfx-modal-save');

  // Bind Preset Chips
  modal.querySelectorAll('.amyfx-preset-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = btn.getAttribute('data-price');
      const d = btn.getAttribute('data-dir');
      const n = btn.getAttribute('data-note');
      if (priceInput && p) priceInput.value = p;
      if (dirInput && d) dirInput.value = d;
      if (noteInput && n) noteInput.value = n;

      modal.querySelectorAll('.amyfx-preset-chip').forEach(b => {
        b.style.borderColor = 'rgba(255,255,255,0.15)';
        b.style.background = 'rgba(255,255,255,0.06)';
      });
      btn.style.borderColor = '#F5C451';
      btn.style.background = 'rgba(245,196,81,0.18)';

      triggerHapticFeedback('TOUCH');
    });
  });

  if (priceInput) {
    priceInput.focus();
    priceInput.select();
  }

  const closeModal = () => {
    modal.remove();
  };

  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  modal.addEventListener('click', e => {
    if (e.target === modal) closeModal();
  });

  saveBtn?.addEventListener('click', () => {
    const rawVal = priceInput?.value;
    const target = parsePrice(rawVal);
    if (!target) {
      alert('Masukkan angka target harga yang valid.');
      return;
    }

    const dirVal = dirInput?.value;
    const direction = dirVal === 'AUTO' ? undefined : dirVal;
    const note = noteInput?.value?.trim();

    try {
      addAlert(target, { direction, note, currentPrice: curPrice });
      triggerHapticFeedback();
      closeModal();
    } catch (err) {
      alert(err.message || 'Gagal menyimpan alarm.');
    }
  });
}

/**
 * Mount a standalone price alert card widget into any target element
 */
export function mountPriceAlertWidget(containerOrSelector) {
  renderAlertList(containerOrSelector);
}

/**
 * Initialize background listeners for price changes
 */
export function initPriceAlertObserver() {
  if (observerInitialized || typeof window === 'undefined') return;
  observerInitialized = true;

  // 1. Listen for WebSocket price ticks
  window.addEventListener('amyfx:twelvedata-price', event => {
    const price = event?.detail?.price;
    if (price) checkPrice(price);
  });

  // 2. Listen for generic price ticks
  window.addEventListener('amyfx:price-tick', event => {
    const price = event?.detail?.price || event?.detail;
    if (price) checkPrice(price);
  });

  // 3. Listen for context updates
  window.addEventListener('amyfx:market-context', event => {
    const candles = event?.detail?.amy?.chartCandles?.M15;
    if (candles?.length) {
      const last = candles.at(-1);
      if (last?.close) checkPrice(last.close);
    }
  });

  // 4. MutationObserver on #chart-price DOM element
  if (typeof document !== 'undefined') {
    const observeChartPrice = () => {
      const el = document.getElementById('chart-price');
      if (el) {
        const obs = new MutationObserver(() => {
          const text = el.textContent || '';
          const p = parseFloat(text.replace(/[^0-9.]/g, ''));
          if (parsePrice(p)) checkPrice(p);
        });
        obs.observe(el, { childList: true, characterData: true, subtree: true });
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', observeChartPrice);
    } else {
      observeChartPrice();
    }

    // 5. Lightweight periodic safety check (every 2.5s) to ensure no tick missed
    setInterval(() => {
      const p = getCurrentLivePrice();
      if (p && previousPrice !== null && Math.abs(p - previousPrice) > 0.001) {
        checkPrice(p);
      }
    }, 2500);
  }
}

/**
 * Get summary statistics of stored alerts
 */
export function getStats() {
  const alerts = getAlerts();
  return {
    total: alerts.length,
    active: alerts.filter(a => a.status === 'ACTIVE').length,
    triggered: alerts.filter(a => a.status === 'TRIGGERED').length,
    currentPrice: getCurrentLivePrice()
  };
}

// Global API Object
const priceAlertManager = {
  getAlerts,
  saveAlerts,
  addAlert,
  removeAlert,
  resetAlert,
  clearAlerts,
  checkPrice,
  setPreviousPrice,
  getCurrentLivePrice,
  notifyTriggeredAlert,
  playAlertBeep,
  triggerHapticFeedback,
  showInAppBanner,
  showIctBanner,
  dispatchIctLiveNotification,
  renderAlertList,
  openAddAlertDialog,
  mountPriceAlertWidget,
  initPriceAlertObserver,
  getStats,
  checkIctIntrabarSweeps,
  isGoldMarketOpen,
  getIctContext,
  getAvailableIctLevels,
  getIctCooldowns,
  clearIctCooldowns
};

// Auto-register to global window / globalThis for cross-module & UI accessibility
if (typeof globalThis !== 'undefined') {
  globalThis.AmyPriceAlertManager = priceAlertManager;
}
if (typeof window !== 'undefined') {
  window.AmyPriceAlertManager = priceAlertManager;
  initPriceAlertObserver();
}

export default priceAlertManager;
