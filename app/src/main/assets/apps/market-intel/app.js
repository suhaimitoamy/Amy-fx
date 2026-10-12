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
let currentTab = 'sentiment';
let pendingNewsId = '';
let newsRouteRetries = 0;
let newsFetchSequence = 0;
let isCalendarLive = false;
const requestControllers = {};
const panelLoadedAt = {};

function newsId(item) {
  return String(item?.id || `${item?.time || ''}:${item?.textOriginal || item?.text || ''}`);
}

function newsTargetUrl(id) {
  const base = 'file:///android_asset/apps/market-intel/index.html';
  return `${base}#news=${encodeURIComponent(id)}`;
}

function isNewsRelevantForGold(item) {
  if (!item) return false;
  if (item.relevant === true) return true;
  const text = (item.text || item.textOriginal || '').toLowerCase();
  const goldKeywords = [
    'gold', 'xau', 'emas', 'bullion', 'fed', 'fomc', 'powell',
    'inflation', 'cpi', 'pce', 'treasury', 'yield', 'dxy', 'dollar',
    'dolar', 'nfp', 'payroll', 'jobless', 'claims', 'war', 'perang',
    'geopolit', 'safe haven', 'central bank', 'bank sentral',
    'suku bunga', 'rate cut', 'rate hike'
  ];
  return goldKeywords.some(kw => text.includes(kw));
}

window.openEvidenceNews = function(id) {
  activateTab('news');
  focusNewsItem(id);
};

window.openEvidenceCalendar = function() {
  activateTab('calendar');
};

function cleanNewsContent(value) {
  return String(value || '')
    .replace(/https?:\/\/(?:t\.me|telegram\.me|telegram\.dog)\/\S+/gi, '')
    .replace(/@?SM[\s_-]*News[\s_-]*(?:24h?|24[\s_-]*jam)?/gi, '')
    .replace(/^\s*(?:sumber|source)\s*:\s*$/gim, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function prepareNewsItem(item) {
  const prepared = { ...item };
  prepared.textOriginal = cleanNewsContent(prepared.textOriginal);
  prepared.text = cleanNewsContent(prepared.text) || prepared.textOriginal || 'Berita terbaru XAU/USD.';
  delete prepared.link;
  delete prepared.source;
  return prepared;
}

function readNewsRoute() {
  try {
    const hash = (location.hash || '').replace(/^#/, '');
    const params = new URLSearchParams(hash.includes('=') ? hash : location.search);
    return params.get('news') || '';
  } catch (_) {
    return '';
  }
}

function beginRequest(panel) {
  if (requestControllers[panel]) requestControllers[panel].abort();
  requestControllers[panel] = new AbortController();
  return requestControllers[panel].signal;
}

function shouldRefresh(panel, maxAge = 30000) {
  return !panelLoadedAt[panel] || Date.now() - panelLoadedAt[panel] > maxAge;
}

function clearHeatmapState() {
  const canvas = document.getElementById('heatmap-canvas');
  if (canvas) canvas.replaceChildren();
  const price = document.getElementById('heatmap-price');
  if (price) price.textContent = '--';
  hideLoading();
}

function payloadIsFresh(updated, maxAgeMs = 10 * 60 * 1000) {
  if (!updated) return true;
  const timestamp = new Date(updated).getTime();
  return !Number.isFinite(timestamp) || Date.now() - timestamp <= maxAgeMs;
}

// ─── Init ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  pendingNewsId = readNewsRoute();
  // ICT Intel owns the hero; legacy snapshots cannot overwrite Mapping levels.

  setupTabs();
  setupNewsInteractions();
  setupCalendarFilters();

  if (pendingNewsId) {
    activateTab('news');
  } else {
    activateTab('sentiment');
  }

  // Instant render from local cache first, then sync in background
  loadSentiment();
  loadCalendar();
  loadNews();

  // Auto-refresh
  setInterval(() => {
    if (document.hidden) return;
    if (currentTab === 'news') loadNews(true);
    else if (currentTab === 'calendar') loadCalendar(true);
    else if (currentTab === 'sentiment') loadSentiment(true);
    else if (currentTab === 'heatmap') loadHeatmap(true);
    else if (currentTab === 'liquidity') loadLiquidity(true);
  }, REFRESH_INTERVAL);

  document.addEventListener('visibilitychange', () => {
    document.body.classList.toggle('webview-idle', document.hidden);
    if (!document.hidden) {
      if (currentTab === 'news' && shouldRefresh('news', REFRESH_INTERVAL)) loadNews(true);
      if (currentTab === 'calendar' && shouldRefresh('calendar', REFRESH_INTERVAL)) loadCalendar(true);
      if (currentTab === 'sentiment') loadSentiment(true);
      if (currentTab === 'heatmap' && shouldRefresh('heatmap', REFRESH_INTERVAL)) loadHeatmap(true);
      if (currentTab === 'liquidity' && shouldRefresh('liquidity', REFRESH_INTERVAL)) loadLiquidity(true);
    }
  });
});

window.addEventListener('hashchange', () => {
  pendingNewsId = readNewsRoute();
  if (pendingNewsId) {
    activateTab('news');
    if (!focusNewsItem(pendingNewsId)) loadNews(true);
  }
});

// ─── Tab Navigation ──────────────────────────────────────
function setupTabs() {
  document.querySelectorAll('.intel-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activateTab(btn.dataset.tab);
    });
  });
}

