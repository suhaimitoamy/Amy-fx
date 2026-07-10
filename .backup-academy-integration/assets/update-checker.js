(function () {
  const CURRENT_VERSION_CODE = 7;
  const CURRENT_VERSION_NAME = '1.7';
  const UPDATE_URL = 'https://raw.githubusercontent.com/suhaimitoamy/Amy-fx/main/update.json';
  const DISMISS_KEY = 'amy_fx_update_dismissed_version';

  function css(el, styles) {
    Object.keys(styles).forEach(key => el.style[key] = styles[key]);
    return el;
  }

  function createButton(text, primary) {
    const btn = document.createElement('button');
    btn.textContent = text;
    css(btn, {
      flex: '1',
      border: primary ? '1px solid #d4af37' : '1px solid rgba(255,255,255,.18)',
      borderRadius: '14px',
      padding: '13px 10px',
      fontWeight: '900',
      background: primary ? '#d4af37' : 'rgba(255,255,255,.06)',
      color: primary ? '#111' : '#fff'
    });
    return btn;
  }

  function showUpdatePopup(data) {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (!data.force_update && dismissed === String(data.latest_version_code)) return;

    const overlay = document.createElement('div');
    css(overlay, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      background: 'rgba(0,0,0,.72)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
    });

    const box = document.createElement('div');
    css(box, {
      width: '100%',
      maxWidth: '420px',
      background: '#101010',
      color: '#fff',
      border: '1px solid rgba(212,175,55,.32)',
      borderRadius: '22px',
      padding: '20px',
      boxShadow: '0 20px 60px rgba(0,0,0,.55)'
    });

    const notes = Array.isArray(data.release_notes) ? data.release_notes : [];
    box.innerHTML = `
      <div style="color:#d4af37;font-weight:950;font-size:20px;margin-bottom:8px">Update Tersedia</div>
      <div style="color:#ddd;line-height:1.5;margin-bottom:14px">
        Versi baru Amy FX tersedia.<br>
        Versi kamu: <b>${CURRENT_VERSION_NAME}</b><br>
        Versi terbaru: <b>${data.latest_version_name || data.latest_version_code}</b>
      </div>
      <div style="background:#171717;border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:12px;margin-bottom:16px">
        <div style="font-weight:900;margin-bottom:6px">Perubahan:</div>
        ${notes.length ? '<ul style="margin:0;padding-left:18px;color:#ddd;line-height:1.5">' + notes.map(x => `<li>${String(x)}</li>`).join('') + '</ul>' : '<div style="color:#aaa">Tidak ada catatan perubahan.</div>'}
      </div>
    `;

    const row = document.createElement('div');
    css(row, { display: 'flex', gap: '10px' });

    const updateBtn = createButton('Update', true);
    const cancelBtn = createButton(data.force_update ? 'Nanti' : 'Batal', false);

    updateBtn.onclick = function () {
      const url = data.apk_url || 'https://github.com/suhaimitoamy/Amy-fx/releases/latest';
      window.location.href = url;
    };

    cancelBtn.onclick = function () {
      if (!data.force_update) localStorage.setItem(DISMISS_KEY, String(data.latest_version_code));
      overlay.remove();
    };

    row.appendChild(updateBtn);
    row.appendChild(cancelBtn);
    box.appendChild(row);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  async function checkUpdate() {
    try {
      const res = await fetch(UPDATE_URL + '?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const latestCode = Number(data.latest_version_code || 0);
      if (latestCode > CURRENT_VERSION_CODE) showUpdatePopup(data);
    } catch (e) {
      console.log('Update check skipped:', e && e.message ? e.message : e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkUpdate);
  } else {
    checkUpdate();
  }
})();
