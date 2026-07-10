document.addEventListener('DOMContentLoaded', () => {
  const mainContent = document.getElementById('main-content');
  const navBtns = document.querySelectorAll('.nav-btn');

  const projects = [
    { id: 'indikator', title: 'Indikator TradingView', badge: 'Library', icon: 'chart', desc: 'Library indikator & file Pine Script', target: 'internal' },
    { id: 'jurnal', title: 'Jurnal Trading', badge: 'Jurnal', icon: 'journal', desc: 'Catat jurnal, evaluasi performa, dan riwayat trading', target: 'apps/journal/index.html' },
    { id: 'academy', title: 'Amy Trading Academy', badge: 'Learning', icon: 'academy', desc: 'Materi belajar trading dalam aplikasi', target: 'apps/academy/index.html' },
    { id: 'mapping', title: 'Mapping', badge: 'Mapping', icon: 'mapping', desc: 'Mapping market & chart untuk analisis peluang', target: 'apps/mapping/index.html' }
  ];

  function showLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'var(--bg-color)';
    overlay.style.zIndex = '9999';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.color = 'var(--primary-gold)';
    overlay.style.fontFamily = 'sans-serif';
    overlay.innerHTML = `<div style="width: 40px; height: 40px; border: 3px solid rgba(255,193,7,0.2); border-top-color: var(--primary-gold); border-radius: 50%; animation: spin 1s linear infinite;"></div><p style="margin-top: 16px; font-weight: bold; font-size: 14px;">Memuat Aplikasi...</p><style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>`;
    document.body.appendChild(overlay);
  }

  let indicators = [
    { name: 'Memuat data...', category: 'Loading', desc: 'Mengambil indikator lokal...', code: 'Loading...' }
  ];

  let selectedIndicator = indicators[0];
  const fallbackIndicatorsEmbedded = [{"name": "Amy Breakout Retest Rejection Assistant", "category": "Pine Script", "desc": "File sumber lokal: AMY_Breakout_Retest_Rejection_Assistant.pine.txt", "url": "apps/indikator/files/AMY_Breakout_Retest_Rejection_Assistant.pine.txt", "code": ""}, {"name": "Amy Kronos Filter Bot Signal", "category": "Pine Script", "desc": "File sumber lokal: AMY_Kronos_Filter_Bot_Signal.pine.txt", "url": "apps/indikator/files/AMY_Kronos_Filter_Bot_Signal.pine.txt", "code": ""}, {"name": "Amy Neo Wave Structure Entry Map", "category": "Pine Script", "desc": "File sumber lokal: AMY_Neo_Wave_Structure_Entry_Map.pine.txt", "url": "apps/indikator/files/AMY_Neo_Wave_Structure_Entry_Map.pine.txt", "code": ""}, {"name": "Amy Pro Clean Sd Snr Fibo Scalping Engine Nowarning", "category": "Pine Script", "desc": "File sumber lokal: AMY_PRO_Clean_SD_SNR_Fibo_Scalping_Engine_NoWarning.pine.txt", "url": "apps/indikator/files/AMY_PRO_Clean_SD_SNR_Fibo_Scalping_Engine_NoWarning.pine.txt", "code": ""}, {"name": "Amy Pro Sd Snr Fibo Scalping Engine", "category": "Pine Script", "desc": "File sumber lokal: AMY_PRO_SD_SNR_Fibo_Scalping_Engine.pine.txt", "url": "apps/indikator/files/AMY_PRO_SD_SNR_Fibo_Scalping_Engine.pine.txt", "code": ""}, {"name": "Amy Supply Demand Snr Fibo Entry Calculator", "category": "Pine Script", "desc": "File sumber lokal: AMY_Supply_Demand_SNR_Fibo_Entry_Calculator.pine.txt", "url": "apps/indikator/files/AMY_Supply_Demand_SNR_Fibo_Entry_Calculator.pine.txt", "code": ""}, {"name": "Amy Ultimate Professional Suite", "category": "Pine Script", "desc": "File sumber lokal: AMY_Ultimate_Professional_Suite.pine", "url": "apps/indikator/files/AMY_Ultimate_Professional_Suite.pine", "code": ""}, {"name": "Gcx Entry Only V1", "category": "Pine Script", "desc": "File sumber lokal: GCX-Entry-Only-V1.pine", "url": "apps/indikator/files/GCX-Entry-Only-V1.pine", "code": ""}, {"name": "Gcx Matrix V12", "category": "Pine Script", "desc": "File sumber lokal: GCX-Matrix-V12.pine", "url": "apps/indikator/files/GCX-Matrix-V12.pine", "code": ""}, {"name": "Ict Yang Di Sempurnakan Edited", "category": "Pine Script", "desc": "File sumber lokal: ICT yang di sempurnakan edited.pine", "url": "apps/indikator/files/ICT yang di sempurnakan edited.pine", "code": ""}, {"name": "Ict Amy Entry Assistant V3 Break Retest Rejection", "category": "Pine Script", "desc": "File sumber lokal: ICT_AMY_Entry_Assistant_V3_Break_Retest_Rejection.pine.txt", "url": "apps/indikator/files/ICT_AMY_Entry_Assistant_V3_Break_Retest_Rejection.pine.txt", "code": ""}, {"name": "Ict Amy Entry Assistant V3 Mathzone Stable Nowarning", "category": "Pine Script", "desc": "File sumber lokal: ICT_AMY_Entry_Assistant_V3_MathZone_Stable_NoWarning.pine.txt", "url": "apps/indikator/files/ICT_AMY_Entry_Assistant_V3_MathZone_Stable_NoWarning.pine.txt", "code": ""}, {"name": "Ict Concepts Amygmgo Fixed Ready", "category": "Pine Script", "desc": "File sumber lokal: ICT_Concepts_amygmgo_FIXED_READY.pine", "url": "apps/indikator/files/ICT_Concepts_amygmgo_FIXED_READY.pine", "code": ""}, {"name": "Ict Validated Smc V1 Clean", "category": "Pine Script", "desc": "File sumber lokal: ICT_Validated_SMC_v1_clean.pine", "url": "apps/indikator/files/ICT_Validated_SMC_v1_clean.pine", "code": ""}, {"name": "Smc", "category": "Pine Script", "desc": "File sumber lokal: Smc.pine", "url": "apps/indikator/files/Smc.pine", "code": ""}, {"name": "Indikator Baru", "category": "Pine Script", "desc": "File sumber lokal: indikator-baru.pine", "url": "apps/indikator/files/indikator-baru.pine", "code": ""}, {"name": "Indikator V1", "category": "Pine Script", "desc": "File sumber lokal: indikator-v1.pine", "url": "apps/indikator/files/indikator-v1.pine", "code": ""}, {"name": "Indikator V10", "category": "Pine Script", "desc": "File sumber lokal: indikator-v10.pine", "url": "apps/indikator/files/indikator-v10.pine", "code": ""}, {"name": "Indikator V2", "category": "Pine Script", "desc": "File sumber lokal: indikator-v2.pine", "url": "apps/indikator/files/indikator-v2.pine", "code": ""}, {"name": "Indikator V3", "category": "Pine Script", "desc": "File sumber lokal: indikator-v3.pine", "url": "apps/indikator/files/indikator-v3.pine", "code": ""}, {"name": "Indikator V3 V4", "category": "Pine Script", "desc": "File sumber lokal: indikator-v3_v4.pine", "url": "apps/indikator/files/indikator-v3_v4.pine", "code": ""}];

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'\"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '\"': '&quot;' }[ch]));
  }

  async function loadRepoIndicators() {
    async function readLocalManifest() {
      const paths = [
        'apps/indikator/manifest.json',
        './apps/indikator/manifest.json',
        'file:///android_asset/apps/indikator/manifest.json'
      ];
      for (const p of paths) {
        try {
          const res = await fetch(p, { cache: 'no-store' });
          if (res && res.ok) return await res.json();
        } catch (e) {}
      }
      for (const p of paths) {
        try {
          const text = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', p, true);
            xhr.onload = () => (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) ? resolve(xhr.responseText) : reject(new Error('xhr status ' + xhr.status));
            xhr.onerror = reject;
            xhr.send();
          });
          return JSON.parse(text);
        } catch (e) {}
      }
      return fallbackIndicatorsEmbedded || [];
    }
    try {
      const repoIndicators = await readLocalManifest();
      if (Array.isArray(repoIndicators) && repoIndicators.length > 0) {
        indicators = repoIndicators.map((x, idx) => ({
          name: x.name || ('Indikator ' + (idx + 1)),
          category: x.category || 'Library',
          desc: x.desc || x.description || 'Pine Script lokal',
          code: x.code || '',
          url: x.url || x.path || ''
        }));
        selectedIndicator = indicators[0];
      } else {
        indicators = [{ name: 'Kosong', category: 'Empty', desc: 'Tidak ada indikator di manifest lokal.', code: 'Belum ada kode.' }];
        selectedIndicator = indicators[0];
      }
    } catch (err) {
      console.error(err);
      indicators = (fallbackIndicatorsEmbedded || []).length ? fallbackIndicatorsEmbedded : [{ name: 'Error', category: 'Error', desc: 'Manifest lokal tidak terbaca.', code: 'Gagal membaca manifest lokal.' }];
      selectedIndicator = indicators[0];
    }
    if (document.getElementById('indicator-list')) renderIndikator();
  }

  loadRepoIndicators();

  const svgs = {
    chart: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary-gold)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"></path><path d="M16 14h4v-2h-4zM10 8h4V6h-4zM4 16h4v-2H4z"></path><polyline points="4 14 10 8 16 14 22 4"></polyline></svg>`,
    journal: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary-gold)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path><path d="M17.5 7.5L12 13l-2.5-1.5L11 9l6.5-1.5z"></path></svg>`,
    academy: `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--primary-gold)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><defs><linearGradient id="academyGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#2a2211"/><stop offset="100%" stop-color="#050505"/></linearGradient></defs><rect x="1" y="1" width="22" height="22" rx="5" fill="url(#academyGrad)" stroke="var(--primary-gold)" stroke-width="0.8"/><line x1="5" y1="12" x2="5" y2="19" stroke="var(--primary-gold)" opacity="0.3" stroke-width="1"/><rect x="4" y="14" width="2" height="3" fill="var(--primary-gold)" stroke="none" opacity="0.4"/><line x1="19" y1="5" x2="19" y2="12" stroke="var(--primary-gold)" opacity="0.3" stroke-width="1"/><rect x="18" y="7" width="2" height="3" fill="var(--primary-gold)" stroke="none" opacity="0.4"/><path d="M1 18 L6 15 L10 16 L23 7" stroke="var(--primary-gold)" opacity="0.2" stroke-width="1"/><path d="M12 5.5 L7.5 7.5 V12.5 C7.5 15.5 9.5 18 12 19.5 C14.5 18 16.5 15.5 16.5 12.5 V7.5 L12 5.5 Z" fill="#0b0b0b" stroke="var(--primary-gold)" stroke-width="1"/><text x="12" y="14.8" font-family="Georgia, serif" font-size="6.5" font-weight="900" fill="var(--primary-gold)" stroke="none" text-anchor="middle" letter-spacing="0.5">AM</text><path d="M12 3 L7 5 L12 7 L17 5 Z" fill="var(--primary-gold)" stroke="none"/><path d="M16 5.5 V8" stroke="var(--primary-gold)" stroke-width="0.8"/><circle cx="16" cy="8.5" r="0.8" fill="var(--primary-gold)" stroke="none"/></svg>`,
    mapping: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary-gold)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon><line x1="9" y1="3" x2="9" y2="18"></line><line x1="15" y1="6" x2="15" y2="21"></line><circle cx="12" cy="8" r="2"></circle><path d="M12 10v5"></path></svg>`,
    code: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary-gold)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`
  };

  const badgeSvgs = {
    Library: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`,
    Jurnal: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
    Learning: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,
    Mapping: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`
  };

  function icon(type) {
    return `<span class="app-icon ${type}">${svgs[type] || ''}</span>`;
  }

  function setActive(target) {
    navBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.target === target));
  }

  function projectCard(item) {
    const badgeIcon = badgeSvgs[item.badge] || '';
    return `<button class="card project-card" data-open="${item.id}">${icon(item.icon)}<span class="card-content"><h3>${item.title}</h3><p>${item.desc}</p><span class="badge">${badgeIcon} ${item.badge}</span></span><span class="chevron">›</span></button>`;
  }

  function renderProjectList(title) {
    setActive(title === 'Beranda' ? 'beranda' : 'proyek');
    mainContent.innerHTML = `<div class="page-header"><h2>${title}</h2></div><div class="project-grid slide-up">${projects.map(projectCard).join('')}</div>`;
  }

  function renderKoleksi() {
    setActive('koleksi');
    mainContent.innerHTML = `<div class="page-header"><h2>Koleksi</h2></div><div class="collection-list slide-up"><button class="collection-item" data-koleksi="favorit">Favorit</button><button class="collection-item" data-koleksi="riwayat">Riwayat Dibuka</button><button class="collection-item" data-koleksi="kode">Kode Tersimpan</button><button class="collection-item" data-koleksi="update">Update Project</button></div>`;
  }

  function handleKoleksi(action) {
    if (action === 'kode') {
      const savedCode = localStorage.getItem('amy_saved_code');
      mainContent.innerHTML = `<div class="page-header row"><button class="back-btn" data-nav="koleksi">‹</button><h2>Kode Tersimpan</h2></div><section class="code-panel"><pre id="code-display"></pre><div class="actions"><button class="action-btn primary" data-copy-koleksi>Salin Kode</button></div></section>`;
      const savedDisplay = document.getElementById('code-display');
      if (savedDisplay) savedDisplay.textContent = savedCode || 'Belum ada kode tersimpan.';
    } else if (action === 'favorit' || action === 'riwayat') {
      showToast('Fitur ini akan segera hadir pada update berikutnya.');
    } else if (action === 'update') {
      showToast('Project saat ini sudah menggunakan versi terbaru.');
    }
  }

  function renderIndicatorList(category = 'Semua', query = '') {
    const list = document.getElementById('indicator-list');
    if (!list) return;
    const q = String(query || '').toLowerCase();
    const filtered = indicators.filter(item => (category === 'Semua' || String(item.category || '') === category) && (String(item.name || '').toLowerCase().includes(q) || String(item.desc || '').toLowerCase().includes(q)));
    list.innerHTML = filtered.map(item => {
      const originalIndex = indicators.indexOf(item);
      return `<button class="indicator-item" data-select-indicator="${originalIndex}">${icon('code')}<span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.desc)}</small></span><span class="chevron">›</span></button>`;
    }).join('') || '<div class="empty">Indikator tidak ditemukan.</div>';
  }

  async function renderIndikator() {
    setActive('proyek');
    const categoryOptions = ['Semua', ...new Set(indicators.map(i => i.category))];
    const pillsHTML = categoryOptions.map(cat => `<button class="pill ${cat === 'Semua' ? 'active' : ''}" data-filter="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`).join('');

    mainContent.innerHTML = `<div class="page-header row"><button class="back-btn" data-nav="proyek">‹</button><h2>Indikator TradingView</h2></div><input id="indicator-search" class="search-input" placeholder="Cari indikator..."><div class="pill-row">${pillsHTML}</div><div id="indicator-list" class="indicator-list slide-up"></div><section class="code-panel"><span class="badge">Terpilih</span><h3>${escapeHtml(selectedIndicator.name)}</h3><p>${escapeHtml(selectedIndicator.desc)}</p><pre id="code-display"></pre><div class="actions"><button class="action-btn" data-save-code>Simpan Kode</button><button class="action-btn primary" data-copy-code>Salin Kode</button></div></section>`;
    const codeDisplay = document.getElementById('code-display');
    if (codeDisplay) codeDisplay.textContent = selectedIndicator.code || 'Mengambil source code lokal...';
    
    renderIndicatorList();

    if (!selectedIndicator.code && selectedIndicator.url) {
       try {
         const res = await fetch(selectedIndicator.url);
         const text = await res.text();
         selectedIndicator.code = text;
         const codeDisplay = document.getElementById('code-display');
         if (codeDisplay) codeDisplay.textContent = text;
       } catch (err) {
         const codeDisplay = document.getElementById('code-display');
         if (codeDisplay) codeDisplay.textContent = 'Gagal memuat kode lokal.';
       }
    }
  }

  function openProject(id) {
    const project = projects.find(item => item.id === id);
    if (!project) return;
    if (project.target === 'internal') {
      renderIndikator();
    } else {
      showLoadingOverlay();
      setTimeout(() => location.assign(project.target), 100);
    }
  }

  function navigate(target) {
    if (target === 'beranda') renderProjectList('Beranda');
    if (target === 'proyek') renderProjectList('Proyek');
    if (target === 'koleksi') renderKoleksi();
  }


  async function copyTextSafe(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {}
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  document.addEventListener('click', async event => {
    const openBtn = event.target.closest('[data-open]');
    const navBtn = event.target.closest('[data-nav]');
    const indicatorBtn = event.target.closest('[data-select-indicator]');
    const filterBtn = event.target.closest('[data-filter]');
    const copyBtn = event.target.closest('[data-copy-code]');
    const saveBtn = event.target.closest('[data-save-code]');
    const koleksiBtn = event.target.closest('[data-koleksi]');
    const copyKoleksiBtn = event.target.closest('[data-copy-koleksi]');
    if (openBtn) openProject(openBtn.dataset.open);
    if (navBtn) navigate(navBtn.dataset.nav);
    if (indicatorBtn) { selectedIndicator = indicators[Number(indicatorBtn.dataset.selectIndicator)]; renderIndikator(); }
    if (filterBtn) { document.querySelectorAll('.pill').forEach(item => item.classList.remove('active')); filterBtn.classList.add('active'); renderIndicatorList(filterBtn.dataset.filter, document.getElementById('indicator-search')?.value || ''); }
    if (copyBtn) {
      const ok = await copyTextSafe(selectedIndicator.code || '');
      copyBtn.textContent = ok ? 'Tersalin' : 'Gagal Salin';
      if (!ok) showToast('Gagal menyalin kode. Pilih teks lalu salin manual.');
    }
    if (saveBtn) { localStorage.setItem('amy_saved_code', selectedIndicator.code || ''); saveBtn.textContent = 'Tersimpan'; }
    if (koleksiBtn) handleKoleksi(koleksiBtn.dataset.koleksi);
    if (copyKoleksiBtn) {
      const ok = await copyTextSafe(localStorage.getItem('amy_saved_code') || '');
      copyKoleksiBtn.textContent = ok ? 'Tersalin' : 'Gagal Salin';
      if (!ok) showToast('Gagal menyalin kode tersimpan.');
    }
  });

  document.addEventListener('input', event => {
    if (event.target.id === 'indicator-search') {
      const activeFilter = document.querySelector('.pill.active')?.dataset.filter || 'Semua';
      renderIndicatorList(activeFilter, event.target.value);
    }
  });

  navBtns.forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.target)));
  navigate('beranda');
});


// GLOBAL AMY FX JS SYSTEM
window.showToast = function(msg) {
  // Use native Android Toast instead of Web Toast
  if (window.Android && window.Android.showAppToast) {
    // Strip HTML tags if any, because Android Toast doesn't support HTML easily
    const plainMsg = msg.replace(/<[^>]*>?/gm, '');
    window.Android.showAppToast(plainMsg);
  } else {
    console.log("Toast:", msg);
  }
};

window.triggerHaptic = function(pattern) {
  // Use native Android Haptic Vibration
  if (window.Android && window.Android.triggerHaptic) {
    window.Android.triggerHaptic(pattern || 20);
  } else if ('vibrate' in navigator) {
    navigator.vibrate(pattern || 20);
  }
};

if (!window.amyHapticListenerAdded) {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button, a, .clickable, .nav-btn, .action-btn, .card');
      if (btn) window.triggerHaptic(20);
    });
    window.amyHapticListenerAdded = true;
}
