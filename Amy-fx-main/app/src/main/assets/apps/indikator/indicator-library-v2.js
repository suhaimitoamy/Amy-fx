/* Amy FX Indicator Library v2.1 — kategori, search, favorit, copy feedback */
(function(){
  'use strict';

  const MANIFEST_URL = 'apps/indikator/manifest.json';
  let allIndicators = [];
  let favorites = JSON.parse(localStorage.getItem('amy_indikator_favorites') || '[]');
  let currentFilter = 'all';
  let searchQuery = '';

  async function loadManifest() {
    try {
      const r = await fetch(MANIFEST_URL);
      if (!r.ok) throw new Error('manifest fetch failed');
      allIndicators = await r.json();
    } catch(e) {
      console.warn('Manifest fetch failed, using fallback');
      allIndicators = window.AMY_INDIKATOR_FALLBACK || [];
    }
    render();
  }

  function categories() {
    const cats = ['all', ...new Set(allIndicators.map(x => x.category))];
    return cats;
  }

  function filtered() {
    let list = [...allIndicators];
    // favorit di atas
    list.sort((a,b) => {
      const af = favorites.includes(a.id) ? 0 : 1;
      const bf = favorites.includes(b.id) ? 0 : 1;
      return af - bf;
    });
    if (currentFilter !== 'all') {
      list = list.filter(x => x.category === currentFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(x =>
        x.name.toLowerCase().includes(q) ||
        (x.desc||'').toLowerCase().includes(q) ||
        (x.tags||[]).some(t => t.toLowerCase().includes(q)) ||
        (x.timeframe||'').toLowerCase().includes(q)
      );
    }
    return list;
  }

  function toggleFavorite(id) {
    if (favorites.includes(id)) {
      favorites = favorites.filter(x => x !== id);
    } else {
      favorites.push(id);
    }
    localStorage.setItem('amy_indikator_favorites', JSON.stringify(favorites));
    render();
  }

  async function copyCode(item) {
    let code = item.code || '';
    if (!code && item.url) {
      try {
        const r = await fetch(item.url);
        if (r.ok) code = await r.text();
      } catch(e) {
        code = '';
      }
    }
    if (!code) {
      showToast('Kode tidak tersedia', 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      showToast('✅ Kode disalin ke clipboard!', 'success');
    } catch(e) {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = code;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('✅ Kode disalin!', 'success');
    }
    if (window.Android?.triggerHaptic) window.Android.triggerHaptic(30);
  }

  function showToast(msg, type='success') {
    let t = document.getElementById('amy-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'amy-toast';
      t.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);z-index:9999;padding:10px 20px;border-radius:50px;font-weight:800;font-size:14px;transition:opacity .3s';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.background = type === 'success' ? '#4ade80' : '#ff5252';
    t.style.color = type === 'success' ? '#111' : '#fff';
    t.style.opacity = '1';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.opacity = '0'; }, 2200);
  }

  function render() {
    const root = document.getElementById('amy-indikator-root');
    if (!root) return;

    const cats = categories();
    const list = filtered();
    const isFav = id => favorites.includes(id);

    root.innerHTML = `
      <div style="padding:16px;max-width:900px;margin:0 auto">
        <div style="background:#121212;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px;margin-bottom:14px">
          <input id="amy-ind-search" type="search" placeholder="🔍 Cari indikator, tag, timeframe..." value="${searchQuery}"
            style="width:100%;background:#0a0a0a;border:1px solid rgba(212,175,55,.3);border-radius:12px;color:#fff;padding:12px 14px;font-size:14px;font-weight:700;outline:none">
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
          ${cats.map(c => `
            <button onclick="AmyIndikator.setFilter('${c}')"
              style="padding:8px 14px;border-radius:50px;font-weight:800;font-size:12px;border:1px solid rgba(212,175,55,.35);
              background:${currentFilter===c?'#d4af37':'rgba(212,175,55,.08)'};
              color:${currentFilter===c?'#111':'#d4af37'};cursor:pointer">
              ${c === 'all' ? '✦ Semua' : c}
            </button>
          `).join('')}
        </div>

        <div style="font-size:12px;color:#888;margin-bottom:12px;font-weight:700">
          ${list.length} indikator ditemukan ${favorites.length > 0 ? `• ${favorites.length} favorit ⭐` : ''}
        </div>

        ${list.length === 0 ? `
          <div style="border:1px dashed rgba(212,175,55,.3);border-radius:16px;padding:24px;text-align:center;color:#888">
            Tidak ada indikator yang cocok dengan pencarian "<strong>${searchQuery}</strong>"
          </div>
        ` : list.map(item => `
          <div style="background:#141414;border:1px solid rgba(255,255,255,.07);border-radius:18px;padding:16px;margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px">
              <div style="flex:1">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                  <span style="font-weight:950;font-size:15px;color:#f7f7f7">${item.name}</span>
                  ${isFav(item.id) ? '<span style="color:#d4af37;font-size:14px">⭐</span>' : ''}
                </div>
                <div style="margin-top:4px">
                  <span style="background:rgba(212,175,55,.12);color:#d4af37;border-radius:50px;padding:3px 10px;font-size:11px;font-weight:800;margin-right:6px">${item.category}</span>
                  ${item.timeframe ? `<span style="background:rgba(96,165,250,.1);color:#60a5fa;border-radius:50px;padding:3px 10px;font-size:11px;font-weight:800">${item.timeframe}</span>` : ''}
                </div>
              </div>
              <button onclick="AmyIndikator.toggleFav('${item.id}')"
                style="background:${isFav(item.id)?'rgba(212,175,55,.2)':'rgba(255,255,255,.05)'};border:1px solid rgba(212,175,55,.25);border-radius:50px;color:#d4af37;padding:6px 12px;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap">
                ${isFav(item.id) ? '★ Favorit' : '☆ Simpan'}
              </button>
            </div>

            <p style="color:#aaa;font-size:13px;line-height:1.5;margin:0 0 12px">${item.desc || ''}</p>

            ${item.tags && item.tags.length ? `
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
                ${item.tags.map(t => `<span style="background:rgba(255,255,255,.05);color:#888;border-radius:6px;padding:2px 8px;font-size:11px">#${t}</span>`).join('')}
              </div>
            ` : ''}

            <div style="display:flex;gap:8px">
              <button onclick="AmyIndikator.copy('${item.id}')"
                style="flex:1;min-height:44px;background:#d4af37;color:#111;border:0;border-radius:12px;font-weight:900;font-size:13px;cursor:pointer">
                📋 Salin Kode
              </button>
              ${item.version ? `<div style="display:flex;align-items:center;color:#555;font-size:11px;font-weight:800">v${item.version}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    document.getElementById('amy-ind-search')?.addEventListener('input', e => {
      searchQuery = e.target.value;
      render();
    });
  }

  // Public API
  window.AmyIndikator = {
    setFilter(cat) { currentFilter = cat; render(); },
    toggleFav(id) { toggleFavorite(id); },
    copy(id) { copyCode(allIndicators.find(x => x.id === id) || {}); },
    reload() { loadManifest(); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadManifest);
  } else {
    loadManifest();
  }
})();
