/* Amy FX Update Checker v1.1 — cek sekali per hari, tampilkan dialog yang benar */
(function(){
  'use strict';

  const UPDATE_URL = 'https://raw.githubusercontent.com/suhaimitoamy/Amy-fx/main/update.json';
  const CURRENT_VERSION = '1.2.0';
  const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1 hari
  const LAST_CHECK_KEY = 'amy_last_update_check';
  const DISMISSED_KEY  = 'amy_update_dismissed_version';

  function versionToInt(v) {
    const parts = String(v || '0').split('.').map(x => parseInt(x, 10) || 0);
    return parts[0] * 10000 + parts[1] * 100 + (parts[2] || 0);
  }

  async function check() {
    const now = Date.now();
    const lastCheck = parseInt(localStorage.getItem(LAST_CHECK_KEY) || '0', 10);
    if (now - lastCheck < CHECK_INTERVAL_MS) return;

    localStorage.setItem(LAST_CHECK_KEY, String(now));

    try {
      const r = await fetch(UPDATE_URL + '?t=' + now, { cache: 'no-store' });
      if (!r.ok) return;
      const data = await r.json();
      const latestVersion = data.version || '0.0.0';
      const dismissed = localStorage.getItem(DISMISSED_KEY);

      if (versionToInt(latestVersion) > versionToInt(CURRENT_VERSION)) {
        if (!data.mandatory && dismissed === latestVersion) return;
        showUpdateDialog(data);
      }
    } catch(e) {
      // silent fail — tidak tampilkan error ke user
    }
  }

  function showUpdateDialog(data) {
    if (document.getElementById('amy-update-dialog')) return;

    const overlay = document.createElement('div');
    overlay.id = 'amy-update-dialog';
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.75);
      display:flex;align-items:flex-end;justify-content:center;
      padding:0 0 16px;box-sizing:border-box;
    `;

    const box = document.createElement('div');
    box.style.cssText = `
      background:#141414;border:1px solid rgba(212,175,55,.3);border-radius:24px 24px 16px 16px;
      padding:22px;max-width:480px;width:100%;box-sizing:border-box;
    `;

    const changes = (data.changelog || []).map(c => `<li style="margin:4px 0;color:#ccc">${c}</li>`).join('');
    box.innerHTML = `
      <div style="color:#d4af37;font-size:12px;font-weight:900;letter-spacing:.06em;margin-bottom:6px">UPDATE TERSEDIA</div>
      <div style="font-size:20px;font-weight:950;color:#f7f7f7;margin-bottom:4px">Amy FX v${data.version}</div>
      <div style="color:#888;font-size:13px;margin-bottom:14px">Versi kamu: v${CURRENT_VERSION}</div>
      ${changes ? `<ul style="margin:0 0 14px;padding-left:18px;font-size:13px;line-height:1.6">${changes}</ul>` : ''}
      <div style="display:flex;gap:10px">
        <button id="amy-update-btn"
          style="flex:1;min-height:48px;background:#d4af37;color:#111;border:0;border-radius:14px;font-weight:900;font-size:14px;cursor:pointer">
          ⬇ Download Update
        </button>
        ${!data.mandatory ? `<button id="amy-update-dismiss"
          style="min-height:48px;background:rgba(255,255,255,.07);color:#aaa;border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:0 16px;font-weight:800;cursor:pointer">
          Nanti
        </button>` : ''}
      </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    document.getElementById('amy-update-btn')?.addEventListener('click', () => {
      if (data.downloadUrl) {
        const a = document.createElement('a');
        a.href = data.downloadUrl;
        a.target = '_blank';
        a.click();
      }
      document.body.removeChild(overlay);
    });

    document.getElementById('amy-update-dismiss')?.addEventListener('click', () => {
      localStorage.setItem(DISMISSED_KEY, data.version);
      document.body.removeChild(overlay);
    });
  }

  // Jalankan setelah halaman load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', check);
  } else {
    setTimeout(check, 3000); // delay 3s agar tidak ganggu load pertama
  }
})();
