(function () {
  const VERSION = window.AmyFXAppVersion || { name: '2.0.1', code: 52 };
  const CURRENT_VERSION_CODE = Number(VERSION.code) || 52;
  const CURRENT_VERSION_NAME = String(VERSION.name || '2.0.1');
  const UPDATE_URL = window.AmyFXUpdateManifestUrl
    || 'https://raw.githubusercontent.com/suhaimitoamy/Amy-fx/main/update.json';
  const CHECK_INTERVAL_MS = 15 * 60 * 1000;
  const RESUME_DELAY_MS = 900;

  let lastCheckAt = 0;
  let hiddenAt = 0;
  let popupOpen = false;
  let checkingPromise = null;
  let nativeUi = null;

  try {
    localStorage.removeItem('amy_fx_update_dismissed_version');
    localStorage.removeItem('amy_fx_update_last_check');
  } catch (_) {}

  const css = (element, styles) => {
    Object.assign(element.style, styles);
    return element;
  };

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  const notify = message => window.showToast ? window.showToast(message) : console.log(message);

  function humanBytes(value) {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes < 0) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function hasNativeUpdater() {
    return Boolean(window.Android && typeof window.Android.startAppUpdate === 'function');
  }

  function setNativeState(state, message) {
    if (!nativeUi) return;
    nativeUi.status.textContent = message || state || 'Memproses pembaruan...';
    const busy = ['starting', 'downloading', 'verifying'].includes(state);
    nativeUi.downloading = busy;
    nativeUi.progressWrap.style.display = busy || state === 'ready' ? 'block' : nativeUi.progressWrap.style.display;
    nativeUi.updateBtn.disabled = busy || state === 'ready' || state === 'permission';
    if (state === 'verifying') nativeUi.updateBtn.textContent = 'Memverifikasi...';
    else if (busy) nativeUi.updateBtn.textContent = 'Mengunduh...';
    else if (state === 'ready') nativeUi.updateBtn.textContent = 'Membuka installer...';
    else if (state === 'cancelled') nativeUi.updateBtn.textContent = 'Coba Lagi';
  }

  window.AmyFXUpdateNative = {
    onProgress(percent, downloaded, total) {
      if (!nativeUi) return;
      nativeUi.progressWrap.style.display = 'block';
      const safe = Number(percent);
      const value = Number.isFinite(safe) ? Math.max(0, Math.min(100, safe)) : 0;
      nativeUi.bar.style.width = Number.isFinite(safe) ? `${value}%` : '22%';
      nativeUi.percent.textContent = Number.isFinite(safe) ? `${value}%` : '...';
      nativeUi.bytes.textContent = `${humanBytes(downloaded)} dari ${Number(total) > 0 ? humanBytes(total) : 'ukuran belum diketahui'}`;
    },
    onState(state, message) {
      setNativeState(String(state || ''), String(message || ''));
    },
    onError(message) {
      const text = String(message || 'Pembaruan gagal.');
      if (!nativeUi) return notify(text);
      nativeUi.downloading = false;
      nativeUi.status.textContent = text;
      nativeUi.status.style.color = '#ff8f8f';
      nativeUi.updateBtn.disabled = false;
      nativeUi.updateBtn.textContent = 'Coba Lagi';
    }
  };

  function button(text, primary) {
    const element = document.createElement('button');
    element.textContent = text;
    return css(element, {
      flex: '1', border: primary ? '1px solid #d4af37' : '1px solid rgba(255,255,255,.18)',
      borderRadius: '14px', padding: '13px 10px', fontWeight: '900',
      background: primary ? '#d4af37' : 'rgba(255,255,255,.06)', color: primary ? '#111' : '#fff'
    });
  }

  function showUpdatePopup(data, latestCode, latestName) {
    if (popupOpen) return;
    popupOpen = true;
    const overlay = css(document.createElement('div'), {
      position: 'fixed', inset: '0', zIndex: '2147483647', background: 'rgba(0,0,0,.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
    });
    overlay.id = 'amy-fx-update-overlay';
    const box = css(document.createElement('div'), {
      width: '100%', maxWidth: '420px', background: '#101010', color: '#fff',
      border: '1px solid rgba(212,175,55,.32)', borderRadius: '22px', padding: '20px'
    });
    const notes = Array.isArray(data.release_notes) ? data.release_notes : (Array.isArray(data.changelog) ? data.changelog : []);
    box.innerHTML = `<div style="color:#d4af37;font-weight:950;font-size:20px;margin-bottom:8px">Update Amy FX Tersedia</div>
      <div style="color:#ddd;line-height:1.5;margin-bottom:14px">Versi kamu: <b>${escapeHtml(CURRENT_VERSION_NAME)}</b> (${CURRENT_VERSION_CODE})<br>Versi terbaru: <b>${escapeHtml(latestName)}</b> (${latestCode})</div>
      <div style="background:#171717;border-radius:14px;padding:12px;margin-bottom:12px"><b>Perubahan:</b>${notes.length ? `<ul>${notes.map(note => `<li>${escapeHtml(note)}</li>`).join('')}</ul>` : '<p>Tidak ada catatan perubahan.</p>'}</div>`;

    const progressWrap = css(document.createElement('div'), { display: 'none', background: '#171717', borderRadius: '14px', padding: '12px', marginBottom: '12px' });
    const status = document.createElement('div');
    status.textContent = 'Menunggu unduhan...';
    const track = css(document.createElement('div'), { height: '10px', background: '#2a2a2a', borderRadius: '999px', overflow: 'hidden', marginTop: '9px' });
    const bar = css(document.createElement('div'), { width: '0%', height: '100%', background: '#d4af37' });
    const details = css(document.createElement('div'), { display: 'flex', justifyContent: 'space-between', marginTop: '8px', color: '#aaa' });
    const bytes = document.createElement('span');
    const percent = document.createElement('strong');
    bytes.textContent = '0 MB'; percent.textContent = '0%';
    track.appendChild(bar); details.append(bytes, percent); progressWrap.append(status, track, details); box.appendChild(progressWrap);

    const note = document.createElement('div');
    note.textContent = hasNativeUpdater()
      ? 'APK diunduh ke cache Amy FX, diverifikasi, lalu Android meminta konfirmasi instalasi. File tidak menumpuk di folder Download.'
      : 'Unduhan dibuka melalui browser. Instal APK untuk memperbarui Amy FX tanpa menghapus data.';
    css(note, { color: '#aaa', fontSize: '12px', lineHeight: '1.45', marginBottom: '16px' });
    box.appendChild(note);

    const row = css(document.createElement('div'), { display: 'flex', gap: '10px' });
    const updateBtn = button('Unduh & Perbarui', true);
    const cancelBtn = button('Batal', false);
    const closePopup = () => { popupOpen = false; if (nativeUi?.overlay === overlay) nativeUi = null; overlay.remove(); };

    updateBtn.onclick = () => {
      const downloadUrl = data.apk_url || data.downloadUrl || 'https://github.com/suhaimitoamy/Amy-fx/releases/latest';
      if (hasNativeUpdater()) {
        nativeUi = { overlay, progressWrap, status, bar, bytes, percent, updateBtn, cancelBtn, downloading: true };
        setNativeState('starting', `Menyiapkan unduhan Amy FX ${latestName}...`);
        try { window.Android.startAppUpdate(String(downloadUrl), String(latestName), Number(latestCode)); }
        catch (error) { window.AmyFXUpdateNative.onError(error?.message || 'Updater native tidak dapat dijalankan.'); }
        return;
      }
      window.location.href = downloadUrl;
    };
    cancelBtn.onclick = () => {
      if (nativeUi?.overlay === overlay && nativeUi.downloading && window.Android?.cancelAppUpdate) {
        try { window.Android.cancelAppUpdate(); } catch (_) {}
      }
      closePopup();
    };
    row.append(updateBtn, cancelBtn); box.appendChild(row); overlay.appendChild(box); document.body.appendChild(overlay);
  }

  async function checkUpdate(options = {}) {
    const force = Boolean(options.force);
    const announce = Boolean(options.announce);
    const now = Date.now();
    if (checkingPromise) return checkingPromise;
    if (!force && now - lastCheckAt < 10000) return { status: 'throttled' };
    lastCheckAt = now;
    checkingPromise = (async () => {
      try {
        const res = await fetch(`${UPDATE_URL}?_=${now}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const latestCode = Number(data.latest_version_code ?? data.versionCode ?? 0);
        const latestName = String(data.latest_version_name ?? data.version ?? latestCode);
        if (latestCode > CURRENT_VERSION_CODE) {
          showUpdatePopup(data, latestCode, latestName);
          return { status: 'update_available', latestCode, latestName };
        }
        if (announce) notify(`Amy FX v${CURRENT_VERSION_NAME} (${CURRENT_VERSION_CODE}) sudah versi terbaru.`);
        return { status: 'up_to_date', latestCode, latestName };
      } catch (error) {
        if (announce) notify('Gagal memeriksa pembaruan. Coba lagi saat koneksi stabil.');
        return { status: 'error', error };
      } finally { checkingPromise = null; }
    })();
    return checkingPromise;
  }

  function scheduleCheck() {
    if ('requestIdleCallback' in window) window.requestIdleCallback(() => checkUpdate(), { timeout: 5000 });
    else setTimeout(() => checkUpdate(), 4000);
    setInterval(() => { if (!document.hidden) checkUpdate(); }, CHECK_INTERVAL_MS);
  }

  window.AmyFXUpdate = {
    currentVersion: Object.freeze({ name: CURRENT_VERSION_NAME, code: CURRENT_VERSION_CODE }),
    nativeDownloadSupported: hasNativeUpdater,
    checkNow: options => checkUpdate({ force: true, announce: true, ...(options || {}) })
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    const wasAway = hiddenAt && Date.now() - hiddenAt > 1200;
    hiddenAt = 0;
    if (wasAway) setTimeout(() => checkUpdate({ force: true }), RESUME_DELAY_MS);
  });
  window.addEventListener('pageshow', event => { if (event.persisted) setTimeout(() => checkUpdate({ force: true }), RESUME_DELAY_MS); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleCheck, { once: true });
  else scheduleCheck();
})();