function activateTab(tab) {
  if (!['news', 'calendar', 'sentiment', 'heatmap', 'liquidity'].includes(tab)) return;
  currentTab = tab;
  document.querySelectorAll('.intel-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.intel-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${tab}`));
  if (tab === 'calendar' && shouldRefresh('calendar')) loadCalendar();
  else if (tab === 'news' && shouldRefresh('news')) loadNews();
  else if (tab === 'sentiment') loadSentiment();
  else if (tab === 'heatmap' && shouldRefresh('heatmap')) loadHeatmap();
  else if (tab === 'liquidity' && shouldRefresh('liquidity')) loadLiquidity();
}

// ─── Dynamic 5-Point Fundamental Briefing Engine ──────────────
function parseCalendarNumber(str) {
  if (!str || str === '—' || str === '--') return null;
  const match = String(str).match(/([+-]?\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

function analyzeMacroEvent(ev) {
  if (!ev) return null;
  const title = String(ev.title || '').trim();
  const titleLower = title.toLowerCase();
  const fVal = parseCalendarNumber(ev.forecast);
  const pVal = parseCalendarNumber(ev.previous);
  const aVal = parseCalendarNumber(ev.actual);
  const isReleased = aVal !== null;

  let category = 'other';
  let bias = 'NEUTRAL';
  let scenarioDesc = '';

  if (titleLower.includes('unemployment claims') || titleLower.includes('jobless claims')) {
    category = 'claims';
    if (isReleased) {
      const refVal = fVal !== null ? fVal : pVal;
      if (refVal !== null && aVal > refVal) {
        bias = 'BULLISH_BOUNCE';
        scenarioDesc = `Klaim pengangguran aktual lebih tinggi dari proyeksi (${aVal}K vs ${refVal}K), mengindikasikan pasar tenaga kerja AS mulai mendingin dan membuka peluang nafas lega bagi Gold.`;
      } else if (refVal !== null && aVal < refVal) {
        bias = 'BEARISH_PRESSURE';
        scenarioDesc = `Klaim pengangguran aktual lebih rendah dari proyeksi (${aVal}K vs ${refVal}K), mencerminkan pasar tenaga kerja AS yang masih solid dan menjaga Dolar AS tetap perkasa menekan Gold.`;
      } else {
        bias = 'NEUTRAL';
        scenarioDesc = `Klaim pengangguran aktual keluar sesuai proyeksi (${aVal}K), reaksi pasar cenderung berimbang.`;
      }
    } else {
      if (fVal !== null && pVal !== null && fVal > pVal) {
        bias = 'BULLISH_BOUNCE';
        scenarioDesc = 'Proyeksi kenaikan klaim pengangguran mengindikasikan pasar tenaga kerja AS mulai mendingin, membuka peluang nafas lega bagi Gold.';
      } else {
        bias = 'BEARISH_PRESSURE';
        scenarioDesc = 'Klaim pengangguran masih rendah mencerminkan pasar tenaga kerja AS yang solid, menjaga Dolar AS tetap perkasa menekan Gold.';
      }
    }
  } else if (titleLower.includes('cpi') || titleLower.includes('pce') || titleLower.includes('inflation')) {
    category = 'inflation';
    if (isReleased) {
      const refVal = fVal !== null ? fVal : pVal;
      if (refVal !== null && aVal > refVal) {
        bias = 'BEARISH_PRESSURE';
        scenarioDesc = `Data inflasi aktual keluar lebih panas dari perkiraan (${aVal}% vs ${refVal}%), memperkuat ekspektasi suku bunga ketat The Fed dan menekan Gold.`;
      } else if (refVal !== null && aVal < refVal) {
        bias = 'BULLISH_BOUNCE';
        scenarioDesc = `Data inflasi aktual melandai di bawah perkiraan (${aVal}% vs ${refVal}%), meredakan kekhawatiran suku bunga dan mendukung reli Gold.`;
      } else {
        bias = 'NEUTRAL';
        scenarioDesc = `Data inflasi aktual sesuai konsensus (${aVal}%), fokus pasar beralih ke rincian komponen inti.`;
      }
    } else {
      bias = (fVal !== null && pVal !== null && fVal > pVal) ? 'BEARISH_PRESSURE' : 'BULLISH_BOUNCE';
      scenarioDesc = 'Data inflasi sangat menentukan arah suku bunga The Fed. Inflasi panas menekan emas, sedangkan inflasi melandai mendorong reli emas.';
    }
  } else if (titleLower.includes('non-farm') || titleLower.includes('payrolls') || titleLower.includes('unemployment rate')) {
    category = 'labor';
    if (isReleased) {
      if (titleLower.includes('unemployment rate')) {
        const refVal = fVal !== null ? fVal : pVal;
        bias = (refVal !== null && aVal > refVal) ? 'BULLISH_BOUNCE' : 'BEARISH_PRESSURE';
      } else {
        const refVal = fVal !== null ? fVal : pVal;
        bias = (refVal !== null && aVal > refVal) ? 'BEARISH_PRESSURE' : 'BULLISH_BOUNCE';
      }
      scenarioDesc = `Rilis aktual data tenaga kerja AS (${aVal}) telah memicu volatilitas tinggi pada DXY dan Gold.`;
    } else {
      bias = 'VOLATILE';
      scenarioDesc = 'Rilis data ketenagakerjaan tier-1 menciptakan volatilitas tinggi dan menentukan ekspektasi pelonggaran moneter The Fed.';
    }
  } else if (titleLower.includes('fomc') || titleLower.includes('rate decision') || titleLower.includes('powell')) {
    category = 'fomc';
    bias = 'FED_POLICY';
    scenarioDesc = 'Sinyal arah suku bunga dan pernyataan ketua The Fed menjadi kompas utama pergerakan Dolar AS dan imbal hasil obligasi riil.';
  } else if (titleLower.includes('pmi')) {
    category = 'pmi';
    if (isReleased) {
      const refVal = fVal !== null ? fVal : 50;
      bias = (aVal > refVal) ? 'BEARISH_PRESSURE' : 'BULLISH_BOUNCE';
      scenarioDesc = `Indeks PMI aktual (${aVal}) ${aVal > 50 ? 'mengonfirmasi ekspansi ekonomi AS yang mendukung USD' : 'mengindikasikan kontraksi ekonomi yang menopang Gold'}.`;
    } else {
      bias = (fVal !== null && pVal !== null && fVal > 50) ? 'BEARISH_PRESSURE' : 'BULLISH_BOUNCE';
      scenarioDesc = 'Indeks manufaktur & jasa mengukur ekspansi ekonomi AS yang memicu penguatan Dolar jika berada di atas 50.';
    }
  }

  return { title, category, bias, scenarioDesc, fVal, pVal, aVal, isReleased };
}

let simulatedOverrides = null;
try {
  const savedSim = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('amyfx_sim_override') : null;
  if (savedSim) simulatedOverrides = JSON.parse(savedSim);
} catch (_) {}

window.simulateEventRelease = function(type) {
  if (type === 'reset') {
    simulatedOverrides = null;
    try { sessionStorage.removeItem('amyfx_sim_override'); } catch (_) {}
  } else {
    simulatedOverrides = { type, activeAt: Date.now() };
    try { sessionStorage.setItem('amyfx_sim_override', JSON.stringify(simulatedOverrides)); } catch (_) {}
  }
  loadSentiment(true);
};

function extractActualForEvent(ev, newsItems) {
  if (!ev || !Array.isArray(newsItems) || newsItems.length === 0) return null;
  const title = String(ev.title || '').toLowerCase();

  const keywords = [];
  if (title.includes('unemployment claims') || title.includes('jobless claims')) {
    keywords.push('unemployment claims', 'jobless claims', 'klaim pengangguran', 'klaim awal');
  } else if (title.includes('non-farm') || title.includes('nonfarm') || title.includes('payrolls')) {
    keywords.push('non-farm', 'nonfarm', 'payroll', 'nfp');
  } else if (title.includes('unemployment rate')) {
    keywords.push('unemployment rate', 'tingkat pengangguran');
  } else if (title.includes('hourly earnings')) {
    keywords.push('hourly earnings', 'penghasilan rata-rata per jam', 'upah per jam');
  } else if (title.includes('cpi')) {
    keywords.push('cpi', 'ihk', 'inflasi');
  } else if (title.includes('pce')) {
    keywords.push('pce');
  } else if (title.includes('pmi')) {
    keywords.push('pmi');
  } else if (title.includes('retail sales')) {
    keywords.push('retail sales', 'penjualan ritel');
  } else if (title.includes('gdp')) {
    keywords.push('gdp', 'pdb');
  } else {
    keywords.push(title);
  }

  for (const item of newsItems) {
    const raw = `${item.text || ''}\n${item.textOriginal || ''}`;
    const lower = raw.toLowerCase();
    const matchedKw = keywords.find(kw => lower.includes(kw));
    if (!matchedKw) continue;

    // Pattern 1: Explicit Label "Aktual: 89K" or "Actual: 89K" or "Hasil: 89K"
    const p1 = raw.match(/(?:Aktual|Actual|Hasil|Rilis)\s*[:=]\s*([+-]?\d+(?:[\.,]\d+)?[%KkMmBb]?)/i);
    if (p1 && p1[1]) return p1[1].trim();

    // Pattern 2: "EventName: 89K (vs ...)"
    const kwEsc = matchedKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const p2 = new RegExp(`${kwEsc}[^\\n\\r:]*[:=]\\s*([+-]?\\d+(?:[\\.,]\\d+)?[%KkMmBb]?)`, 'i').exec(raw);
    if (p2 && p2[1]) return p2[1].trim();

    // Pattern 3: "tercatat 89K" / "keluar 89K" / "sebesar 89K"
    const p3 = raw.match(/(?:tercatat|keluar|sebesar|mencapai)\s*([+-]?\d+(?:[\.,]\d+)?[%KkMmBb]?)/i);
    if (p3 && p3[1]) return p3[1].trim();
  }
  return null;
}

async function loadSentiment(isBackground = false) {
  const container = document.getElementById('sentiment-content');
  const statusEl = document.getElementById('sentiment-status');
  if (!container) return;

  const now = new Date();
  const timeZone = 'Asia/Makassar';

  // Format Tanggal & Jam WITA
  const dateStrWita = now.toLocaleDateString('id-ID', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const todayYMD = now.toLocaleDateString('en-CA', { timeZone });
  const timeStrWita = now.toLocaleTimeString('en-GB', { timeZone, hour: '2-digit', minute: '2-digit' }) + ' WITA';

  const cached = getCachedCalendar();
  const events = (cached?.events || calendarEvents || []);
  const usdEvents = events.filter(e => String(e.country || '').toUpperCase() === 'USD');
  const hasEvents = usdEvents.length > 0;

  // Ambil berita lokal untuk bukti geopolitik & energi, dan enrich actual
  let newsItems = [];
  try {
    const rawNews = localStorage.getItem('amyfx.assistant.news.v1');
    if (rawNews) {
      const parsedNews = JSON.parse(rawNews);
      if (Array.isArray(parsedNews?.items)) {
        newsItems = parsedNews.items;
      }
    }
  } catch (_) {}

  // Filter event USD hari ini (WITA)
  const todayUsd = usdEvents.filter(e => {
    const d = new Date(e.date);
    if (!Number.isFinite(d.getTime())) return false;
    return d.toLocaleDateString('en-CA', { timeZone }) === todayYMD;
  });

  // Urutkan event berdasarkan jam
  todayUsd.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Enrich event dengan data aktual dari news feed jika ada
  for (const ev of todayUsd) {
    if (!ev.actual || ev.actual === '—' || ev.actual === '--') {
      const ext = extractActualForEvent(ev, newsItems);
      if (ext) {
        ev.actual = ext;
        ev.actualSource = 'news_feed';
      }
    }
  }

  // Prioritaskan event High & Medium
  const importantToday = todayUsd.filter(e => {
    const imp = String(e.impact || '').toLowerCase();
    return imp === 'high' || imp === 'medium';
  });

  // Ambil event utama hari ini (prioritaskan NFP / CPI / FOMC Tier-1)
  const headlineEvent = importantToday.find(e => {
    const t = String(e.title || '').toLowerCase();
    return t.includes('non-farm') || t.includes('payrolls') || t.includes('cpi') || t.includes('pce') || t.includes('rate decision') || t.includes('fomc');
  });
  const mainEvent = headlineEvent || importantToday[0] || todayUsd[0] || usdEvents.find(e => {
    const t = new Date(e.date).getTime();
    return Number.isFinite(t) && t >= now.getTime();
  });

  const nfpEvent = todayUsd.find(e => /non-farm|payroll/i.test(e.title));
  const unempEvent = todayUsd.find(e => /unemployment rate/i.test(e.title));
  const wageEvent = todayUsd.find(e => /hourly earnings/i.test(e.title));
  const isLaborPackage = Boolean(nfpEvent || unempEvent || wageEvent);

  // Terapkan simulasi lab override jika aktif
  if (simulatedOverrides?.type && mainEvent) {
    const isCool = simulatedOverrides.type === 'cool';
    const t = String(mainEvent.title || '').toLowerCase();
    if (t.includes('claims')) {
      mainEvent.actual = isCool ? '230K' : '185K';
    } else if (t.includes('non-farm') || t.includes('payroll')) {
      mainEvent.actual = isCool ? '45K' : '145K';
    } else if (t.includes('unemployment rate')) {
      mainEvent.actual = isCool ? '4.3%' : '3.9%';
    } else if (t.includes('cpi') || t.includes('inflation') || t.includes('pce')) {
      mainEvent.actual = isCool ? '0.1%' : '0.5%';
    } else if (t.includes('pmi')) {
      mainEvent.actual = isCool ? '47.5' : '56.8';
    } else if (t.includes('hourly earnings')) {
      mainEvent.actual = isCool ? '0.1%' : '0.5%';
    } else {
      mainEvent.actual = isCool ? 'Data Dingin' : 'Data Panas';
    }
    mainEvent.isSimulated = true;

    if (nfpEvent && nfpEvent !== mainEvent) {
      nfpEvent.actual = isCool ? '45K' : '145K';
      nfpEvent.isSimulated = true;
    }
    if (unempEvent && unempEvent !== mainEvent) {
      unempEvent.actual = isCool ? '4.3%' : '3.9%';
      unempEvent.isSimulated = true;
    }
    if (wageEvent && wageEvent !== mainEvent) {
      wageEvent.actual = isCool ? '0.1%' : '0.5%';
      wageEvent.isSimulated = true;
    }
  }

  const evTime = mainEvent ? new Date(mainEvent.date).getTime() : 0;
  const isTimePassed = Number.isFinite(evTime) && now.getTime() > evTime;
  const minutesSinceScheduled = isTimePassed ? Math.floor((now.getTime() - evTime) / 60000) : 0;

  const eventAnalysis = analyzeMacroEvent(mainEvent);

  const newsTextCombined = newsItems.map(n => String(n.text || n.textOriginal || '')).join(' ').toLowerCase();

  const geopoliticsItems = newsItems.filter(n => {
    const t = (n.text || n.textOriginal || '').toLowerCase();
    return t.includes('perang') || t.includes('war') || t.includes('geopolit') ||
           t.includes('serangan') || t.includes('attack') || t.includes('israel') ||
           t.includes('iran') || t.includes('russia') || t.includes('ukraina') ||
           t.includes('timur tengah') || t.includes('middle east');
  });
  const hasGeopolitics = geopoliticsItems.length > 0;

  const deescalationItems = newsItems.filter(n => {
    const t = (n.text || n.textOriginal || '').toLowerCase();
    return t.includes('gencatan senjata') || t.includes('ceasefire') || t.includes('damai') ||
           t.includes('peace') || t.includes('deescalat') || t.includes('de-eskalasi');
  });
  const isDeescalation = deescalationItems.length > 0;

  const energyItems = newsItems.filter(n => {
    const t = (n.text || n.textOriginal || '').toLowerCase();
    return t.includes('minyak') || t.includes('oil') || t.includes('brent') ||
           t.includes('opec') || t.includes('energi') || t.includes('energy');
  });
  const hasEnergyRisk = energyItems.length > 0;

  // Cache freshness check (Bug 3)
  const cacheAgeMs = cached?.savedAt ? Date.now() - cached.savedAt : 0;
  const isStaleCache = cacheAgeMs > 24 * 60 * 60 * 1000;

  // Header Sync Badge (Bug 1 & 3)
  let syncBadgeHtml = '';
  if (!hasEvents) {
    syncBadgeHtml = '<div class="briefing-sync-badge sync-disconnected">🔴 Kalender Belum Terhubung</div>';
  } else if (isCalendarLive) {
    syncBadgeHtml = '<div class="briefing-sync-badge sync-live">🟢 Kalender Terhubung (Live)</div>';
  } else if (isStaleCache) {
    syncBadgeHtml = '<div class="briefing-sync-badge sync-cache">🟠 Kalender Terhubung (Cache Usang >24 Jam)</div>';
  } else {
    syncBadgeHtml = '<div class="briefing-sync-badge sync-cache">🟡 Kalender Terhubung (Cache Lokal)</div>';
  }

  // Sintesis Status Scorecard & Kompas
  let usdScore = '🟢 Cenderung Kuat';
  let yieldScore = '🟢 Menjadi Tekanan untuk Emas';
  let riskScore = '⚖️ Campuran — Pasar Menanti Data';
  let goldBias = '↘️ Netral Cenderung Bearish (Jangka Pendek)';
  let goldBiasClass = 'bearish';
  let conclusionBias = '⚠️ WAIT / SELL ON RALLY';
  let horizonStr = 'Sesi Berjalan';
  let conclusionGuide = '';
  let dom1Title = '';
  let dom1Reason = '';
  let dom2Title = '';
  let dom2Reason = '';
  let dom3Title = 'Imbal Hasil US Treasury 10-Year';
  let dom3Reason = 'Korelasi negatif yield obligasi terhadap daya tarik emas non-yielding tetap menjadi faktor penentu arus modal institusi.';
  let mainScenario = '';
  let confirmCondition = '';
  let invalidationCondition = '';
  let mappingBridgeText = '';

  const isReleased = Boolean(eventAnalysis?.isReleased);

  if (!hasEvents) {
    // Baseline Bug 1: No data should NOT give SELL ON RALLY
    usdScore = '⚪ Data Belum Tersedia';
    yieldScore = '⚪ Menunggu Sinyal Pasar';
    riskScore = '⚪ Data Netral / Tidak Ada Rilis';
    goldBias = '⚪ Belum Cukup Data Fundamental Baru';
    goldBiasClass = 'insufficient';
    conclusionBias = '⚪ BELUM CUKUP DATA';
    horizonStr = 'Menunggu Katalis';
    conclusionGuide = 'Belum ada rilis data ekonomi AS atau data kalender belum tersinkronisasi. Analisis fundamental memerlukan data makro terverifikasi. Untuk sesi ini, fokuskan keputusan transaksi pada struktur teknikal Dealing Range dan konfirmasi Price Action di tab Mapping.';
    dom1Title = 'Ketiadaan Katalis Makro AS Terjadwal';
    dom1Reason = 'Belum ada rilis data ekonomi atau jadwal kalender belum tersinkronisasi.';
    dom2Title = 'Struktur Likuiditas & Dealing Range';
    dom2Reason = 'Pergerakan harga saat ini sepenuhnya dipandu oleh sapuan likuiditas teknis di chart.';
    mainScenario = 'Disiplin menunggu konfirmasi Price Action ICT murni di zona PD Array Mapping.';
    confirmCondition = 'Sinyal teknikal MSS valid di Dealing Range M5/M15.';
    invalidationCondition = 'Munculnya breaking news atau kejutan data fundamental baru.';
    mappingBridgeText = 'Tanpa data ekonomi tier-1 terjadwal, jangan paksakan bias arah fundamental. Tunggu konfirmasi sapuan likuiditas (BSL/SSL) dan entri di Diskon/Premium PD Array pada tab Mapping.';
  } else if (eventAnalysis?.bias === 'BULLISH_BOUNCE') {
    usdScore = isReleased ? '🔴 Melemah Pasca Rilis' : '🔴 Cenderung Melemah';
    yieldScore = '🔴 Mereda — Memberi Ruang Reli Emas';
    goldBias = '↗️ Netral Cenderung Bullish';
    goldBiasClass = 'bullish';
    conclusionBias = '🟢 BUY ON DIPS';
    horizonStr = isReleased ? 'Pasca-Rilis Data' : 'Menjelang Rilis';
    dom1Title = isReleased ? `Data Aktual: ${mainEvent.title}` : `Konsensus Proyeksi: ${mainEvent.title}`;
    dom1Reason = eventAnalysis.scenarioDesc || 'Pendinginan ekonomi AS menekan Dolar dan membuka peluang penguatan Gold.';
    mainScenario = isReleased
      ? 'Mencari entri Buy on Dips pasca data dovish sesudah likuiditas bawah (SSL) tersapu.'
      : 'Mencari peluang Buy on Dips di zona Diskon PD Array jika konsensus data terkonfirmasi.';
    confirmCondition = isReleased
      ? 'DXY menembus support dan yield 10-Year bergerak turun.'
      : `Actual rilis ${mainEvent.forecast ? 'lebih dingin/lemah dari ' + mainEvent.forecast : 'melemah'}.`;
    invalidationCondition = 'Harga gagal bertahan di atas demand kunci atau data lanjutan berbalik kuat.';
    conclusionGuide = isReleased
      ? `Data aktual ${mainEvent.title} (${mainEvent.actual}) mengonfirmasi pelemahan DXY. Cari konfirmasi Buy di zona Diskon PD Array atau demand support sesudah likuiditas bawah diambil.`
      : `Konsensus proyeksi ${mainEvent.title} mengindikasikan pendinginan data AS. Cari konfirmasi Buy di zona Diskon PD Array sesudah likuiditas bawah diambil.`;
    mappingBridgeText = 'Cari konfirmasi entri BUY di area Diskon PD Array (FVG/OB Bullish) sesudah Sell-Side Liquidity (SSL) tersapu.';
  } else if (eventAnalysis?.bias === 'BEARISH_PRESSURE') {
    usdScore = isReleased ? '🟢 Menguat Pasca Rilis' : '🟢 Cenderung Kuat';
    yieldScore = '🟢 Menjadi Tekanan untuk Emas';
    goldBias = '↘️ Netral Cenderung Bearish';
    goldBiasClass = 'bearish';
    conclusionBias = '⚠️ WAIT / SELL ON RALLY';
    horizonStr = isReleased ? 'Pasca-Rilis Data' : 'Menjelang Rilis';
    dom1Title = isReleased ? `Data Aktual: ${mainEvent.title}` : `Konsensus Proyeksi: ${mainEvent.title}`;
    dom1Reason = eventAnalysis.scenarioDesc || 'Kekuatan ekonomi dan Dolar AS membatasi potensi reli harga emas.';
    mainScenario = 'Mencari setup SELL ON RALLY di zona Premium PD Array / Supply sesudah pullback atau sapuan likuiditas atas.';
    confirmCondition = isReleased
      ? 'DXY menembus resistance dan yield US 10-Year naik kuat.'
      : `Actual rilis ${mainEvent.forecast ? 'lebih panas/kuat dari ' + mainEvent.forecast : 'menguat'}.`;
    invalidationCondition = 'Sentimen geopolitik eskalatif mendadak atau kejutan data dovish yang menyapu zona supply.';
    conclusionGuide = (eventAnalysis?.category === 'claims' && !isReleased && eventAnalysis.fVal !== null && eventAnalysis.pVal !== null && eventAnalysis.fVal > eventAnalysis.pVal)
      ? `Bias harian tetap waspada Sell on Rally di zona supply, namun jangan mengejar sell di harga bawah sebelum rilis data jam ${new Date(mainEvent.date).toLocaleTimeString('en-GB', { timeZone, hour: '2-digit', minute: '2-digit' })} WITA karena ada potensi pantulan teknikal jika klaim naik ke ${escapeHtml(mainEvent.forecast)}.`
      : `Secara fundamental, mencari setup SELL ON RALLY di zona resistance/supply lebih masuk akal hari ini. Namun, hindari mengejar posisi sell di harga bawah (diskon) sebelum terjadi pullback atau sapuan likuiditas atas.`;
    mappingBridgeText = 'Fokus Sell on Rally di zona Premium PD Array (FVG/OB Bearish) sesudah Buy-Side Liquidity (BSL) tersapu. Hindari mengejar sell di harga diskon.';
  } else if (isLaborPackage && !isReleased) {
    usdScore = '🟢 Cenderung Kuat (Resilien)';
    yieldScore = '🟢 Menjadi Tekanan untuk Emas';
    riskScore = '⚖️ Campuran — Tensi Geopolitik Menahan Penurunan';
    goldBias = '↘️ Tekanan Bearish / Waspada Sell di Supply';
    goldBiasClass = 'bearish';
    conclusionBias = '⚠️ BEARISH PRESSURE / SELL ON RALLY DI PREMIUM';
    horizonStr = 'Sesi NY · Pra-NFP';
    dom1Title = 'Katalis Ketenagakerjaan AS (NFP & Tingkat Pengangguran)';
    dom1Reason = 'Data indikator awal (ADP 90K dan Klaim Pengangguran 197K) menunjukkan pasar tenaga kerja AS yang resilien, menjaga Dolar AS tetap perkasa.';
    mainScenario = 'Fokus mencari setup SELL ON RALLY di zona Premium PD Array / Supply sesudah pullback atau sapuan likuiditas atas (BSL).';
    confirmCondition = 'DXY bertahan di atas support 101.50 dan rilis actual NFP ≥ 90K.';
    invalidationCondition = 'Kejutan data NFP meleset jauh (<65K) dan tingkat pengangguran melonjak naik ke 4.2%+';
    conclusionGuide = 'Secara fundamental, pasar tenaga kerja AS yang masih tangguh menopang Dolar AS dan menekan Gold di zona Premium. Hindari mengejar sell di harga diskon; tunggu sapuan likuiditas atas atau konfirmasi reaksi di Dealing Range.';
    mappingBridgeText = 'Fokus mencari peluang SELL ON RALLY di zona Premium PD Array (FVG/OB Bearish) sesudah Buy-Side Liquidity (BSL) tersapu. Hindari mengejar posisi saat volatilitas rilis NFP berlangsung.';
  } else {
    usdScore = '⚖️ Konsolidasi / Campuran';
    yieldScore = '⚖️ Bergerak Terbatas';
    goldBias = '⚖️ Campuran / Menanti Katalis';
    goldBiasClass = 'mixed';
    conclusionBias = '⚖️ WAIT / NETRAL';
    horizonStr = 'Sesi Berjalan';
    dom1Title = mainEvent ? mainEvent.title : 'Dinamika Dolar AS & Suku Bunga';
    dom1Reason = eventAnalysis?.scenarioDesc || 'Pasar menanti kejelasan rilis data ekonomi untuk menentukan arah tren berikutnya.';
    mainScenario = 'Disiplin menunggu rilis data dan reaksi konfirmasi di Dealing Range.';
    confirmCondition = 'Breakout struktur Dealing Range dengan volume dan momentum terkonfirmasi.';
    invalidationCondition = 'Fakeout likuiditas dua arah (whipsaw) menjelang rilis.';
    conclusionGuide = 'Faktor penggerak fundamental berada dalam kondisi berimbang. Tunggu kejelasan arah pasar dari reaksi rilis berita atau konfirmasi struktur Price Action di Mapping.';
    mappingBridgeText = 'Pasar dalam fase konsolidasi/menanti katalis. Utamakan skenario range-bound atau tunggu sapuan likuiditas ekstrem sebelum entri.';
  }

  // Time-aware adjustment: jika jam rilis sudah terlewati tapi actual belum masuk
  if (!isReleased && isTimePassed && minutesSinceScheduled >= 5 && hasEvents && mainEvent) {
    const evTimeStr = new Date(mainEvent.date).toLocaleTimeString('en-GB', { timeZone, hour: '2-digit', minute: '2-digit' });
    horizonStr = `Pasca-Rilis (${minutesSinceScheduled}m lalu)`;
    if (goldBiasClass === 'mixed' || goldBiasClass === 'neutral' || goldBiasClass === 'insufficient') {
      conclusionBias = '⚖️ EVALUASI REAKSI PASAR';
      conclusionGuide = `Jadwal rilis ${mainEvent.title} telah berlangsung pada ${evTimeStr} WITA (${minutesSinceScheduled} menit yang lalu). Angka resmi sedang diverifikasi. Hindari mengejar pergerakan awal secara impulsif; amati struktur Dealing Range di tab Mapping untuk melihat respon likuiditas institusi.`;
      mainScenario = 'Menunggu reaksi konfirmasi Dealing Range pasca-rilis; hindari perangkap whipsaw.';
      mappingBridgeText = 'Katalis telah dirilis. Pantau apakah terjadi sapuan likuiditas (BSL/SSL) dan tunggu terbentuknya Market Structure Shift (MSS) sebelum entri.';
    }
  }

  // Dominant factor 2 (Safe Haven / Geopolitics)
  if (hasGeopolitics && !isDeescalation) {
    dom2Title = 'Tensi Geopolitik Global (Safe Haven Aktif)';
    dom2Reason = 'Konflik dan tensi regional menopang minat lindung nilai institusi, bertindak sebagai bantalan penahan penurunan emas.';
  } else if (isDeescalation) {
    dom2Title = 'Peredaan Risiko Geopolitik (De-eskalasi)';
    dom2Reason = 'Kabar gencatan senjata atau dialog damai meredakan premi risiko safe haven pada emas.';
  } else {
    dom2Title = 'Permintaan Safe Haven & Bank Sentral';
    dom2Reason = 'Pembelian fisik jangka panjang oleh bank sentral menjadi fondasi penopang struktural.';
  }

  // Status line (Bug 1 & 3)
  if (statusEl) {
    if (!hasEvents) {
      statusEl.textContent = `Pembaruan: ${timeStrWita} • Data Kalender Belum Tersedia • Mode Offline`;
    } else if (isCalendarLive) {
      statusEl.textContent = `Pembaruan: ${timeStrWita} • Kalender Tersinkron: ${usdEvents.length} Data USD • Live Engine`;
    } else if (isStaleCache) {
      statusEl.textContent = `Pembaruan: ${timeStrWita} • Kalender: ${usdEvents.length} Data USD (Cache Usang >24 Jam)`;
    } else {
      statusEl.textContent = `Pembaruan: ${timeStrWita} • Kalender: ${usdEvents.length} Data USD (Cache Lokal)`;
    }
  }

  // Bukti Pendukung vs Bertentangan
  const supportItems = [];
  const opposeItems = [];

  if (!hasEvents) {
    supportItems.push('Belum ada data kalender ekonomi yang tersinkronisasi.');
    opposeItems.push('Belum ada data fundamental pembatal yang terverifikasi.');
  } else if (eventAnalysis?.bias === 'BEARISH_PRESSURE') {
    supportItems.push(`Ekspektasi/Reaksi data AS (${escapeHtml(mainEvent?.title || 'Data Makro')}): Menopang kekuatan DXY & yield.`);
    supportItems.push('Kekuatan yield US Treasury mengurangi daya tarik emas non-yielding.');
    if (mainEvent) {
      supportItems.push(`<button class="intel-evidence-link" onclick="openEvidenceCalendar()">📅 Bukti Kalender: ${escapeHtml(mainEvent.title)} (F: ${escapeHtml(mainEvent.forecast || '—')}, P: ${escapeHtml(mainEvent.previous || '—')})</button>`);
    }
    if (hasGeopolitics && !isDeescalation) {
      opposeItems.push('Tensi geopolitik aktif memberikan bantalan safe haven penahan kejatuhan harga.');
      const topGeo = geopoliticsItems[0];
      if (topGeo) {
        opposeItems.push(`<button class="intel-evidence-link" onclick="openEvidenceNews('${escapeHtml(newsId(topGeo))}')">📰 Bukti Berita: ${escapeHtml(truncate(topGeo.text || topGeo.textOriginal, 45))} [${escapeHtml(formatTime(topGeo.time))}]</button>`);
      }
    } else {
      opposeItems.push('Akumulasi beli bank sentral dunia menjaga level harga struktural jangka panjang.');
    }
  } else if (eventAnalysis?.bias === 'BULLISH_BOUNCE') {
    supportItems.push(`Ekspektasi/Reaksi data AS (${escapeHtml(mainEvent?.title || 'Data Makro')}): Sinyal pendinginan ekonomi AS melemahkan DXY.`);
    if (mainEvent) {
      supportItems.push(`<button class="intel-evidence-link" onclick="openEvidenceCalendar()">📅 Bukti Kalender: ${escapeHtml(mainEvent.title)} (F: ${escapeHtml(mainEvent.forecast || '—')}, P: ${escapeHtml(mainEvent.previous || '—')})</button>`);
    }
    if (hasGeopolitics) {
      supportItems.push('Dukungan safe haven geopolitik memperkuat momentum kenaikan emas.');
    }
    opposeItems.push('Potensi Dolar AS menguat kembali jika rilis lanjutan melampaui ekspektasi.');
    opposeItems.push('Tingkat suku bunga The Fed saat ini masih berada di zona restriktif.');
  } else {
    supportItems.push('Faktor teknis dan arus safe haven jangka panjang mendukung harga.');
    opposeItems.push('Ekspektasi Dolar AS yang masih resilien membatasi ruang kenaikan agresif.');
    if (mainEvent) {
      supportItems.push(`<button class="intel-evidence-link" onclick="openEvidenceCalendar()">📅 Kalender Terdekat: ${escapeHtml(mainEvent.title)}</button>`);
    }
  }

  const supportListHtml = supportItems.map(item => `<li>${item}</li>`).join('');
  const opposeListHtml = opposeItems.map(item => `<li>${item}</li>`).join('');

  // Generate Event List HTML
  let eventListHtml = '';
  if (importantToday.length > 0) {
    eventListHtml = importantToday.map(ev => {
      const evDate = new Date(ev.date);
      const timeStr = Number.isFinite(evDate.getTime())
        ? evDate.toLocaleTimeString('en-GB', { timeZone, hour: '2-digit', minute: '2-digit' }) + ' WITA'
        : 'Sesi NY';
      const imp = String(ev.impact || '').toLowerCase();
      const impLabel = imp === 'high' ? 'High Impact' : 'Medium Impact';
      const impClass = imp === 'high' ? 'tag-high' : 'tag-med';
      const hasActual = Boolean(ev.actual && ev.actual !== '--' && ev.actual !== '—');

      return `
        <div class="briefing-event-item">
          <div class="event-item-top">
            <span class="event-item-time">🇺🇸 ⏰ ${escapeHtml(timeStr)}</span>
            <span class="event-item-tag ${impClass}">${impLabel}</span>
          </div>
          <div class="event-item-title">${escapeHtml(ev.title)}</div>
          <div class="event-item-numbers">
            <span>Forecast: <strong>${escapeHtml(ev.forecast || '—')}</strong></span>
            <span>Previous: <strong>${escapeHtml(ev.previous || '—')}</strong></span>
            <span>Actual: <strong class="${hasActual ? 'act-live' : ''}">${escapeHtml(ev.actual || '—')}</strong></span>
          </div>
        </div>
      `;
    }).join('');
  } else if (mainEvent) {
    const evDate = new Date(mainEvent.date);
    const timeStr = Number.isFinite(evDate.getTime())
      ? evDate.toLocaleTimeString('en-GB', { timeZone, hour: '2-digit', minute: '2-digit' }) + ' WITA'
      : 'Sesi Mendatang';
    eventListHtml = `
      <div class="briefing-event-item">
        <div class="event-item-top">
          <span class="event-item-time">🇺🇸 ⏰ ${escapeHtml(timeStr)}</span>
          <span class="event-item-tag tag-med">Event Terdekat</span>
        </div>
        <div class="event-item-title">${escapeHtml(mainEvent.title)}</div>
        <div class="event-item-numbers">
          <span>Forecast: <strong>${escapeHtml(mainEvent.forecast || '—')}</strong></span>
          <span>Previous: <strong>${escapeHtml(mainEvent.previous || '—')}</strong></span>
          <span>Actual: <strong>${escapeHtml(mainEvent.actual || '—')}</strong></span>
        </div>
      </div>
    `;
  } else {
    eventListHtml = `
      <div class="briefing-empty-events">
        ℹ️ Tidak ada rilis data tier-1 AS terjadwal malam ini. Pergerakan Gold murni dipandu oleh teknikal dan dinamika likuiditas pasar.
      </div>
    `;
  }

  // Live Context extraction dari Mapping / Amy FX
  let liveCtx = null;
  try {
    const rawCtx = localStorage.getItem('amyfx.market-context.v1');
    if (rawCtx) liveCtx = JSON.parse(rawCtx);
  } catch (_) {}

  const currentPrice = liveCtx?.price ? Number(liveCtx.price).toFixed(2) : '4185.66';
  const rangeHigh = liveCtx?.m15?.dealingRange?.rangeHigh ? Number(liveCtx.m15.dealingRange.rangeHigh).toFixed(2) : (liveCtx?.h1?.swingHigh ? Number(liveCtx.h1.swingHigh).toFixed(2) : '4196.22');
  const rangeLow = liveCtx?.m15?.dealingRange?.rangeLow ? Number(liveCtx.m15.dealingRange.rangeLow).toFixed(2) : (liveCtx?.h1?.swingLow ? Number(liveCtx.h1.swingLow).toFixed(2) : '4134.45');
  const rangeEq = liveCtx?.m15?.dealingRange?.eq ? Number(liveCtx.m15.dealingRange.eq).toFixed(2) : '4165.33';
  const priceLoc = liveCtx?.m15?.dealingRange?.location || (Number(currentPrice) >= Number(rangeEq) ? 'PREMIUM' : 'DISCOUNT');
  const bslLevel = liveCtx?.amy?.dashboard?.bsl ? Number(liveCtx.amy.dashboard.bsl).toFixed(2) : '4195.51';
  const sslLevel = liveCtx?.amy?.dashboard?.ssl ? Number(liveCtx.amy.dashboard.ssl).toFixed(2) : '4177.63';

  // Skenario reaksi dinamis untuk event utama
  let scenarioReactionHtml = '';
  if (isLaborPackage) {
    let verdictHtml = '';
    let winnerScenario = 0;

    if (isReleased) {
      if (eventAnalysis?.bias === 'BEARISH_PRESSURE') {
        winnerScenario = 1;
        verdictHtml = `
          <div class="verdict-banner-box verdict-bear">
            <div class="verdict-banner-head">🔥 HASIL RESMI RILIS NFP: DATA PANAS / SKENARIO 1 TERKONFIRMASI</div>
            <p class="verdict-banner-body">
              Data aktual tenaga kerja AS keluar solid (${escapeHtml(mainEvent.actual || nfpEvent?.actual || 'Kuat')}), memicu lonjakan DXY dan yield obligasi. <strong>Gold merespon dengan tekanan jual bearish.</strong> Instruksi Aksi: Hindari Buy impulsif, pantau retest zona Premium PD Array untuk mencari konfirmasi <em>Sell on Rally</em> menuju target Equilibrium ($${escapeHtml(rangeEq)}) hingga area diskon ($${escapeHtml(rangeLow)}).
            </p>
          </div>
        `;
      } else if (eventAnalysis?.bias === 'BULLISH_BOUNCE') {
        winnerScenario = 2;
        verdictHtml = `
          <div class="verdict-banner-box verdict-bull">
            <div class="verdict-banner-head">❄️ HASIL RESMI RILIS NFP: DATA DINGIN / SKENARIO 2 TERKONFIRMASI</div>
            <p class="verdict-banner-body">
              Data aktual tenaga kerja AS melemah di bawah proyeksi (${escapeHtml(mainEvent.actual || nfpEvent?.actual || 'Lemah')}), memperkuat ekspektasi pemangkasan suku bunga The Fed dan menekan DXY. <strong>Gold merespon dengan reli bullish impulsif.</strong> Instruksi Aksi: Pantau retest area Diskon PD Array setelah liquidity sweep untuk mencari setup <em>Buy on Dips</em> menuju target likuiditas atas ($${escapeHtml(rangeHigh)} – $4,215+).
            </p>
          </div>
        `;
      } else {
        winnerScenario = 3;
        verdictHtml = `
          <div class="verdict-banner-box verdict-neutral">
            <div class="verdict-banner-head">⚖️ HASIL RESMI RILIS NFP: SESUAI KONSENSUS / SKENARIO 3 TERKONFIRMASI</div>
            <p class="verdict-banner-body">
              Data aktual rilis berimbang (${escapeHtml(mainEvent.actual || nfpEvent?.actual || 'In-line')}) tanpa deviasi tajam dari konsensus. Terjadi volatilitas sapuan likuiditas dua arah (whipsaw). <strong>Gold berkonsolidasi di dalam Dealing Range.</strong> Instruksi Aksi: Hindari entri di tengah range ($${escapeHtml(rangeEq)}), tunggu sapuan BSL ($${escapeHtml(bslLevel)}) atau SSL ($${escapeHtml(sslLevel)}) sebelum mengeksekusi setup.
            </p>
          </div>
        `;
      }
    }

    const card1Class = winnerScenario === 1 ? 'scenario-active-winner' : (winnerScenario > 0 ? 'scenario-inactive' : '');
    const badge1 = winnerScenario === 1 ? '✅ SKENARIO AKTIF TERKONFIRMASI' : (winnerScenario > 0 ? '❌ Tidak Aktif' : 'Tekanan Jual');

    const card2Class = winnerScenario === 2 ? 'scenario-active-winner' : (winnerScenario > 0 ? 'scenario-inactive' : '');
    const badge2 = winnerScenario === 2 ? '✅ SKENARIO AKTIF TERKONFIRMASI' : (winnerScenario > 0 ? '❌ Tidak Aktif' : 'Katalis Reli');

    const card3Class = winnerScenario === 3 ? 'scenario-active-winner' : (winnerScenario > 0 ? 'scenario-inactive' : '');
    const badge3 = winnerScenario === 3 ? '✅ SKENARIO AKTIF TERKONFIRMASI' : (winnerScenario > 0 ? '❌ Tidak Aktif' : 'Netral / Range');

    scenarioReactionHtml = `
      <div class="reaction-guide-box" style="margin-top: 10px;">
        ${verdictHtml}
        <div class="reaction-title">${isReleased ? '🎯 Status Skenario Pasca-Rilis Data NFP:' : '🎯 Playbook 3 Skenario Reaksi Pasar Terhadap Data NFP (Menjelang Rilis):'}</div>
        <div class="intel-playbook-grid">
          <div class="intel-playbook-card scenario-bear ${card1Class}">
            <div class="intel-playbook-top">
              <span class="intel-playbook-title">🔴 Skenario 1 — Data Kuat (Bearish Emas / Strong USD)</span>
              <span class="intel-playbook-badge">${badge1}</span>
            </div>
            <p class="intel-playbook-body">
              <strong>Kondisi:</strong> NFP &gt; 100K &amp; Unemployment &le; 4.1%. Pasar tenaga kerja terbukti tangguh, memupus spekulasi pemangkasan agresif suku bunga The Fed. DXY melonjak naik.
            </p>
            <div class="intel-playbook-targets">
              🎯 <strong>Respon Gold:</strong> Tertekan turun menembus support lokal, menguji area Equilibrium (EQ) di kisaran <strong>$${escapeHtml(rangeEq)}</strong> hingga area diskon <strong>$${escapeHtml(rangeLow)} – $4,123</strong>.
            </div>
          </div>

          <div class="intel-playbook-card scenario-bull ${card2Class}">
            <div class="intel-playbook-top">
              <span class="intel-playbook-title">🟢 Skenario 2 — Data Meleset / Jelek (Bullish Emas / Weak USD)</span>
              <span class="intel-playbook-badge">${badge2}</span>
            </div>
            <p class="intel-playbook-body">
              <strong>Kondisi:</strong> NFP &lt; 65K &amp; Unemployment naik ke 4.2%+. Ekspektasi pelonggaran moneter The Fed kembali melonjak drastis, yield obligasi US Treasury merosot, dan DXY terjun bebas.
            </p>
            <div class="intel-playbook-targets">
              🎯 <strong>Respon Gold:</strong> Reli impulsif memicu *breakout* menembus resistance <strong>$${escapeHtml(rangeHigh)} – $4,200</strong> menuju target likuiditas baru di atas <strong>$4,213 – $4,215+</strong>.
            </div>
          </div>

          <div class="intel-playbook-card scenario-neutral ${card3Class}">
            <div class="intel-playbook-top">
              <span class="intel-playbook-title">⚖️ Skenario 3 — Sesuai Konsensus / Mixed (Whipsaw Range)</span>
              <span class="intel-playbook-badge">${badge3}</span>
            </div>
            <p class="intel-playbook-body">
              <strong>Kondisi:</strong> NFP berada di sekitar 85K – 95K dan data berimbang. Volatilitas spike dua arah (*whipsaw / sweep*) terjadi menyapu likuiditas atas dan bawah.
            </p>
            <div class="intel-playbook-targets">
              🎯 <strong>Respon Gold:</strong> Harga kembali tertahan di dalam *trading range* <strong>$${escapeHtml(rangeEq)} – $${escapeHtml(rangeHigh)}</strong> tanpa ekspansi satu arah yang tegas.
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (mainEvent && (mainEvent.forecast || mainEvent.previous)) {
    const fStr = escapeHtml(mainEvent.forecast || 'Forecast');
    const pStr = escapeHtml(mainEvent.previous || 'Previous');
    const aStr = escapeHtml(mainEvent.actual || '—');
    const isClaims = String(mainEvent.title || '').toLowerCase().includes('claims');

    let verdictHtml = '';
    if (isReleased) {
      if (eventAnalysis?.bias === 'BEARISH_PRESSURE') {
        verdictHtml = `
          <div class="verdict-banner-box verdict-bear">
            <div class="verdict-banner-head">🔴 HASIL RESMI PASCA RILIS: BEARISH PRESSURE (USD KUAT)</div>
            <p class="verdict-banner-body">
              Data aktual <strong>${escapeHtml(mainEvent.title)}</strong> rilis <strong>${aStr}</strong> (vs Proyeksi: ${fStr}). Kekuatan data AS menopang DXY dan menekan harga Gold ke zona bawah. Instruksi Aksi: Fokus mencari setup <em>Sell on Rally</em> di area Premium PD Array sesudah Buy-Side Liquidity (BSL) tersapu.
            </p>
          </div>
        `;
      } else if (eventAnalysis?.bias === 'BULLISH_BOUNCE') {
        verdictHtml = `
          <div class="verdict-banner-box verdict-bull">
            <div class="verdict-banner-head">🟢 HASIL RESMI PASCA RILIS: BULLISH BOUNCE (USD LEMAH)</div>
            <p class="verdict-banner-body">
              Data aktual <strong>${escapeHtml(mainEvent.title)}</strong> rilis <strong>${aStr}</strong> (vs Proyeksi: ${fStr}). Pelemahan data AS menekan DXY dan membuka ruang reli bagi Gold. Instruksi Aksi: Fokus mencari setup <em>Buy on Dips</em> di area Diskon PD Array sesudah Sell-Side Liquidity (SSL) tersapu.
            </p>
          </div>
        `;
      } else {
        verdictHtml = `
          <div class="verdict-banner-box verdict-neutral">
            <div class="verdict-banner-head">⚖️ HASIL RESMI PASCA RILIS: SESUAI KONSENSUS / NETRAL</div>
            <p class="verdict-banner-body">
              Data aktual <strong>${escapeHtml(mainEvent.title)}</strong> rilis <strong>${aStr}</strong> sejalan dengan konsensus pasar (${fStr}). Volatilitas mereda dan pergerakan harga cenderung berkonsolidasi di dalam Dealing Range.
            </p>
          </div>
        `;
      }
    }

    if (isClaims) {
      scenarioReactionHtml = `
        <div class="reaction-guide-box" style="margin-top: 10px;">
          ${verdictHtml}
          <div class="reaction-title">📊 ${isReleased ? 'Evaluasi Skenario Pasca-Rilis:' : 'Playbook Skenario Reaksi Gold Terhadap'} ${escapeHtml(mainEvent.title)}:</div>
          <ul class="briefing-list">
            <li style="${isReleased && eventAnalysis?.bias === 'BULLISH_BOUNCE' ? 'color:#2ecc71; font-weight:700;' : ''}"><strong>Jika Actual &gt; ${fStr} (Klaim Naik / Buruk):</strong> USD melemah ➔ Gold berpeluang memantul naik (Pullback / Reli). ${isReleased && eventAnalysis?.bias === 'BULLISH_BOUNCE' ? '<strong>[TERJADI ✅]</strong>' : ''}</li>
            <li style="${isReleased && eventAnalysis?.bias === 'BEARISH_PRESSURE' ? 'color:#ff7875; font-weight:700;' : ''}"><strong>Jika Actual &lt; ${pStr} (Klaim Turun / Bagus):</strong> USD semakin perkasa ➔ Tekanan jual ke Gold berlanjut ke bawah. ${isReleased && eventAnalysis?.bias === 'BEARISH_PRESSURE' ? '<strong>[TERJADI ✅]</strong>' : ''}</li>
          </ul>
        </div>
      `;
    } else {
      scenarioReactionHtml = `
        <div class="reaction-guide-box" style="margin-top: 10px;">
          ${verdictHtml}
          <div class="reaction-title">📊 ${isReleased ? 'Evaluasi Skenario Pasca-Rilis:' : 'Playbook Skenario Reaksi Gold Terhadap'} ${escapeHtml(mainEvent.title)}:</div>
          <ul class="briefing-list">
            <li style="${isReleased && eventAnalysis?.bias === 'BEARISH_PRESSURE' ? 'color:#ff7875; font-weight:700;' : ''}"><strong>Jika Actual &gt; ${fStr} (Data AS Panas):</strong> DXY &amp; Yield menguat ➔ Tekanan turun (*Bearish pressure*) untuk Gold. ${isReleased && eventAnalysis?.bias === 'BEARISH_PRESSURE' ? '<strong>[TERJADI ✅]</strong>' : ''}</li>
            <li style="${isReleased && eventAnalysis?.bias === 'BULLISH_BOUNCE' ? 'color:#2ecc71; font-weight:700;' : ''}"><strong>Jika Actual &lt; ${fStr} (Data AS Dingin):</strong> DXY melemah ➔ Memberi katalis dorongan naik (*Bullish boost*) untuk Gold. ${isReleased && eventAnalysis?.bias === 'BULLISH_BOUNCE' ? '<strong>[TERJADI ✅]</strong>' : ''}</li>
          </ul>
        </div>
      `;
    }
  }

  const narrativeSummary = hasEvents
    ? (isReleased
        ? `Secara fundamental pasca-rilis data <strong>${escapeHtml(mainEvent.title)}</strong> (Aktual: <strong class="act-live">${escapeHtml(mainEvent.actual)}</strong> vs Proyeksi: ${escapeHtml(mainEvent.forecast || '—')}), Gold (XAU/USD) berada dalam kondisi <strong>${escapeHtml(goldBias)}</strong>. ${eventAnalysis.scenarioDesc || ''} Fokus eksekusi saat ini beralih ke validasi zona PD Array di Dealing Range Mapping.`
        : (!isReleased && isTimePassed && minutesSinceScheduled >= 5
            ? `Jadwal rilis data <strong>${escapeHtml(mainEvent.title)}</strong> telah terlewati (${escapeHtml(new Date(mainEvent.date).toLocaleTimeString('en-GB', { timeZone, hour: '2-digit', minute: '2-digit' }))} WITA). Angka resmi sedang dalam proses verifikasi dari feed. Hindari mengejar pergerakan spike awal (whipsaw); fokus utama adalah mengamati respon likuiditas di Dealing Range chart Mapping.`
            : (isLaborPackage
                ? `Fokus pasar global malam ini tertuju penuh pada rilis data ketenagakerjaan AS (Non-Farm Payrolls, Unemployment Rate, dan Pertumbuhan Upah Rata-rata). Dengan indikator awal (ADP 90K dan Klaim Pengangguran 197K) menunjukkan pasar tenaga kerja AS yang masih resilien, Dolar AS (DXY ~101.90) bertahan kuat dan memberikan tekanan jual struktural terhadap Gold di zona Premium. Pelaku pasar disiplin menunggu konfirmasi Price Action di Dealing Range menjelang rilis data.`
                : (mainEvent && (mainEvent.forecast || mainEvent.previous)
                    ? `Secara fundamental, pergerakan XAU/USD sesi ini berada dalam fase <strong>${escapeHtml(goldBias)}</strong>. Fokus utama pasar tertuju pada rilis katalis ekonomi AS <strong>${escapeHtml(mainEvent.title)}</strong> (Forecast: ${escapeHtml(mainEvent.forecast || '—')} vs Previous: ${escapeHtml(mainEvent.previous || '—')}). Di satu sisi, ketahanan Dolar AS dan yield US Treasury membatasi agresivitas reli emas non-yielding; di sisi lain, tensi geopolitik global dan akumulasi cadangan emas bank sentral menjadi bantalan penahan penurunan yang mencegah pelemahan berlanjut tanpa batas. Pelaku pasar cenderung disiplin bersikap wait-and-see menanti kejelasan reaksi data untuk mengonfirmasi arah likuiditas berikutnya.`
                    : `Secara fundamental, pergerakan XAU/USD sesi ini berada dalam fase <strong>${escapeHtml(goldBias)}</strong>. Pasar mencermati arah kebijakan moneter The Fed serta dinamika Dolar AS. Sentimen safe haven menopang level harga struktural di tengah penguatan Dolar. Disiplin menunggu konfirmasi Price Action di Dealing Range.`))))
    : `Belum ada data kalender ekonomi AS terjadwal hari ini. Pergerakan Gold murni dipandu oleh teknikal dan dinamika likuiditas pasar tanpa tekanan katalis makro eksternal.`;

  container.innerHTML = `
    <div class="fundamental-briefing-wrap">
      <!-- 1. Executive Story & Sentimen Pasar (Card Utama Terpadu) -->
      <article class="briefing-card card-primary card-conclusion">
        <!-- Header Kartu: Pola Bersih & Vertikal seperti Sentimen Pasar Hari Ini -->
        <div class="card-head" style="margin-bottom:6px;">
          <div class="card-title-wrap">
            <h3 class="card-title">🧭 Kompas Fundamental XAU/USD</h3>
          </div>
          ${syncBadgeHtml}
        </div>

        <!-- Sub-baris: Tanggal & Horizon -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; gap:8px; flex-wrap:wrap;">
          <span style="font-size:11.5px; color:var(--text-dim); font-weight:600;">📅 ${escapeHtml(dateStrWita)}</span>
          <div class="kompas-horizon-pill">Horizon: <strong>${escapeHtml(horizonStr)}</strong></div>
        </div>

        <!-- Banner Keputusan / Bias (Full Width, Tegas & Rapi) -->
        <div style="margin-bottom:12px;">
          <div class="conclusion-badge" style="display:block; width:100%; box-sizing:border-box;">
            ${escapeHtml(conclusionBias)}
          </div>
        </div>

        <!-- Narasi Pasar Mengalir (Executive Story) -->
        <div class="editorial-narrative-box" style="margin: 0 0 14px; padding: 12px 14px; background: rgba(255,255,255,0.02); border-left: 3px solid var(--gold); border-radius: 4px;">
          <p class="conclusion-guide" style="font-size: 13px; line-height: 1.65; color: var(--text); margin: 0;">
            ${narrativeSummary}
          </p>
        </div>

        <!-- 3. Sentimen Pasar Hari Ini (Scorecard Terintegrasi) -->
        <div class="card-head" style="margin-top:14px; margin-bottom:6px;">
          <div class="card-title-wrap">
            <h3 class="card-title" style="font-size:11px; letter-spacing:0.06em; text-transform:uppercase; color:var(--text-dim);">Sentimen Pasar Hari Ini</h3>
          </div>
          <span class="bias-pill mixed">Scorecard Harian</span>
        </div>
        <div class="scorecard-grid">
          <div class="scorecard-item">
            <span class="score-label">💵 USD</span>
            <span class="score-value">${escapeHtml(usdScore)}</span>
          </div>
          <div class="scorecard-item">
            <span class="score-label">📈 Yield US Treasury</span>
            <span class="score-value">${escapeHtml(yieldScore)}</span>
          </div>
          <div class="scorecard-item">
            <span class="score-label">🌐 Risk Sentiment</span>
            <span class="score-value">${escapeHtml(riskScore)}</span>
          </div>
          <div class="scorecard-item">
            <span class="score-label">🧭 Gold Bias Fundamental</span>
            <span class="score-value">${escapeHtml(goldBias)}</span>
          </div>
        </div>
      </article>

      <!-- 2. News yang Perlu Diperhatikan (Katalis Sesi Ini) -->
      <article class="briefing-card">
        <div class="card-head">
          <div class="card-title-wrap">
            <h3 class="card-title">News yang Perlu Diperhatikan (Sesi New York &amp; London)</h3>
          </div>
          <span class="bias-pill highlight">Jadwal Kalender Terhubung</span>
        </div>
        <p class="card-desc">
          Rilis data ekonomi AS terjadwal dari kalender ekonomi yang menjadi penggerak volatilitas malam ini:
        </p>
        <div class="briefing-events-container">
          ${eventListHtml}
        </div>
        ${scenarioReactionHtml}
        <div class="card-watch-footer">
          ⚠️ <strong>Pantau Khusus:</strong> Pernyataan pejabat The Fed, pergerakan indeks DXY, dan arah yield US 10-Year.
        </div>
      </article>

      <!-- 3. Sinyal Indikator Awal (Leading Indicators) Pekan Ini -->
      <article class="briefing-card">
        <div class="card-head">
          <div class="card-title-wrap">
            <h3 class="card-title">🧭 Sinyal Indikator Awal (Leading Indicators) Pekan Ini</h3>
          </div>
          <span class="bias-pill highlight">Petunjuk Arah Makro</span>
        </div>
        <p class="card-desc">
          Data ketenagakerjaan dan aktivitas bisnis AS yang telah rilis lebih dulu sebagai petunjuk arah NFP:
        </p>
        <div class="leading-indicator-grid">
          <div class="leading-indicator-item">
            <div class="leading-indicator-header">
              <span class="leading-indicator-title">🏢 ADP Employment (Swasta)</span>
              <span class="leading-indicator-value">90K</span>
            </div>
            <div class="leading-indicator-desc">
              Mengalahkan estimasi 70K, rebound signifikan dari bulan sebelumnya. Penyerapan tenaga kerja swasta masih stabil.
            </div>
          </div>
          <div class="leading-indicator-item">
            <div class="leading-indicator-header">
              <span class="leading-indicator-title">📋 Initial Jobless Claims</span>
              <span class="leading-indicator-value">197K</span>
            </div>
            <div class="leading-indicator-desc">
              Turun di bawah 200K (ekspektasi 200K). Angka historis rendah menandakan pasar tenaga kerja AS masih solid dan minim PHK.
            </div>
          </div>
          <div class="leading-indicator-item">
            <div class="leading-indicator-header">
              <span class="leading-indicator-title">🏭 ISM Manufacturing PMI</span>
              <span class="leading-indicator-value">54.5%</span>
            </div>
            <div class="leading-indicator-desc">
              Tetap di zona ekspansi selama 9 bulan beruntun; sub-indeks ketenagakerjaan pabrikan menunjukkan pertumbuhan.
            </div>
          </div>
          <div class="leading-indicator-item">
            <div class="leading-indicator-header">
              <span class="leading-indicator-title">💵 Indeks Dolar AS (DXY)</span>
              <span class="leading-indicator-value">~101.90</span>
            </div>
            <div class="leading-indicator-desc">
              Bertahan kuat di kisaran 101.90, ditopang permintaan safe-haven dan ekspektasi suku bunga The Fed yang tetap stabil.
            </div>
          </div>
        </div>
      </article>

      <!-- 4. Kecenderungan Fundamental: USD vs Gold (XAU/USD) -->
      <article class="briefing-card">
        <div class="card-head">
          <div class="card-title-wrap">
            <h3 class="card-title">⚖️ Kecenderungan Fundamental &amp; Probabilitas Arah Pasar</h3>
          </div>
          <span class="bias-pill mixed">Komparasi Aset</span>
        </div>
        <div class="intel-dual-grid">
          <div class="intel-dual-card card-usd">
            <div class="intel-dual-head">
              <span class="intel-dual-title">💵 Dolar AS (USD / DXY)</span>
              <span class="intel-dual-status ${isReleased ? (eventAnalysis?.bias === 'BEARISH_PRESSURE' ? 'bull' : (eventAnalysis?.bias === 'BULLISH_BOUNCE' ? 'bear' : 'neutral')) : 'bull'}">${isReleased ? (eventAnalysis?.bias === 'BEARISH_PRESSURE' ? 'Menguat Pasca Rilis' : (eventAnalysis?.bias === 'BULLISH_BOUNCE' ? 'Melemah Pasca Rilis' : 'Bergerak Campuran')) : 'Cenderung Bullish'}</span>
            </div>
            <p class="intel-dual-text">
              ${isReleased ? (eventAnalysis?.bias === 'BEARISH_PRESSURE' ? `Rilis aktual data AS (${escapeHtml(mainEvent?.actual || 'Solid')}) memperkuat DXY dan yield US Treasury.` : (eventAnalysis?.bias === 'BULLISH_BOUNCE' ? `Rilis aktual data AS (${escapeHtml(mainEvent?.actual || 'Lemah')}) meleset di bawah ekspektasi, menekan DXY.` : `Rilis aktual data sejalan dengan ekspektasi, Dolar AS bergerak stabil.`)) : 'Didukung data leading yang resilien (ADP 90K &amp; Klaim 197K). The Fed diperkirakan tidak terburu-buru melonggarkan suku bunga secara agresif, menjaga imbal hasil US Treasury tetap menarik bagi modal global.'}
            </p>
          </div>
          <div class="intel-dual-card card-gold">
            <div class="intel-dual-head">
              <span class="intel-dual-title">🪙 Gold (XAU/USD)</span>
              <span class="intel-dual-status ${isReleased ? (eventAnalysis?.bias === 'BEARISH_PRESSURE' ? 'bear' : (eventAnalysis?.bias === 'BULLISH_BOUNCE' ? 'bull' : 'neutral')) : 'bear'}">${isReleased ? (eventAnalysis?.bias === 'BEARISH_PRESSURE' ? 'Tekanan Bearish' : (eventAnalysis?.bias === 'BULLISH_BOUNCE' ? 'Reli Bullish Terkonfirmasi' : 'Konsolidasi Range')) : 'Tekanan Bearish'}</span>
            </div>
            <p class="intel-dual-text">
              ${isReleased ? (eventAnalysis?.bias === 'BEARISH_PRESSURE' ? 'Kekuatan Dolar membatasi reli emas di zona Premium. Fokus disiplin mencari setup Sell on Rally di zona Premium PD Array.' : (eventAnalysis?.bias === 'BULLISH_BOUNCE' ? 'Pelemahan Dolar membuka ruang reli agresif bagi Gold. Pantau liquidity run dan cari setup Buy on Dips di zona Diskon PD Array.' : 'Harga tertahan di dalam Dealing Range. Waspadai tipuan sapuan likuiditas (whipsaw) sebelum ekspansi terarah.')) : 'Kekuatan Dolar membatasi reli emas non-yielding di zona Premium. Namun, tensi geopolitik global dan akumulasi emas fisik oleh bank-bank sentral dunia menjadi bantalan penahan penurunan yang mencegah crash tanpa henti.'}
            </p>
          </div>
        </div>
      </article>

      <!-- 5. Kesimpulan Fundamental & Panduan Eksekusi -->
      <article class="briefing-card card-execution">
        <div class="card-head">
          <div class="card-title-wrap">
            <h3 class="card-title">Kesimpulan Fundamental &amp; Rencana Aksi</h3>
          </div>
          <span class="bias-pill ${goldBiasClass}">${escapeHtml(goldBias)}</span>
        </div>
        <div class="conclusion-content">
          <div class="scenario-box">
            <div class="scenario-box-title">🧭 Skenario Fundamental Terstruktur:</div>
            <ul class="briefing-list">
              <li><strong>Skenario Utama:</strong> ${escapeHtml(mainScenario)}</li>
              <li><strong>Kondisi Penguat:</strong> ${escapeHtml(confirmCondition)}</li>
              <li><strong>Kondisi Pembatalan Bias (Invalidasi):</strong> ${escapeHtml(invalidationCondition)}</li>
            </ul>
          </div>
          <div class="scenario-box" style="border-left: 3px solid var(--gold); margin-top: 8px;">
            <div class="scenario-box-title">🎯 Jembatan Eksekusi ke Chart Mapping:</div>
            <div class="intel-ict-strip">
              <div class="intel-ict-pill">Harga: <strong>$${escapeHtml(currentPrice)}</strong></div>
              <div class="intel-ict-pill">Range High: <strong>$${escapeHtml(rangeHigh)}</strong></div>
              <div class="intel-ict-pill">Range Low: <strong>$${escapeHtml(rangeLow)}</strong></div>
              <div class="intel-ict-pill">Equilibrium: <strong>$${escapeHtml(rangeEq)}</strong></div>
              <div class="intel-ict-pill">Zona: <strong>${escapeHtml(priceLoc)}</strong></div>
              <div class="intel-ict-pill">BSL: <strong>$${escapeHtml(bslLevel)}</strong></div>
              <div class="intel-ict-pill">SSL: <strong>$${escapeHtml(sslLevel)}</strong></div>
            </div>
            <p style="font-size: 11.5px; line-height: 1.45; color: var(--text); margin: 0;">
              ${escapeHtml(mappingBridgeText)}
            </p>
          </div>

          <!-- Peringatan Khusus Judas Swing & News Lock -->
          ${isReleased ? `
          <div class="judas-swing-warning-box" style="border-left-color: #2ecc71;">
            <div class="judas-swing-head">
              <span style="color: #2ecc71;">⚡ Status Pasca Rilis: Fase Konfirmasi Price Action ICT</span>
            </div>
            <p class="judas-swing-body">
              Data aktual telah dirilis. Volatilitas spike awal (Judas Swing) kemungkinan telah menyapu likuiditas BSL ($${escapeHtml(bslLevel)}) atau SSL ($${escapeHtml(sslLevel)}). <strong>Kini fase NEWS LOCK berakhir.</strong> Fokus Anda sekarang: Amati chart Mapping pada timeframe M5/M15 untuk memvalidasi pembentukan Market Structure Shift (MSS) dan Displacment sebelum membuka posisi sesuai skenario terkonfirmasi.
            </p>
          </div>
          ` : `
          <div class="judas-swing-warning-box">
            <div class="judas-swing-head">
              <span>⚠️ Protokol Risiko: Waspada Judas Swing (Manipulasi Likuiditas)</span>
            </div>
            <p class="judas-swing-body">
              Menjelang rilis berita pukul 20:30 WITA, volatilitas biasanya melonjak tajam dengan tipuan arah awal (*Judas Swing*) yang menyapu BSL ($${escapeHtml(bslLevel)}) atau SSL ($${escapeHtml(sslLevel)}) sebelum pergerakan asli terjadi. Disiplin <strong>tahan posisi (NEWS LOCK)</strong> 15 menit sebelum hingga 15 menit sesudah rilis. Tunggu pembentukan Market Structure Shift (MSS) yang valid di chart Mapping sebelum mencari entri.
            </p>
          </div>
          `}
        </div>
      </article>

      <!-- 🧪 Lab Uji Coba: Simulasi Hasil Rilis Data -->
      <div class="lab-sim-bar" style="margin-top: 4px; padding: 12px 14px; background: rgba(212, 175, 55, 0.04); border: 1px dashed rgba(212, 175, 55, 0.35); border-radius: 8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span style="font-size:11px; font-weight:700; color:var(--gold);">🧪 Lab Uji Coba: Simulasi Hasil Rilis Data</span>
          ${simulatedOverrides ? '<span class="bias-pill highlight" style="font-size:9px;">Mode Simulasi Aktif</span>' : '<span style="font-size:10px; color:var(--text-dim);">Live Mode</span>'}
        </div>
        <p style="font-size:11.5px; color:var(--text-dim); margin-bottom:10px; line-height:1.45;">
          Uji bagaimana Kompas Fundamental dan panduan Mapping bertransformasi saat hasil rilis aktual keluar:
        </p>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" class="sim-btn" onclick="window.simulateEventRelease('cool')" style="flex:1; min-width:140px; padding:8px 10px; font-size:11px; font-weight:700; background:rgba(46,204,113,0.12); border:1px solid rgba(46,204,113,0.4); color:#2ecc71; border-radius:6px; cursor:pointer;">
            🟢 Uji Data Dingin (Bullish Gold)
          </button>
          <button type="button" class="sim-btn" onclick="window.simulateEventRelease('hot')" style="flex:1; min-width:140px; padding:8px 10px; font-size:11px; font-weight:700; background:rgba(231,76,60,0.12); border:1px solid rgba(231,76,60,0.4); color:#ff7875; border-radius:6px; cursor:pointer;">
            🔴 Uji Data Panas (Bearish Gold)
          </button>
          ${simulatedOverrides ? `
          <button type="button" class="sim-btn" onclick="window.simulateEventRelease('reset')" style="padding:8px 14px; font-size:11px; font-weight:700; background:rgba(255,255,255,0.06); border:1px solid var(--border); color:var(--text); border-radius:6px; cursor:pointer;">
            🔄 Kembalikan ke Live
          </button>` : ''}
        </div>
      </div>

      <!-- Detail Pendukung (USD & Safe Haven Breakdown - Collapsible Drawer) -->
      <details class="briefing-card briefing-accordion" style="cursor: pointer;">
        <summary style="font-size: 12px; font-weight: 700; color: var(--gold); outline: none; list-style: none; display: flex; justify-content: space-between; align-items: center; padding: 2px 0;">
          <span>🔍 Rincian Faktor &amp; Bukti Makro (USD &amp; Safe Haven)</span>
          <span class="accordion-arrow">▾</span>
        </summary>
        <div style="margin-top: 14px; border-top: 1px solid var(--border); padding-top: 12px; cursor: default;">
          <!-- Faktor Utama: USD & The Fed -->
          <div style="margin-bottom: 16px;">
            <div class="card-head" style="margin-bottom:6px;">
              <h4 class="card-title" style="font-size: 12px;">Faktor Utama: USD &amp; The Fed</h4>
              <span class="bias-pill ${goldBiasClass}">${escapeHtml(goldBias)}</span>
            </div>
            <p class="card-desc" style="font-size: 12px; color: var(--text-dim); margin-bottom: 8px;">
              ${hasEvents
                ? (mainEvent && (mainEvent.forecast || mainEvent.previous)
                    ? `Pasar saat ini mencermati katalis <strong>${escapeHtml(mainEvent.title)}</strong> (Forecast: ${escapeHtml(mainEvent.forecast || '—')} vs Previous: ${escapeHtml(mainEvent.previous || '—')}). Kekuatan Dolar AS dan yield obligasi menjadi penentu utama minat beli emas non-yielding.`
                    : 'Saat ini emas berada dalam pantauan kebijakan moneter AS dan arah pergerakan indeks Dolar AS.')
                : 'Belum ada data kalender ekonomi AS terjadwal. Pergerakan Dolar dan emas bergerak dalam koridor teknikal murni.'}
            </p>
            <div class="dominant-factors-box">
              <div class="dominant-factors-title">🏆 3 Faktor Paling Dominan Penggerak Emas:</div>
              <div class="dominant-factor-item">
                <span class="dominant-factor-rank">#1</span>
                <div class="dominant-factor-text"><strong>${escapeHtml(dom1Title)}:</strong> ${escapeHtml(dom1Reason)}</div>
              </div>
              <div class="dominant-factor-item">
                <span class="dominant-factor-rank">#2</span>
                <div class="dominant-factor-text"><strong>${escapeHtml(dom2Title)}:</strong> ${escapeHtml(dom2Reason)}</div>
              </div>
              <div class="dominant-factor-item">
                <span class="dominant-factor-rank">#3</span>
                <div class="dominant-factor-text"><strong>${escapeHtml(dom3Title)}:</strong> ${escapeHtml(dom3Reason)}</div>
              </div>
            </div>
          </div>

          <!-- Faktor Safe Haven (Penahan Penurunan) -->
          <div>
            <div class="card-head" style="margin-bottom:6px;">
              <h4 class="card-title" style="font-size: 12px;">Faktor Safe Haven (Penahan Penurunan)</h4>
              <span class="bias-pill neutral">Bantalan Dukungan</span>
            </div>
            <p class="card-desc" style="font-size: 12px; color: var(--text-dim); margin-bottom: 8px;">
              Meskipun tertekan oleh Dolar, emas tetap memiliki bantalan penahan penurunan yang mencegah kejatuhan harga tanpa henti:
            </p>
            <ul class="briefing-list" style="font-size: 11.5px; margin-bottom: 10px;">
              <li><strong>Ketidakpastian Geopolitik:</strong> ${hasGeopolitics ? 'Tensi geopolitik global aktif menjaga minat lindung nilai institusi.' : 'Konflik global dan dinamika regional menahan penurunan drastis emas.'}</li>
              <li><strong>Risiko Inflasi Energi:</strong> ${hasEnergyRisk ? 'Harga energi dan komoditas minyak mentah memicu kekhawatiran inflasi jangka menengah.' : 'Potensi lonjakan biaya energi sewaktu-waktu dapat memantik inflasi kembali.'}</li>
              <li><strong>Permintaan Aset Aman:</strong> Pembelian emas fisik oleh bank-bank sentral dunia tetap menjadi fondasi jangka panjang.</li>
            </ul>
            <div class="kompas-evidence-cols">
              <div class="kompas-evidence-col col-support">
                <div class="evidence-col-title">✅ Bukti Pendukung Bias</div>
                <ul class="evidence-list">
                  ${supportListHtml}
                </ul>
              </div>
              <div class="kompas-evidence-col col-oppose">
                <div class="evidence-col-title">⚠️ Bukti Bertentangan / Risiko</div>
                <ul class="evidence-list">
                  ${opposeListHtml}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </details>
    </div>
  `;
}

function setupNewsInteractions() {
  document.getElementById('news-list')?.addEventListener('click', event => {
    const item = event.target.closest('.news-item');
    if (!item) return;
    item.classList.toggle('expanded');
    item.classList.remove('news-focus');
  });
  document.getElementById('news-list')?.addEventListener('keydown', event => {
    if (event.target.closest('a')) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const item = event.target.closest('.news-item');
    if (!item) return;
    event.preventDefault();
    item.classList.toggle('expanded');
    item.classList.remove('news-focus');
  });
}

function focusNewsItem(id) {
  if (!id) return false;
  const item = [...document.querySelectorAll('.news-item')].find(el => el.dataset.newsId === String(id));
  if (!item) return false;
  item.classList.add('expanded', 'news-focus');
  item.scrollIntoView({ behavior: 'smooth', block: 'center' });
  pendingNewsId = '';
  newsRouteRetries = 0;
  return true;
}

// ─── Client Translation Cache & Engine ───────────────────
const TRANSLATION_CACHE_KEY = 'amy_news_tr_cache_v1';

function getTranslationCache() {
  try {
    return JSON.parse(localStorage.getItem(TRANSLATION_CACHE_KEY) || '{}');
  } catch (_) {
    return {};
  }
}

function saveTranslationToCache(id, translatedText) {
  if (!id || !translatedText) return;
  // Bug 10: Never save truncated translations to permanent cache
  if (translatedText.endsWith('…') || translatedText.endsWith('...')) return;
  try {
    const cache = getTranslationCache();
    cache[String(id)] = translatedText;
    const keys = Object.keys(cache);
    if (keys.length > 300) {
      keys.slice(0, keys.length - 200).forEach(k => delete cache[k]);
    }
    localStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(cache));
  } catch (_) {}
}

function isTextEnglish(text) {
  if (!text || typeof text !== 'string') return false;
  return /\b(the|and|to|of|in|for|with|on|at|by|from|about|against|between|into|through|after|before|above|below|is|was|are|were|been|has|had|have|will|would|could|should|says|said|told|warns|warned|urged|declares|report|reported|sources?)\b/i.test(text);
}

function needsClientTranslation(item) {
  if (!item) return false;
  const original = String(item.textOriginal || '').trim();
  const text = String(item.text || '').trim();
  if (!text) return true;
  if (text.includes('Terjemahan Bahasa Indonesia belum tersedia')) return true;
  if (original && text === original) return true;
  return isTextEnglish(text);
}

function splitIntoTranslationChunks(text, maxLen = 450) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    let splitIdx = remaining.lastIndexOf('. ', maxLen);
    if (splitIdx === -1 || splitIdx < maxLen / 2) {
      splitIdx = remaining.lastIndexOf(' ', maxLen);
    }
    if (splitIdx === -1) {
      splitIdx = maxLen;
    } else {
      splitIdx += 1;
    }
    chunks.push(remaining.slice(0, splitIdx).trim());
    remaining = remaining.slice(splitIdx).trim();
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

async function translateTextClient(text) {
  const cleanText = String(text || '').trim();
  if (!cleanText) return null;

  // Method 1: Google Translate web endpoint (works directly from user mobile/residential IP)
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=id&dt=t&q=${encodeURIComponent(cleanText)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.[0])) {
        const translated = data[0].map(chunk => chunk?.[0] || '').join('').trim();
        if (translated && (translated !== cleanText || data[2] === 'id')) {
          return translated;
        }
      }
    }
  } catch (_) {}

  // Method 2: MyMemory Translation API fallback with sentence chunking (Bug 10: no truncation)
  try {
    const chunks = splitIntoTranslationChunks(cleanText, 450);
    const translatedChunks = [];
    let allSucceeded = true;

    for (const chunk of chunks) {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=en|id`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        const tr = data?.responseData?.translatedText?.trim();
        if (tr && !tr.toUpperCase().includes('MYMEMORY WARNING') && tr !== chunk) {
          translatedChunks.push(tr);
          continue;
        }
      }
      allSucceeded = false;
      break;
    }

    if (allSucceeded && translatedChunks.length === chunks.length) {
      return translatedChunks.join(' ');
    }
  } catch (_) {}

  return null;
}

function applyCachedTranslations(newsList) {
  const cache = getTranslationCache();
  for (const item of newsList) {
    const id = newsId(item);
    if (cache[id]) {
      item.text = cache[id];
    }
  }
}

async function autoTranslateNewsItems(sortedNews, sequence = 0) {
  const pending = sortedNews.filter(item => needsClientTranslation(item));
  if (!pending.length) return;

  for (let i = 0; i < pending.length; i += 2) {
    // Bug 9: Stale translation sequence guard
    if (sequence && sequence !== newsFetchSequence) return;
    const batch = pending.slice(i, i + 2);
    await Promise.allSettled(batch.map(async item => {
      const id = newsId(item);
      const sourceText = item.textOriginal || item.text;
      const translated = await translateTextClient(sourceText);
      if (translated) {
        item.text = translated;
        saveTranslationToCache(id, translated);
        const card = [...document.querySelectorAll('.news-item')].find(el => el.dataset.newsId === String(id));
        if (card) {
          const textEl = card.querySelector('.news-text');
          if (textEl) textEl.textContent = translated;
        }
      }
    }));
  }
}

// ─── News Loader ─────────────────────────────────────────
async function loadNews(silent = false) {
  const currentSequence = ++newsFetchSequence;
  const status = document.getElementById('news-status');
  const list = document.getElementById('news-list');
  if (!silent && (!list || !list.children.length)) status.textContent = 'Memuat berita...';

  // Preserve expanded news card state and scroll position across refresh
  const currentExpandedIds = new Set(
    [...document.querySelectorAll('.news-item.expanded')].map(el => el.dataset.newsId).filter(Boolean)
  );
  const prevScrollTop = (currentTab === 'news') ? (window.scrollY || document.documentElement.scrollTop) : 0;

  // Instant render from local cache if DOM is currently empty
  if (list && !list.children.length) {
    try {
      const cachedRaw = localStorage.getItem('amyfx.assistant.news.v1');
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (cached && Array.isArray(cached.items) && cached.items.length > 0) {
          renderNews(cached.items, currentExpandedIds);
          if (status) status.textContent = `${cached.items.length} berita (tersimpan) • Sinkronisasi latar belakang…`;
        }
      }
    } catch (_) {}
  }

  try {
    const minuteKey = Math.floor(Date.now() / 60000);
    // Bug 7: Increase limit to 50 when deep link pendingNewsId is present
    const fetchLimit = pendingNewsId ? 50 : 20;
    const res = await fetch(`${API_BASE}/news?limit=${fetchLimit}&fresh=${minuteKey}`, {
      signal: beginRequest('news'),
      cache: 'no-store'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    if (currentSequence !== newsFetchSequence) return;

    if (!data.news || data.news.length === 0) {
      if (list && list.children.length > 0) {
        status.textContent = 'Tidak ada update berita baru';
      } else {
        status.textContent = 'Tidak ada berita gold saat ini';
        list.innerHTML = '<div class="empty-state">Belum ada breaking news untuk XAU/USD.</div>';
      }
      return;
    }

    const sortedNews = data.news.map(prepareNewsItem).sort((a, b) => {
      const byId = Number(b.id || 0) - Number(a.id || 0);
      return byId || new Date(b.time || 0) - new Date(a.time || 0);
    });

    applyCachedTranslations(sortedNews);

    const relevantNews = sortedNews.filter(isNewsRelevantForGold);
    const latestRelevant = relevantNews[0];
    const latestNews = sortedNews[0];

    if (latestNews) {
      const currentNewsId = newsId(latestNews);
      const lastNewsId = localStorage.getItem('amy_last_news_id');
      const lastNotifiedId = localStorage.getItem('amy_last_notified_news_id') || lastNewsId;

      const notifyNews = async (item) => {
        const targetId = newsId(item);
        if (needsClientTranslation(item)) {
          const sourceText = item.textOriginal || item.text;
          const tr = await translateTextClient(sourceText);
          if (tr) {
            item.text = tr;
            saveTranslationToCache(targetId, tr);
          }
        }
        const impact = String(item.impact || '').toLowerCase();
        const title = impact === 'high' ? '🚨 Breaking News Penting XAU/USD' : '📰 Breaking News XAU/USD';
        const msg = item.text || item.textOriginal || 'Berita baru telah tiba.';
        if (window.Android?.showNotificationWithUrl) {
          window.Android.showNotificationWithUrl(title, msg, newsTargetUrl(targetId));
        } else if (typeof Notification !== 'undefined') {
          Notification.requestPermission().then(p => {
            if (p !== 'granted') return;
            const notification = new Notification(title, { body: msg, tag: `amy-news-${targetId}` });
            notification.onclick = () => {
              window.focus();
              location.hash = `news=${encodeURIComponent(targetId)}`;
            };
          });
        }
        localStorage.setItem('amy_last_notified_news_id', targetId);
      };

      // Bug 8: Only trigger notification if news is relevant to Gold
      if (lastNewsId && lastNewsId !== currentNewsId && isNewsRelevantForGold(latestNews)) {
        await notifyNews(latestNews);
      } else if (lastNewsId && latestRelevant && newsId(latestRelevant) !== lastNotifiedId && Number(latestRelevant.id || 0) > Number(lastNotifiedId || 0)) {
        await notifyNews(latestRelevant);
      }
      localStorage.setItem('amy_last_news_id', currentNewsId);
    }

    status.textContent = `${data.news.length} berita relevan • ${formatTime(data.updated)}`;
    panelLoadedAt.news = Date.now();
    window.AmyFXIntel?.write('news', { updated: data.updated, capturedAt: data.updated, source: 'VERCEL_NEWS', items: sortedNews.slice(0, 10) });

    if (currentSequence === newsFetchSequence) {
      try { localStorage.setItem('amyfx.assistant.news.v1', JSON.stringify({ updated: data.updated, items: sortedNews.slice(0, 20) })); } catch {}
      renderNews(sortedNews, currentExpandedIds);
      if (calendarEvents.length === 0) {
        loadCalendar(true);
      }
      if (currentTab === 'news' && prevScrollTop > 0) {
        window.scrollTo({ top: prevScrollTop, behavior: 'instant' });
      }
      autoTranslateNewsItems(sortedNews, currentSequence).then(() => {
        if (currentSequence === newsFetchSequence) {
          try { localStorage.setItem('amyfx.assistant.news.v1', JSON.stringify({ updated: data.updated, items: sortedNews.slice(0, 20) })); } catch {}
        }
      });
    }

    if (pendingNewsId) {
      activateTab('news');
      if (!focusNewsItem(pendingNewsId)) {
        newsRouteRetries += 1;
        if (newsRouteRetries <= 3) {
          status.textContent = 'Berita dari notifikasi sedang disinkronkan...';
          setTimeout(() => loadNews(true), 1500);
        } else {
          status.textContent = 'Berita tujuan belum tersedia pada feed terbaru';
          pendingNewsId = '';
          newsRouteRetries = 0;
        }
      }
    }
  } catch (e) {
    if (e.name === 'AbortError') return;
    // Bug 5: Preserve cached news DOM on failed request
    if (list && list.children.length > 0) {
      status.textContent = 'Gagal sinkronisasi feed baru • Menampilkan berita tersimpan';
    } else {
      status.textContent = 'Gagal memuat berita';
      list.innerHTML = '<div class="empty-state">Gagal terhubung. Coba lagi nanti.</div>';
    }
  }
}

function renderNews(sortedNews, expandedIds = new Set()) {
  const list = document.getElementById('news-list');
  if (!list) return;
  list.innerHTML = sortedNews.map((item, i) => {
    const id = newsId(item);
    const isExpanded = expandedIds.has(String(id));
    return `
      <article class="news-item ${isExpanded ? 'expanded' : ''}" data-news-id="${escapeHtml(id)}" style="animation-delay:${i * 0.05}s" tabindex="0">
        <div class="news-time">${formatTime(item.time)}</div>
        <div class="news-text">${escapeHtml(item.text)}</div>
      </article>
    `;
  }).join('');
}

// ─── Heatmap Loader ──────────────────────────────────────
async function loadHeatmap(silent = false) {
  if (window.AmyICTIntel) return window.AmyICTIntel.refresh();
  const status = document.getElementById('heatmap-status');
  if (!silent) status.textContent = 'Menghitung heatmap...';

  try {
    const res = await fetch(`${API_BASE}/heatmap?interval=15min&outputsize=200`, { signal: beginRequest('heatmap') });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    if (!data.zones || data.zones.length === 0) {
      status.textContent = 'Data belum cukup untuk heatmap';
      clearHeatmapState();
      return;
    }
    if (!payloadIsFresh(data.updated)) throw new Error('Heatmap yang diterima sudah usang');

    document.getElementById('heatmap-price').textContent =
      `XAU/USD ${data.currentPrice?.toFixed(2) || '--'}`;
    status.textContent = `${data.zones.length} zona likuiditas • ${formatTime(data.updated)}`;
    panelLoadedAt.heatmap = Date.now();
    window.AmyFXIntel?.write('heatmap', { updated: data.updated, capturedAt: data.updated, source: 'SUPABASE_EDGE', currentPrice: data.currentPrice, zones: data.zones });
    renderHeatmap(data.zones, data.currentPrice);
  } catch (e) {
    if (e.name === 'AbortError') return;
    clearHeatmapState();
    status.textContent = 'Gagal memuat heatmap';
  }
}

function renderHeatmap(zones, currentPrice) {
  const canvas = document.getElementById('heatmap-canvas');
  if (!zones.length) return;

  const sortedZones = [...zones].sort((a,b) => b.price - a.price);
  const maxActivity = Math.max(...sortedZones.map(z => z.totalActivity), 1);

  canvas.style.display = 'flex';
  canvas.style.flexDirection = 'column';
  canvas.style.gap = '0';
  canvas.style.padding = '8px 0';
  canvas.style.overflowY = 'auto';

  function genBlocks(count, max, isResist) {
    if(!count || count === 0) return '';
    const maxBlocks = 20;
    const blocks = Math.ceil((count / max) * maxBlocks);
    const typeClass = isResist ? 'block-resist' : 'block-support';
    return Array(blocks).fill(`<div class="heat-block ${typeClass}"></div>`).join('');
  }

  canvas.innerHTML = sortedZones.map(z => {
    const isCurrent = z.isCurrent;
    return `
      <div class="ladder-row ${isCurrent ? 'ladder-now' : ''}">
        <div class="ladder-price-col">
          <span class="ladder-price">${z.price}</span>
          ${isCurrent ? '<span class="ladder-now-indicator">◀</span>' : ''}
        </div>
        <div class="ladder-blocks-col">
          <div class="ladder-blocks">
            ${genBlocks(z.resistCount, maxActivity, true)}
            ${genBlocks(z.supportCount, maxActivity, false)}
          </div>
        </div>
        <div class="ladder-meta-col">
          ${z.label ? `<span class="ladder-label">${z.label}</span>` : ''}
          <span class="ladder-vol">${z.totalActivity}</span>
        </div>
      </div>
    `;
  }).join('');

  hideLoading();
}

// ─── Liquidity Loader ────────────────────────────────────
async function loadLiquidity(silent = false) {
  if (window.AmyICTIntel) return window.AmyICTIntel.refresh();
  const status = document.getElementById('liquidity-status');
  const list = document.getElementById('liquidity-list');
  if (!status || !list) return;
  if (!silent) status.textContent = 'Melacak likuiditas...';

  try {
    const res = await fetch(`${API_BASE}/liquidity?interval=15min&outputsize=200`, { signal: beginRequest('liquidity') });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    if (!data.levels || data.levels.length === 0) {
      status.textContent = 'Belum ada level likuiditas terdeteksi';
      list.innerHTML = '<div class="empty-state">Belum ada swing level aktif.<br><small>Data dari TwelveData M15</small></div>';
      return;
    }

    const priceStr = data.currentPrice ? data.currentPrice.toFixed(2) : '--';
    status.textContent = `${data.levels.length} level aktif • XAU/USD ${priceStr} • ${formatTime(data.updated)}`;
    panelLoadedAt.liquidity = Date.now();
    if (!payloadIsFresh(data.updated)) throw new Error('Liquidity yang diterima sudah usang');
    window.AmyFXIntel?.write('liquidity', { updated: data.updated, capturedAt: data.updated, source: 'SUPABASE_EDGE', currentPrice: data.currentPrice, levels: data.levels });
    renderLiquidity(data.levels, data.currentPrice);
  } catch (e) {
    if (e.name === 'AbortError') return;
    status.textContent = 'Gagal memuat likuiditas';
    list.innerHTML = '<div class="empty-state">Gagal terhubung. Coba lagi nanti.</div>';
  }
}

function renderLiquidity(levels, currentPrice) {
  const list = document.getElementById('liquidity-list');
  const bslLevels = levels.filter(lv => lv.type === 'BSL').sort((a,b) => b.price - a.price);
  const sslLevels = levels.filter(lv => lv.type === 'SSL').sort((a,b) => b.price - a.price);
  const priceStr = currentPrice ? currentPrice.toFixed(2) : '--';
  const maxDistance = Math.max(...levels.map(lv => Math.abs(Number(lv.distance) || 0)), 1);
  const nearest = [...levels].sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance))[0];

  function renderNodes(arr, isBSL) {
    return arr.map((lv, i) => {
      const distAbs = Math.abs(lv.distance).toFixed(1);
      const timeText = lv.candlesAgo < 4 ? 'Baru' : `${lv.candlesAgo}`;
      const typeClass = isBSL ? 'bsl' : 'ssl';
      const proximity = 1 - Math.min(Math.abs(Number(lv.distance) || 0) / maxDistance, 1);
      const freshness = 1 - Math.min(Number(lv.candlesAgo || 0) / 200, 1);
      const strength = Math.max(0.16, proximity * 0.72 + freshness * 0.28);
      const isNearest = nearest && nearest.type === lv.type && Number(nearest.price) === Number(lv.price);
      
      return `
        <div class="liq-node-wrapper" style="--distance:${Math.abs(Number(lv.distance) || 0)};--strength:${strength.toFixed(2)};--node-scale:${(0.94 + strength * 0.06).toFixed(3)};animation-delay:${i * 0.05}s">
          <div class="node-card ${typeClass} ${isNearest ? 'nearest-draw' : ''}">
            <div class="node-head">
              <span class="node-badge">${lv.type}</span>
              <span class="node-active" title="Aktif"></span>
            </div>
            ${isNearest ? '<div class="nearest-label">NEAREST DRAW</div>' : ''}
            <div class="node-price">${lv.price.toFixed(2)}</div>
            <div class="node-stats">
              <span class="node-stat">⟷ ${distAbs}p</span>
              <span class="node-stat">⏱ ${timeText}c</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  list.innerHTML = `
    <div class="liq-network">
      <div class="liq-branch">
        ${renderNodes(bslLevels, true)}
      </div>

      <div class="liq-center">
        <span>XAU/USD</span>
        <strong>${priceStr}</strong>
      </div>

      <div class="liq-branch">
        ${renderNodes(sslLevels, false)}
      </div>
    </div>
    
    <div class="liq-legend">
      <div class="leg-item"><span class="leg-dot bsl-dot"></span> BSL (Buy Stop)</div>
      <div class="leg-item"><span class="leg-dot ssl-dot"></span> SSL (Sell Stop)</div>
      <div class="leg-item">⟷ Pips Jarak</div>
      <div class="leg-item">⏱ Usia Candle</div>
      <div class="leg-item"><span class="node-active leg-active"></span> Aktif</div>
    </div>
  `;
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
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar' }) + ' WITA';
  } catch { return iso; }
}

function truncate(text, max) {
  return text.length > max ? text.slice(0, max) + '...' : text;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
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

// ─── Economic Calendar Engine ─────────────────────────────
const CALENDAR_ENDPOINTS = [
  ...(typeof location !== 'undefined' && location.origin && !location.origin.startsWith('file:') ? [`${location.origin}/api/calendar`] : []),
  'https://amy-fx.vercel.app/api/calendar',
  'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
  'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://nfs.faireconomy.media/ff_calendar_thisweek.json'),
  'https://wliecyxzlwhmtftnfnps.supabase.co/functions/v1/economic-calendar'
];
const CALENDAR_CACHE_KEY = 'amy_economic_calendar_v1';
let calendarEvents = [];
let currentCalendarFilter = 'gold';

const COUNTRY_FLAGS = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵',
  CAD: '🇨🇦', AUD: '🇦🇺', NZD: '🇳🇿', CHF: '🇨🇭', CNY: '🇨🇳'
};

function setupCalendarFilters() {
  document.querySelectorAll('.cal-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cal-filter').forEach(b => b.classList.toggle('active', b === btn));
      currentCalendarFilter = btn.dataset.filter || 'gold';
      renderCalendar();
    });
  });
}

function getCachedCalendar() {
  try {
    const raw = localStorage.getItem(CALENDAR_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function saveCalendarToCache(events) {
  try {
    if (Array.isArray(events) && events.length > 0) {
      localStorage.setItem(CALENDAR_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), events }));
    }
  } catch (_) {}
}

function extractCalendarEventsFromNews() {
  const events = [];
  try {
    let newsItems = [];
    const cachedRaw = localStorage.getItem('amyfx.assistant.news.v1');
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw);
      if (Array.isArray(parsed?.items)) newsItems = parsed.items;
    }
    const regex = /([A-Z]{3})\s*\|\s*([^\n\r]+)[\s\S]*?(?:Waktu|Time)\s*:\s*([^\n\r]+)[\s\S]*?(?:Efek|Effects?)\s*:\s*([^\n\r]+)[\s\S]*?(?:Sebelumnya|Previously)\s*:\s*([^\n\r]+)[\s\S]*?(?:Perkiraan|Forecast)\s*:\s*([^\n\r_]+)/gi;
    const seen = new Set();
    for (const item of newsItems) {
      const text = `${item.text || ''}\n${item.textOriginal || ''}`;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const rawTitle = match[2].trim();
        const country = match[1].trim();
        const normKey = `${country}_${rawTitle.toLowerCase()}`;
        if (seen.has(normKey)) continue;
        seen.add(normKey);

        const rawTime = match[3].trim();
        const impactRaw = match[4].toLowerCase();
        const previous = match[5].trim();
        const forecast = match[6].trim();

        const baseDate = item.time ? new Date(item.time) : new Date();
        const ymd = !isNaN(baseDate.getTime()) ? baseDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        const dateStr = `${ymd}T${rawTime.length === 5 ? rawTime + ':00' : '12:00:00'}Z`;

        events.push({
          title: rawTitle,
          country,
          date: dateStr,
          impact: impactRaw.includes('tinggi') || impactRaw.includes('high') ? 'High' : 'Medium',
          forecast,
          previous,
          actual: '',
          source: 'telegram_news_feed'
        });
      }
    }
  } catch (_) {}
  return events;
}

async function loadCalendar(silent = false) {
  const status = document.getElementById('calendar-status');
  if (!status) return;
  if (!silent && calendarEvents.length === 0) status.textContent = 'Memuat jadwal kalender ekonomi...';

  const cached = getCachedCalendar();
  if (cached?.events?.length > 0 && calendarEvents.length === 0) {
    calendarEvents = cached.events;
    renderCalendar();
  }

  try {
    let data = null;

    // Bug 6: Per-endpoint 4s timeout prevents indefinite client hanging
    for (const url of CALENDAR_ENDPOINTS) {
      try {
        const controller = new AbortController();
        const timeoutTimer = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutTimer);
        if (res.ok) {
          const json = await res.json();
          const items = Array.isArray(json) ? json : (Array.isArray(json?.events) ? json.events : []);
          if (items.length > 0) {
            data = items;
            isCalendarLive = true;
            break;
          }
        }
      } catch (fetchErr) {
        // Continue to fallback endpoint on error or timeout
      }
    }

    // Smart fallback: extract macro events from live news feed if endpoints fail
    if (!data || data.length === 0) {
      const extractedNewsEvents = extractCalendarEventsFromNews();
      if (extractedNewsEvents.length > 0) {
        data = extractedNewsEvents;
        isCalendarLive = true;
      }
    }

    if (Array.isArray(data) && data.length > 0) {
      calendarEvents = data;
      saveCalendarToCache(data);
      panelLoadedAt.calendar = Date.now();
      renderCalendar();
      loadSentiment(true);
    } else if (calendarEvents.length === 0 && cached?.events?.length > 0) {
      calendarEvents = cached.events;
      isCalendarLive = false;
      renderCalendar();
      loadSentiment(true);
    } else if (calendarEvents.length === 0) {
      // Bug 6: Render retry state when all endpoints fail and cache is empty
      if (status) status.textContent = 'Gagal memuat kalender. Periksa koneksi.';
      const list = document.getElementById('calendar-list');
      if (list && list.children.length === 0) {
        list.innerHTML = `
          <div class="empty-state">
            Gagal memuat jadwal kalender ekonomi.<br>
            <button class="cal-retry-btn" onclick="loadCalendar()">🔄 Coba Lagi</button>
          </div>
        `;
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') return;
    if (status && calendarEvents.length === 0) status.textContent = 'Gagal memuat kalender. Coba lagi nanti.';
  } finally {
    hideLoading();
  }
}

function computeEventCountdown(eventTimeMs) {
  const diffMinutes = Math.round((eventTimeMs - Date.now()) / 60000);
  if (diffMinutes >= -15 && diffMinutes <= 15) {
    return { text: '🔴 Sedang Rilis / Volatilitas Tinggi', className: 'imminent' };
  }
  if (diffMinutes > 15 && diffMinutes <= 60) {
    return { text: `⏳ Rilis ${diffMinutes}m lagi`, className: 'soon' };
  }
  if (diffMinutes > 60 && diffMinutes <= 24 * 60) {
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    return { text: `⏳ Rilis ${hours}j ${mins}m lagi`, className: 'soon' };
  }
  if (diffMinutes < -15) {
    return { text: '✓ Selesai', className: 'done' };
  }
  return { text: '⏳ Terjadwal', className: 'future' };
}

function renderCalendar() {
  const list = document.getElementById('calendar-list');
  const status = document.getElementById('calendar-status');
  if (!list) return;

  if (!calendarEvents || calendarEvents.length === 0) {
    list.innerHTML = '<div class="empty-state">Tidak ada jadwal kalender ekonomi tersedia saat ini.</div>';
    if (status) status.textContent = 'Data kalender belum tersedia.';
    return;
  }

  // Filter events
  const filtered = calendarEvents.filter(item => {
    const impact = String(item.impact || '').toLowerCase();
    const country = String(item.country || '').toUpperCase();
    const isGoldDriver = country === 'USD' && (impact === 'high' || impact === 'medium');

    if (currentCalendarFilter === 'gold') return isGoldDriver;
    if (currentCalendarFilter === 'high') return impact === 'high';
    if (currentCalendarFilter === 'medium') return impact === 'medium';
    if (currentCalendarFilter === 'usd') return country === 'USD';
    return true; // 'all'
  });

  // Bug 3: Accurate sync and cache indicators
  const cached = getCachedCalendar();
  const cacheAgeMs = cached?.savedAt ? Date.now() - cached.savedAt : 0;
  const isStale = cacheAgeMs > 24 * 60 * 60 * 1000;

  if (status) {
    if (isCalendarLive) {
      status.textContent = `${filtered.length} rilis ekonomi • 🟢 Sinkronisasi Live (WITA)`;
    } else if (isStale) {
      status.textContent = `${filtered.length} rilis ekonomi • 🟠 Cache Usang (>24 Jam)`;
    } else {
      status.textContent = `${filtered.length} rilis ekonomi • 🟡 Cache Lokal (Tersimpan)`;
    }
  }

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state">Tidak ada rilis berita untuk filter yang dipilih.</div>';
    return;
  }

  // Group events by local date string
  const groups = new Map();
  for (const item of filtered) {
    const d = new Date(item.date);
    const dateKey = Number.isFinite(d.getTime())
      ? d.toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
      : 'Tanggal Tidak Diketahui';

    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey).push(item);
  }

  const html = [];
  groups.forEach((items, dateLabel) => {
    html.push(`<div class="calendar-group">`);
    html.push(`<div class="calendar-date-header"><span>📅 ${escapeHtml(dateLabel)}</span><small>${items.length} rilis</small></div>`);

    items.forEach(ev => {
      const d = new Date(ev.date);
      const timeMs = d.getTime();
      const timeStr = Number.isFinite(timeMs)
        ? d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' }) + ' WITA'
        : '—';
      const countdown = Number.isFinite(timeMs) ? computeEventCountdown(timeMs) : { text: '', className: '' };
      const impact = String(ev.impact || '').toLowerCase();
      const flag = COUNTRY_FLAGS[ev.country] || '🌐';
      const isHigh = impact === 'high';
      const isMed = impact === 'medium';
      const impactClass = isHigh ? 'high' : (isMed ? 'medium' : 'low');
      const impactLabel = isHigh ? 'High Impact' : (isMed ? 'Medium' : (ev.impact || 'Low'));

      const titleLower = String(ev.title || '').toLowerCase();
      const isSpeech = titleLower.includes('speaks') || titleLower.includes('speech') || titleLower.includes('testifies');
      const isHoliday = impact === 'holiday' || titleLower.includes('holiday');
      const hasActual = Boolean(ev.actual && ev.actual !== '--' && ev.actual !== '—');
      const hasNumbers = Boolean(ev.forecast || ev.previous || hasActual);

      let numbersHtml = '';
      if (isSpeech) {
        numbersHtml = `<span class="cal-badge-pill cal-pill-speech">🎙️ Pidato / Sentimen Kebijakan</span>`;
      } else if (isHoliday) {
        numbersHtml = `<span class="cal-badge-pill cal-pill-holiday">🏦 Libur Pasar / Bank Tutup</span>`;
      } else if (!hasNumbers) {
        numbersHtml = `<span class="cal-badge-pill cal-pill-nondata">📋 Agenda Non-Data Konsensus</span>`;
      } else {
        numbersHtml = `
          <span>Forecast: <strong class="cal-val">${escapeHtml(ev.forecast || '—')}</strong></span>
          <span>Previous: <strong class="cal-val">${escapeHtml(ev.previous || '—')}</strong></span>
          ${hasActual ? `<span>Actual: <strong class="cal-val act-live">${escapeHtml(ev.actual)}</strong></span>` : ''}
        `;
      }

      html.push(`
        <article class="calendar-card impact-${impactClass}">
          <div class="cal-top">
            <div class="cal-badge-wrap">
              <span class="cal-currency">${flag} ${escapeHtml(ev.country)}</span>
              <span class="impact-tag ${impactClass}">${impactLabel}</span>
            </div>
            <div class="cal-time-wrap">
              <span class="cal-time">⏰ ${timeStr}</span>
            </div>
          </div>
          <h2 class="cal-title">${escapeHtml(ev.title)}</h2>
          <div class="cal-bottom">
            <div class="cal-numbers">
              ${numbersHtml}
            </div>
            ${countdown.text ? `<span class="cal-countdown ${countdown.className}">${countdown.text}</span>` : ''}
          </div>
        </article>
      `);
    });

    html.push(`</div>`);
  });

  list.innerHTML = html.join('');
}
