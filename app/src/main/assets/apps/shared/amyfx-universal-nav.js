(function() {
  'use strict';

  function getHomeUrl() {
    if (window.location.pathname.startsWith('/assets/')) {
      return '/assets/index.html';
    }
    return '/index.html';
  }

  function goBack() {
    // If not in root, return to home
    if (window.location.pathname === '/' || (window.location.pathname.endsWith('/index.html') && !window.location.pathname.includes('/apps/'))) {
      return;
    }
    if (window.Android && typeof window.Android.goHome === 'function') {
      window.Android.goHome();
      return;
    }
    const homeUrl = getHomeUrl();
    const originPath = window.location.pathname;
    try {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.assign(homeUrl);
      }
    } catch (_) {
      window.location.assign(homeUrl);
    }
    // Safety fallback: if user is still on the same page after 300ms, force redirect
    setTimeout(() => {
      if (window.location.pathname === originPath && window.location.pathname.includes('/apps/')) {
        if (window.Android && typeof window.Android.goHome === 'function') {
          window.Android.goHome();
        } else {
          window.location.assign(homeUrl);
        }
      }
    }, 300);
  }

  function goForward() {
    try {
      window.history.forward();
    } catch (_) {}
  }

  window.__amyfxGoBack = goBack;
  window.__amyfxGoForward = goForward;

  // Global click delegate for any button or link with data-amyfx-nav="back" or "forward"
  document.addEventListener('click', (e) => {
    const backBtn = e.target.closest('[data-amyfx-nav="back"], #amyfxNavBack, .amyfx-nav-back');
    if (backBtn) {
      e.preventDefault();
      e.stopPropagation();
      goBack();
      return;
    }
    const forwardBtn = e.target.closest('[data-amyfx-nav="forward"], #amyfxNavForward, .amyfx-nav-forward');
    if (forwardBtn) {
      e.preventDefault();
      e.stopPropagation();
      goForward();
    }
  }, true);

  // If in a sub-app (/apps/...), inject navigation arrows at opposite ends if not present
  function ensureNavArrows() {
    if (!window.location.pathname.includes('/apps/')) return;
    if (document.querySelector('#amyfxNavBack')) return;

    const header = document.querySelector('header.app-header, header.intel-header, header.topbar, header');
    if (header) {
      const leftBtn = document.createElement('button');
      leftBtn.type = 'button';
      leftBtn.className = 'nav-arrow-btn nav-arrow-left';
      leftBtn.id = 'amyfxNavBack';
      leftBtn.setAttribute('data-amyfx-nav', 'back');
      leftBtn.setAttribute('aria-label', 'Kembali ke Menu Utama');
      leftBtn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
      `;

      const rightBtn = document.createElement('button');
      rightBtn.type = 'button';
      rightBtn.className = 'nav-arrow-btn nav-arrow-right';
      rightBtn.id = 'amyfxNavForward';
      rightBtn.setAttribute('data-amyfx-nav', 'forward');
      rightBtn.setAttribute('aria-label', 'Maju');
      rightBtn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      `;

      header.prepend(leftBtn);
      header.append(rightBtn);
    }
  }

  // ─── Background Breaking News Observer ─────────────────────────────
  // Memastikan breaking news tetap dicek dan dimunculkan notifikasinya
  // saat pengguna sedang berada di halaman Mapping, Beranda, Jurnal, atau Akademi.
  function checkBreakingNews() {
    if (typeof window === 'undefined' || !window.location) return;
    if (window.location.pathname.includes('/market-intel/')) return; // Ditangani oleh market-intel/app.js

    const now = Date.now();
    const lastCheck = Number(sessionStorage.getItem('amy_last_news_poll_ms') || 0);
    if (now - lastCheck < 60_000) return;
    sessionStorage.setItem('amy_last_news_poll_ms', String(now));

    fetch('https://amy-fx.vercel.app/api/news?limit=8', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        if (!data?.news || !Array.isArray(data.news) || !data.news.length) return;
        const goldKeywords = [
          'gold', 'xau', 'emas', 'bullion', 'fed', 'fomc', 'powell',
          'inflation', 'cpi', 'pce', 'treasury', 'yield', 'dxy', 'dollar',
          'dolar', 'nfp', 'payroll', 'jobless', 'claims', 'war', 'perang',
          'geopolit', 'safe haven', 'central bank', 'bank sentral',
          'suku bunga', 'rate cut', 'rate hike', 'iran', 'israel', 'houthi',
          'oil', 'minyak', 'russia', 'rusia', 'ukraine', 'ukraina'
        ];
        const isRel = item => {
          if (item?.relevant === true) return true;
          const t = ((item?.text || '') + ' ' + (item?.textOriginal || '')).toLowerCase();
          return goldKeywords.some(k => t.includes(k));
        };
        const relevant = data.news.filter(isRel);
        if (!relevant.length) return;
        const latest = relevant[0];
        const latestId = String(latest.id || '');
        const lastNotified = localStorage.getItem('amy_last_notified_news_id');
        const lastKnown = localStorage.getItem('amy_last_news_id');

        if (lastKnown && latestId && latestId !== lastNotified && Number(latestId) > Number(lastNotified || 0)) {
          const impact = String(latest.impact || '').toLowerCase();
          const title = impact === 'high' ? '🚨 Breaking News Penting XAU/USD' : '📰 Breaking News XAU/USD';
          const msg = latest.text || latest.textOriginal || 'Berita baru XAU/USD tersedia.';
          const targetUrl = 'https://appassets.androidplatform.net/assets/apps/market-intel/index.html#news=' + encodeURIComponent(latestId);
          if (window.Android?.showNotificationWithUrl) {
            window.Android.showNotificationWithUrl(title, msg, targetUrl);
          } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification(title, { body: msg });
          }
          localStorage.setItem('amy_last_notified_news_id', latestId);
        }
        if (data.news[0]?.id) {
          localStorage.setItem('amy_last_news_id', String(data.news[0].id));
        }
      })
      .catch(() => {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ensureNavArrows();
      setTimeout(checkBreakingNews, 3000);
    });
  } else {
    ensureNavArrows();
    setTimeout(checkBreakingNews, 3000);
  }

  setInterval(checkBreakingNews, 60_000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkBreakingNews();
  });
})();
