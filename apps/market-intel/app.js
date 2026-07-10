/**
 * Amy FX — Market Intel App
 * ========================
 * Fetch: News dari SM_News_24h (via API)
 *        Heatmap dari liquidity calculation (via API)
 */

// ─── Config ──────────────────────────────────────────────
const API_BASE = 'https://amy-fx.vercel.app/api';
const REFRESH_INTERVAL = 60 * 1000; // Auto-refresh setiap 1 menit

// ─── State ───────────────────────────────────────────────
let currentTab = 'news';

// ─── Init ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  loadNews();
  loadHeatmap();

  // Auto-refresh
  setInterval(() => {
    if (currentTab === 'news') loadNews(true);
    else if (currentTab === 'heatmap') loadHeatmap(true);
    else if (currentTab === 'liquidity') loadLiquidity(true);
  }, REFRESH_INTERVAL);
});

// ─── Tab Navigation ──────────────────────────────────────
function setupTabs() {
  document.querySelectorAll('.intel-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      currentTab = tab;

      document.querySelectorAll('.intel-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.intel-panel').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(`panel-${tab}`).classList.add('active');

      if (tab === 'heatmap') loadHeatmap();
      else if (tab === 'liquidity') loadLiquidity();
      else loadNews();
    });
  });
}

// ─── News Loader ─────────────────────────────────────────
async function loadNews(silent = false) {
  const status = document.getElementById('news-status');
  const list = document.getElementById('news-list');
  if (!silent) status.textContent = '🔄 Memuat berita...';

  try {
    const res = await fetch(`${API_BASE}/news?limit=10`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    if (!data.news || data.news.length === 0) {
      status.textContent = '📭 Tidak ada berita gold saat ini';
      list.innerHTML = '<div class="empty-state">📭 Belum ada breaking news untuk XAU/USD.<br><small>Data dari SM_News_24h</small></div>';
      return;
    }

    status.textContent = `📰 ${data.news.length} berita relevan • ${formatTime(data.updated)}`;
    renderNews(data.news);
  } catch (e) {
    status.textContent = '⚠️ Gagal memuat berita';
    list.innerHTML = '<div class="empty-state">⚠️ Gagal terhubung. Coba lagi nanti.</div>';
  }
}

function renderNews(news) {
  const list = document.getElementById('news-list');
  list.innerHTML = news.map((item, i) => `
    <div class="news-item" style="animation-delay:${i * 0.05}s" onclick="this.classList.toggle('expanded')">
      <div class="news-time">${formatTime(item.time)}</div>
      <div class="news-text">${escapeHtml(item.text)}</div>
      <div class="news-link">Sumber: SM_News_24h</div>
    </div>
  `).join('');
}

// ─── Heatmap Loader ──────────────────────────────────────
async function loadHeatmap(silent = false) {
  const status = document.getElementById('heatmap-status');
  if (!silent) status.textContent = '🔄 Menghitung heatmap...';

  try {
    const res = await fetch(`${API_BASE}/heatmap?interval=15min&outputsize=200`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    if (!data.zones || data.zones.length === 0) {
      status.textContent = '⚠️ Data belum cukup untuk heatmap';
      return;
    }

    document.getElementById('heatmap-price').textContent =
      `💰 XAU/USD ${data.currentPrice?.toFixed(2) || '--'}`;
    status.textContent = `🔥 ${data.zones.length} zona likuiditas • ${formatTime(data.updated)}`;
    renderHeatmap(data.zones, data.currentPrice);
  } catch (e) {
    status.textContent = '⚠️ Gagal memuat heatmap';
  }
}

function renderHeatmap(zones, currentPrice) {
  const canvas = document.getElementById('heatmap-canvas');
  if (!zones.length) return;

  // Temukan rentang harga
  const allPrices = zones.map(z => z.price);
  if (currentPrice) allPrices.push(currentPrice);
  const maxPrice = Math.max(...allPrices) + 2;
  const minPrice = Math.min(...allPrices) - 2;
  const totalRange = maxPrice - minPrice;

  // Temukan max activity untuk scaling
  const maxActivity = Math.max(...zones.map(z => z.totalActivity), 1);

  canvas.innerHTML = zones.map(z => {
    const pct = ((z.price - minPrice) / totalRange) * 100;
    const isCurrent = z.isCurrent;
    const resistH = z.resistCount > 0 ? (z.resistCount / maxActivity) * 60 : 0;
    const supportH = z.supportCount > 0 ? (z.supportCount / maxActivity) * 60 : 0;

    return `
      <div class="hz-row" style="top:${(100 - pct).toFixed(1)}%">
        <span class="hz-price ${isCurrent ? 'current' : ''}">${z.price}</span>
        <div class="hz-bars">
          ${z.resistCount > 0 ? `<div class="hz-bar resist" style="width:${z.resistCount / maxActivity * 100}%" title="Resist: ${z.resistCount}">${z.resistCount}</div>` : ''}
          ${z.supportCount > 0 ? `<div class="hz-bar support" style="width:${z.supportCount / maxActivity * 100}%" title="Support: ${z.supportCount}">${z.supportCount}</div>` : ''}
        </div>
        ${z.label ? `<span class="hz-label">${z.label}</span>` : ''}
        ${isCurrent ? '<span class="hz-now">◀ HARGA</span>' : ''}
      </div>
    `;
  }).join('');

  // Hapus loading
  hideLoading();
}

// ─── Liquidity Loader ────────────────────────────────────
async function loadLiquidity(silent = false) {
  const status = document.getElementById('liquidity-status');
  const list = document.getElementById('liquidity-list');
  if (!status || !list) return;
  if (!silent) status.textContent = '🔄 Melacak liquidity...';

  try {
    const res = await fetch(`${API_BASE}/liquidity?interval=15min&outputsize=200`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    if (!data.levels || data.levels.length === 0) {
      status.textContent = '⚠️ Belum ada level liquidity terdeteksi';
      list.innerHTML = '<div class="empty-state">📭 Belum ada swing level aktif.<br><small>Data dari TwelveData M15</small></div>';
      return;
    }

    const priceStr = data.currentPrice ? data.currentPrice.toFixed(2) : '--';
    status.textContent = `💧 ${data.levels.length} level aktif • XAU/USD ${priceStr} • ${formatTime(data.updated)}`;
    renderLiquidity(data.levels, data.currentPrice);
  } catch (e) {
    status.textContent = '⚠️ Gagal memuat liquidity';
    list.innerHTML = '<div class="empty-state">⚠️ Gagal terhubung. Coba lagi nanti.</div>';
  }
}

function renderLiquidity(levels, currentPrice) {
  const list = document.getElementById('liquidity-list');
  if (!list) return;

  list.innerHTML = levels.map((lv, i) => {
    const isBSL = lv.type === 'BSL';
    const badgeClass = isBSL ? 'bsl' : 'ssl';
    const arrow = lv.distance > 0 ? '↑' : '↓';
    const distAbs = Math.abs(lv.distance).toFixed(2);

    return `
      <div class="liq-card" style="animation-delay:${i * 0.04}s">
        <span class="liq-badge ${badgeClass}">${lv.type}</span>
        <span class="liq-price">${lv.price.toFixed(2)}</span>
        <span class="liq-meta">${arrow} ${distAbs} pips</span>
        <span class="liq-meta">${lv.candlesAgo} candle lalu</span>
        <span class="liq-meta">● Aktif</span>
      </div>
    `;
  }).join('');
}

// ─── Helpers ─────────────────────────────────────────────
function formatTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;
    if (diff < 60 * 1000) return 'Baru saja';
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}m lalu`;
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WITA';
  } catch { return iso; }
}

function truncate(text, max) {
  return text.length > max ? text.slice(0, max) + '...' : text;
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}

function openLink(url) {
  try {
    if (window.Android?.openUrl) window.Android.openUrl(url);
    else window.open(url, '_blank');
  } catch { window.open(url, '_blank'); }
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.style.display = 'none';
}

// Sembunyikan loading setelah 2 detik (fallback)
setTimeout(hideLoading, 2000);
