/* Amy FX Pro — Gemini AI & Live Voice Bridge (✦ AMY Upgrade + Fullscreen Bubble Orb) */
(function (root) {
  'use strict';
  if (root.__AmyGeminiLiveBridgeLoaded) return;
  root.__AmyGeminiLiveBridgeLoaded = true;

  const CHAT_STORAGE_KEY = 'amyfx.gemini.chat.v1';
  let geminiConfig = null;
  let pendingImageBase64 = '';
  let pendingImageLabel = '';

  // Live Voice State
  let ws = null;
  let isLiveConnected = false;
  let isLiveConnecting = false;
  let isMicMuted = false;
  let micStream = null;
  let micAudioCtx = null;
  let micProcessor = null;
  let playAudioCtx = null;
  let nextPlayTime = 0;
  let activeSources = [];
  let isStreamingMic = true;
  let isUserSpeaking = false;
  let silenceTimer = null;
  let lastCanvasSentAt = 0;
  let currentLiveAiBubble = null;
  let currentLiveUserBubble = null;
  let isBubbleFullscreen = false;

  // Threshold sensitif untuk mikrofon HP + jeda hening alami 1.4 detik
  const VAD_SPEECH_THRESHOLD = 0.0085;
  const VAD_SILENCE_MS = 1400;

  function cleanPlainText(text) {
    return String(text || '')
      .replace(/^[ \t]*---+[ \t]*$/gm, '')
      .replace(/^[ \t]*#{1,6}[ \t]*/gm, '')
      .replace(/^[ \t]*[*-][ \t]+/gm, '• ')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*\n]+)\*/g, '$1')
      .replace(/[*#`]/g, '')
      .replace(/\bSayang\b/g, 'kamu')
      .replace(/\bsayang\b/g, 'kamu')
      .replace(/\bHalo kamu\b/gi, 'Halo')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function loadHistory() {
    try {
      const raw = root.localStorage.getItem(CHAT_STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      const cleaned = arr
        .filter(
          it =>
            it &&
            typeof it.text === 'string' &&
            !it.text.includes('Mekanisme Algoritmik IPDA') &&
            !it.text.includes('total keseluruhan modulnya') &&
            !it.text.includes('masih fokus pada Modul 01') &&
            !it.text.includes('MOC: Trauma & Recovery') &&
            !it.text.includes('Kronologi Kehancuran') &&
            !it.text.includes('2026-06-08') &&
            !it.text.includes('jam 8 junam')
        )
        .map(it => ({ role: it.role, text: cleanPlainText(it.text) }));
      return cleaned.slice(-30);
    } catch (_) {
      return [];
    }
  }

  function saveHistory(arr) {
    try {
      root.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(arr.slice(-30)));
    } catch (_) {}
  }

  async function ensureGeminiConfig() {
    if (geminiConfig && geminiConfig.apiKey) return geminiConfig;
    try {
      const res = await fetch('/api/gemini-config');
      if (res.ok) {
        geminiConfig = await res.json();
      }
    } catch (_) {}
    return geminiConfig;
  }

  function captureChartCanvasBase64() {
    try {
      const container =
        document.querySelector('#gold-chart-workspace') ||
        document.querySelector('.gold-price-panel') ||
        document.querySelector('#home-gold-chart') ||
        document.querySelector('.tv-lightweight-charts');
      if (!container) return '';
      const canvases = Array.from(container.querySelectorAll('canvas')).filter(c => c.width > 50 && c.height > 50);
      if (!canvases.length) return '';

      const rect = container.getBoundingClientRect();
      const outW = Math.min(960, Math.max(480, Math.round(rect.width || canvases[0].width)));
      const outH = Math.min(640, Math.max(280, Math.round(rect.height || canvases[0].height)));
      const out = document.createElement('canvas');
      out.width = outW;
      out.height = outH;
      const ctx = out.getContext('2d');
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, outW, outH);

      for (const c of canvases) {
        try {
          const r = c.getBoundingClientRect();
          const x = Math.max(0, Math.round(r.left - rect.left));
          const y = Math.max(0, Math.round(r.top - rect.top));
          const w = Math.round(r.width || c.width);
          const h = Math.round(r.height || c.height);
          ctx.drawImage(c, x, y, w, h);
        } catch (_) {}
      }
      const dataUrl = out.toDataURL('image/jpeg', 0.8);
      return dataUrl.replace(/^data:image\/\w+;base64,/, '');
    } catch (_) {
      return '';
    }
  }

  function summarizeCandles(tf) {
    try {
      const raw =
        root.localStorage.getItem(`amyfx.mapping.candles.${tf}`) ||
        root.localStorage.getItem(`amyfx.candles.XAU/USD.${tf}`);
      if (!raw) return '';
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.candles)
        ? parsed.candles
        : Array.isArray(parsed?.values)
        ? parsed.values
        : [];
      if (!list.length) return '';
      const recent = list.slice(-5);
      const last = recent[recent.length - 1];
      const hi = Math.max(...list.slice(-32).map(c => Number(c.high || c.h || 0)).filter(Boolean));
      const lo = Math.min(...list.slice(-32).map(c => Number(c.low || c.l || 0)).filter(Boolean));
      const eq = hi && lo ? ((hi + lo) / 2).toFixed(2) : '';
      const closeVal = Number(last.close || last.c || 0).toFixed(2);
      const candlesText = recent
        .map(c => {
          const o = Number(c.open || c.o || 0).toFixed(2);
          const h = Number(c.high || c.h || 0).toFixed(2);
          const l = Number(c.low || c.l || 0).toFixed(2);
          const cl = Number(c.close || c.c || 0).toFixed(2);
          const dir = Number(cl) >= Number(o) ? 'BULL' : 'BEAR';
          return `[${dir} O:${o} H:${h} L:${l} C:${cl}]`;
        })
        .join(' → ');
      return `• Candle ${tf}: Close Terakhir $${closeVal} | Range 32-Bar: Low $${lo.toFixed(2)} – High $${hi.toFixed(2)} (EQ 50%: $${eq})\n  5 Candle ${tf} Terakhir: ${candlesText}`;
    } catch (_) {
      return '';
    }
  }

    let lastRequestedLesson = null;

    async function collectAcademyReadingContext(userQuestion) {
      try {
        lastRequestedLesson = null;
        let lastRead = null;
      let history = [];
      let microProgress = {};
      try {
        lastRead = JSON.parse(root.localStorage.getItem('amy_academy_last_read_v2') || 'null');
      } catch (_) {}
      try {
        const h = JSON.parse(root.localStorage.getItem('amy_academy_reading_history_v2') || '[]');
        if (Array.isArray(h)) history = h;
      } catch (_) {}
      try {
        microProgress = JSON.parse(root.localStorage.getItem('amyfx.academy.micro_progress') || '{}') || {};
      } catch (_) {}

      const fallbackTitle = root.localStorage.getItem('amy_last_opened_title') || '';
      const fallbackUrl = root.localStorage.getItem('amy_last_opened_url') || '';
      if (!lastRead && fallbackTitle) {
        lastRead = {
          title: fallbackTitle,
          path: fallbackUrl.replace(/^.*\/apps\/academy\//i, ''),
          section: 'Amy FX Academy',
          progress: 100,
          updatedAt: Date.now()
        };
      }

      let apiData = null;
      try {
        const hasState = Boolean(lastRead && lastRead.title);
        const isJournalOrMarketQuery = /\b(evaluasi performa jurnal|winrate|refleksi emosi saya|berita terbaru|kalender ekonomi|analisa chart gold)\b/i.test(userQuestion || '');
        const isAcademyLessonQuery =
          !isJournalOrMarketQuery &&
          /\b(modul|level|bab|bagian|materi|pelajari|belajar|buka|fvg|order block|liquidity|bos|mss|ote|killzone|turtle soup|inducement|amd|po3)\b/i.test(userQuestion || '');
        const effectiveLessonQuery = isAcademyLessonQuery ? (userQuestion || '') : '';
        const qParam = effectiveLessonQuery ? `?q=${encodeURIComponent(effectiveLessonQuery)}` : '';
        const resp = await fetch(`/api/academy-reading${qParam}`, {
          method: hasState || effectiveLessonQuery ? 'POST' : 'GET',
          headers: hasState || effectiveLessonQuery ? { 'Content-Type': 'application/json' } : undefined,
          body: hasState || effectiveLessonQuery ? JSON.stringify({ lastRead, history, microProgress, query: effectiveLessonQuery }) : undefined
        });
        if (resp.ok) apiData = await resp.json();
      } catch (_) {}

      const effectiveState = apiData?.state || { lastRead, history };
      const finalLast = lastRead?.title ? lastRead : (effectiveState.lastRead || null);
      const finalHistory = history.length ? history : (Array.isArray(effectiveState.history) ? effectiveState.history : []);
      const details = apiData?.lessonDetails || null;
      const requestedLesson = apiData?.requestedLesson || null;
      if (requestedLesson && requestedLesson.title) {
        lastRequestedLesson = requestedLesson;
      }
      const catalogText = apiData?.catalogText || '';

      if (finalLast && finalLast.title && !root.localStorage.getItem('amy_academy_last_read_v2')) {
        try {
          root.localStorage.setItem('amy_academy_last_read_v2', JSON.stringify(finalLast));
          root.localStorage.setItem('amy_last_opened_title', finalLast.title);
          if (finalHistory.length) {
            root.localStorage.setItem('amy_academy_reading_history_v2', JSON.stringify(finalHistory));
          }
        } catch (_) {}
      }

      const out = [];
      if (catalogText) {
        out.push(catalogText);
      }

      if (requestedLesson && requestedLesson.title) {
        out.push(`\n=== ISI LENGKAP MATERI YANG DIMINTA PENGGUNA SAAT INI (WAJIB DIBUKA & DIJELASKAN!) ===`);
        out.push(`• Judul Materi: "${requestedLesson.title}" (apps/academy/${requestedLesson.relPath})`);
        out.push(`• Isi Materi Lengkap:\n${requestedLesson.fullText || requestedLesson.summary}`);
        if (requestedLesson.nextLessonTitle) {
          out.push(`• Materi Selanjutnya Setelah Ini: "${requestedLesson.nextLessonTitle}" (apps/academy/${requestedLesson.nextLessonPath})`);
        }
      }

      out.push('\n=== RIWAYAT BACAAN ACADEMY TERAKHIR PENGGUNA ===');
      if (finalLast && finalLast.title) {
        out.push(`• Materi Terakhir Dibaca Pengguna: "${details?.title || finalLast.title}"`);
        if (finalLast.section) out.push(`• Bagian / Level: ${finalLast.section}`);
        if (finalLast.path || details?.relPath) out.push(`• Lokasi File Materi: apps/academy/${details?.relPath || finalLast.path}`);
        if (finalLast.headingText && finalLast.headingText !== finalLast.title) {
          out.push(`• Posisi Sub-bab Terakhir: ${finalLast.headingText} (${Number(finalLast.progress || 0)}% halaman tergulir)`);
        }
      } else {
        out.push(`• Materi Terakhir Dibaca Pengguna: Level 0 — 01. Apa Itu Trading Sebenarnya?`);
      }

      if (finalHistory.length > 0) {
        const histList = finalHistory
          .slice(0, 6)
          .map((item, idx) => `${idx + 1}. ${item.title}${item.section ? ` (${item.section})` : ''}`)
          .join(' | ');
        out.push(`• Daftar Urutan Riwayat Bacaan Terakhir: ${histList}`);
      }

      if (details?.summary) {
        out.push(`• Isi Asli Materi Terakhir yang Dibaca Pengguna:\n${details.summary}`);
      }

      if (details?.nextLessonTitle || finalLast?.nextTitle) {
        out.push(`• Materi Urutan Selanjutnya: "${details?.nextLessonTitle || finalLast?.nextTitle}" (${details?.nextLessonPath || finalLast?.nextHref || ''})`);
        if (details?.nextLessonSummary) {
          out.push(`• Cuplikan Materi Selanjutnya:\n${details.nextLessonSummary}`);
        }
      }

      return out.join('\n');
    } catch (_) {
      return '';
    }
  }

  async function collectAmyAppContext(userQuestion) {
    const lines = [];
    const nowWita = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar', hour12: false }) + ' WITA';
    lines.push(`Waktu Saat Ini: ${nowWita}`);
    lines.push(`Halaman Aktif: ${document.title || window.location.pathname}`);

    const academyCtx = await collectAcademyReadingContext(userQuestion);
    if (academyCtx) lines.push(academyCtx);

    const domPrice =
      document.querySelector('#live-price-value, #mapping-live-price, .gold-live-price, [data-live-price]')?.textContent?.trim() || '';
    if (domPrice) lines.push(`Harga Tampil di Layar: ${domPrice}`);

    const domAssistantPrimary = document.querySelector('#assistant-primary-msg')?.textContent?.trim() || '';
    const domAssistantSub = document.querySelector('#assistant-sub-msg')?.textContent?.trim() || '';
    const domConfluence = document.querySelector('#assistant-confluence-tag')?.textContent?.trim() || '';
    if (domAssistantPrimary) {
      lines.push(`Status Kartu Asisten Mapping: ${domAssistantPrimary} (${domAssistantSub}) [${domConfluence}]`);
    }

    const m15Sum = summarizeCandles('M15') || summarizeCandles('15min');
    const m5Sum = summarizeCandles('M5') || summarizeCandles('5min');
    if (m15Sum) lines.push(m15Sum);
    if (m5Sum) lines.push(m5Sum);

    if (root.AmyLocalAssistant) {
      try {
        const mapText = root.AmyLocalAssistant.mapping('mapping', null, Date.now());
        if (mapText) lines.push(`Konteks Struktur Mapping:\n${mapText}`);
      } catch (_) {}
      try {
        const askAll = await root.AmyLocalAssistant.ask('semua modul');
        if (askAll?.text) lines.push(`Ringkasan Modul Aplikasi (Mapping, News, Jurnal, Academy):\n${askAll.text}`);
      } catch (_) {}
      if (userQuestion) {
        try {
          const specific = await root.AmyLocalAssistant.ask(userQuestion);
          if (specific?.text && !specific.text.includes('belum bisa menentukan')) {
            lines.push(`Referensi Spesifik Aplikasi:\n${specific.text}`);
          }
        } catch (_) {}
      }
    }

    return lines.join('\n\n');
  }

  function downsampleTo16k(inputBuffer, inputSampleRate) {
    if (inputSampleRate === 16000) {
      const pcm16 = new Int16Array(inputBuffer.length);
      for (let i = 0; i < inputBuffer.length; i++) {
        const s = Math.max(-1, Math.min(1, inputBuffer[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      return pcm16;
    }
    const ratio = inputSampleRate / 16000;
    const newLength = Math.round(inputBuffer.length / ratio);
    const pcm16 = new Int16Array(newLength);
    let offsetResult = 0;
    let offsetInput = 0;
    while (offsetResult < pcm16.length) {
      const nextOffsetInput = Math.round((offsetResult + 1) * ratio);
      let accum = 0;
      let count = 0;
      for (let i = offsetInput; i < nextOffsetInput && i < inputBuffer.length; i++) {
        accum += inputBuffer[i];
        count++;
      }
      const sample = count > 0 ? accum / count : 0;
      const clamped = Math.max(-1, Math.min(1, sample));
      pcm16[offsetResult] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF;
      offsetResult++;
      offsetInput = nextOffsetInput;
    }
    return pcm16;
  }

  function playPcm24k(base64Data, onSpeakingStateChange) {
    if (!playAudioCtx) return;
    if (playAudioCtx.state === 'suspended') {
      playAudioCtx.resume().catch(() => {});
    }
    const bin = atob(base64Data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768.0;

    const buf = playAudioCtx.createBuffer(1, float32.length, 24000);
    buf.getChannelData(0).set(float32);

    const src = playAudioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(playAudioCtx.destination);

    const now = playAudioCtx.currentTime;
    // Buffer pengaman 60ms agar aliran suara Aoede mulus & tidak patah-patah
    if (nextPlayTime < now) nextPlayTime = now + 0.06;
    src.start(nextPlayTime);
    nextPlayTime += buf.duration;

    isStreamingMic = false;
    activeSources.push(src);
    if (onSpeakingStateChange) onSpeakingStateChange(true);

    src.onended = () => {
      const idx = activeSources.indexOf(src);
      if (idx !== -1) activeSources.splice(idx, 1);
      if (activeSources.length === 0) {
        // Beri jeda 220ms setelah audio selesai agar gema speaker HP tidak memotong ulang
        setTimeout(() => {
          if (activeSources.length === 0) {
            isStreamingMic = true;
            if (onSpeakingStateChange) onSpeakingStateChange(false);
          }
        }, 220);
      }
    };
  }

  function stopPlayback() {
    for (const s of activeSources) {
      try { s.stop(); } catch (_) {}
    }
    activeSources = [];
    if (playAudioCtx) nextPlayTime = playAudioCtx.currentTime;
    isStreamingMic = true;
  }

  function upgradeAssistantPanel() {
    const host = document.getElementById('amy-local-root');
    if (!host || host.dataset.geminiUpgraded === 'true') return;
    host.dataset.geminiUpgraded = 'true';

    const panel = host.querySelector('#amy-local-panel');
    const fab = host.querySelector('#amy-local-fab');
    const messages = host.querySelector('#amy-local-messages');
    const form = host.querySelector('form');
    const input = form.querySelector('input');
    const promptsWrap = host.querySelector('.prompts');
    const header = panel.querySelector('header');
    const small = panel.querySelector('small');

    const extraStyle = document.createElement('style');
    extraStyle.textContent = `
      #amy-local-panel small {
        display: none !important;
      }
      #amy-local-panel header {
        padding: 12px 14px !important;
        background: rgba(12, 18, 34, 0.88) !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.07);
        align-items: center;
      }
      #amy-local-panel.amy-minimized {
        height: auto !important;
        max-height: none !important;
        width: min(320px, calc(100vw - 24px)) !important;
      }
      #amy-local-panel.amy-minimized .prompts,
      #amy-local-panel.amy-minimized #amy-local-messages,
      #amy-local-panel.amy-minimized form,
      #amy-local-panel.amy-minimized #amy-attach-preview,
      #amy-local-panel.amy-minimized #amy-orb-hero {
        display: none !important;
      }

      /* FULLSCREEN BUBBLE ORB MODE — CLEAN PRO MINIMALIST */
      #amy-local-panel.amy-bubble-fullscreen {
        position: fixed !important;
        inset: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100vw !important;
        height: 100dvh !important;
        max-height: 100dvh !important;
        border-radius: 0 !important;
        border: none !important;
        background: radial-gradient(circle at 50% 18%, rgba(37, 35, 92, 0.88) 0%, rgba(10, 14, 26, 0.98) 54%, rgba(5, 8, 15, 1) 100%) !important;
        z-index: 10005 !important;
      }
      #amy-orb-hero {
        display: none;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 14px 16px 12px;
        text-align: center;
        position: relative;
        flex-shrink: 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      }
      #amy-local-panel.amy-bubble-fullscreen #amy-orb-hero {
        display: flex;
      }
      .amy-bubble-stage {
        position: relative;
        width: 122px;
        height: 122px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 2px 0 6px;
        cursor: pointer;
        user-select: none;
      }
      .amy-bubble-halo {
        position: absolute;
        inset: -10px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(245, 196, 81, 0.38) 0%, rgba(99, 102, 241, 0.25) 48%, transparent 72%);
        filter: blur(16px);
        transition: transform 0.18s ease, opacity 0.25s ease, background 0.25s ease;
        opacity: 0.65;
      }
      .amy-bubble-ring {
        position: absolute;
        inset: 3px;
        border-radius: 50%;
        border: 1.5px solid rgba(245, 196, 81, 0.32);
        box-shadow: 0 0 24px rgba(245, 196, 81, 0.18), inset 0 0 14px rgba(99, 102, 241, 0.22);
        animation: amyBubblePulse 3.2s infinite ease-in-out;
      }
      .amy-bubble-core {
        position: relative;
        width: 92px;
        height: 92px;
        border-radius: 50%;
        background: radial-gradient(circle at 32% 28%, #fde68a 0%, #f59e0b 26%, #6366f1 68%, #0f172a 100%);
        box-shadow:
          0 0 32px rgba(245, 196, 81, 0.4),
          0 0 54px rgba(99, 102, 241, 0.3),
          inset 0 3px 14px rgba(255, 255, 255, 0.65),
          inset 0 -8px 20px rgba(15, 23, 42, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.12s ease-out, box-shadow 0.25s ease, background 0.25s ease;
      }
      .amy-bubble-core .orb-spark {
        font-size: 30px;
        line-height: 1;
        color: #fff;
        filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.45));
      }

      /* State: Listening */
      .amy-bubble-stage.listening .amy-bubble-halo {
        opacity: 0.95;
        background: radial-gradient(circle, rgba(16, 185, 129, 0.65) 0%, rgba(6, 182, 212, 0.42) 52%, transparent 74%);
      }
      .amy-bubble-stage.listening .amy-bubble-core {
        background: radial-gradient(circle at 32% 28%, #a7f3d0 0%, #10b981 30%, #0284c7 72%, #0f172a 100%);
        box-shadow: 0 0 38px rgba(16, 185, 129, 0.6), inset 0 3px 14px rgba(255, 255, 255, 0.75);
      }

      /* State: Speaking */
      .amy-bubble-stage.speaking .amy-bubble-halo {
        opacity: 1;
        background: radial-gradient(circle, rgba(236, 72, 153, 0.68) 0%, rgba(245, 196, 81, 0.48) 52%, transparent 75%);
        animation: amyBubbleSpeak 0.9s infinite alternate ease-in-out;
      }
      .amy-bubble-stage.speaking .amy-bubble-core {
        background: radial-gradient(circle at 32% 28%, #fbcfe8 0%, #ec4899 30%, #f59e0b 70%, #1e1b4b 100%);
        box-shadow: 0 0 44px rgba(236, 72, 153, 0.7), inset 0 3px 16px rgba(255, 255, 255, 0.8);
        animation: amyCoreSpeak 0.65s infinite alternate ease-in-out;
      }

      /* State: Thinking */
      .amy-bubble-stage.thinking .amy-bubble-halo {
        opacity: 0.95;
        background: radial-gradient(circle, rgba(245, 158, 11, 0.7) 0%, rgba(99, 102, 241, 0.5) 55%, transparent 75%);
      }

      @keyframes amyBubblePulse {
        0%, 100% { transform: scale(0.98); opacity: 0.7; }
        50% { transform: scale(1.05); opacity: 1; }
      }
      @keyframes amyBubbleSpeak {
        0% { transform: scale(1.02); }
        100% { transform: scale(1.24); }
      }
      @keyframes amyCoreSpeak {
        0% { transform: scale(0.98); }
        100% { transform: scale(1.08); }
      }

      .amy-orb-title {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.02em;
        color: #e2e8f0;
        margin-top: 2px;
      }
      .amy-vu-wrap {
        width: 140px;
        height: 4px;
        background: rgba(255, 255, 255, 0.08);
        border-radius: 999px;
        overflow: hidden;
        margin-top: 7px;
      }
      .amy-vu-fill {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #10b981, #38bdf8, #f5c451);
        border-radius: 999px;
        transition: width 0.08s ease;
      }
      .amy-orb-controls {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-top: 10px;
      }
      .amy-orb-btn {
        border-radius: 999px !important;
        padding: 8px 16px !important;
        font-size: 12px !important;
        font-weight: 700 !important;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(255, 255, 255, 0.07) !important;
        color: #f8fafc !important;
        border: 1px solid rgba(255, 255, 255, 0.14) !important;
      }
      .amy-orb-btn.call-active {
        background: linear-gradient(135deg, #ef4444, #dc2626) !important;
        color: #fff !important;
        border-color: rgba(239, 68, 68, 0.75) !important;
        box-shadow: 0 4px 16px rgba(239, 68, 68, 0.3);
      }
      .amy-orb-btn.muted-btn {
        background: rgba(239, 68, 68, 0.18) !important;
        color: #fca5a5 !important;
        border-color: rgba(239, 68, 68, 0.45) !important;
      }

      /* Horizontal Compact Quick Chips */
      #amy-local-panel .prompts {
        display: flex !important;
        flex-wrap: nowrap !important;
        overflow-x: auto !important;
        gap: 6px !important;
        padding: 8px 12px !important;
        scrollbar-width: none;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        flex-shrink: 0;
      }
      #amy-local-panel .prompts::-webkit-scrollbar {
        display: none;
      }
      #amy-local-panel .prompts button {
        white-space: nowrap !important;
        flex-shrink: 0 !important;
        border-radius: 999px !important;
        padding: 5px 11px !important;
        font-size: 11px !important;
        font-weight: 600 !important;
        background: rgba(255, 255, 255, 0.05) !important;
        color: #cbd5e1 !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
      }

      .amy-status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #10b981;
        box-shadow: 0 0 8px #10b981;
        display: inline-block;
      }
      .amy-status-dot.live {
        background: #ef4444;
        box-shadow: 0 0 10px #ef4444;
        animation: aiSparkBreathe 1.4s infinite ease-in-out;
      }

      /* Clean Modern Chat Bubbles */
      #amy-local-messages {
        padding: 12px 14px !important;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      #amy-local-messages p {
        margin: 0 !important;
        padding: 11px 14px !important;
        border-radius: 16px !important;
        font-size: 13.5px !important;
        line-height: 1.55 !important;
        max-width: 92%;
      }
      .amy-msg-user {
        align-self: flex-end;
        background: linear-gradient(135deg, rgba(245, 196, 81, 0.22), rgba(245, 196, 81, 0.1)) !important;
        border: 1px solid rgba(245, 196, 81, 0.35) !important;
        border-bottom-right-radius: 4px !important;
        color: #fef3c7 !important;
      }
      .amy-msg-ai {
        align-self: flex-start;
        background: rgba(255, 255, 255, 0.055) !important;
        border: 1px solid rgba(255, 255, 255, 0.09) !important;
        border-bottom-left-radius: 4px !important;
        color: #f1f5f9 !important;
      }
      .amy-msg-img {
        display: block;
        max-width: 100%;
        max-height: 170px;
        border-radius: 10px;
        margin-bottom: 6px;
        border: 1px solid rgba(255, 255, 255, 0.15);
      }
      #amy-attach-preview {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        background: rgba(15, 23, 42, 0.9);
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        font-size: 11px;
        color: #fde68a;
      }
      #amy-attach-preview img {
        width: 34px;
        height: 34px;
        object-fit: cover;
        border-radius: 6px;
        border: 1px solid rgba(245, 196, 81, 0.5);
      }
      .amy-hdr-btn {
        width: 32px !important;
        height: 32px !important;
        padding: 0 !important;
        border-radius: 9px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        background: rgba(255, 255, 255, 0.06) !important;
        color: #cbd5e1 !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        cursor: pointer;
      }
      .amy-hdr-btn:hover {
        background: rgba(245, 196, 81, 0.18) !important;
        color: #f5c451 !important;
        border-color: rgba(245, 196, 81, 0.4) !important;
      }
      .amy-bar-btn {
        width: 38px !important;
        height: 38px !important;
        padding: 0 !important;
        border-radius: 11px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        flex-shrink: 0 !important;
        background: rgba(255, 255, 255, 0.06) !important;
        color: #e2e8f0 !important;
        border: 1px solid rgba(255, 255, 255, 0.12) !important;
      }
      .amy-bar-btn.active-mic {
        background: rgba(239, 68, 68, 0.25) !important;
        color: #fca5a5 !important;
        border-color: rgba(239, 68, 68, 0.7) !important;
      }
      .amy-send-btn {
        width: 38px !important;
        height: 38px !important;
        padding: 0 !important;
        border-radius: 11px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        flex-shrink: 0 !important;
        background: linear-gradient(135deg, #f5c451, #d97706) !important;
        color: #090d16 !important;
        border: none !important;
      }
    `;
    document.head.appendChild(extraStyle);

    header.innerHTML = `
      <div style="flex:1;min-width:0;display:flex;align-items:center;gap:8px">
        <span id="amy-gemini-dot" class="amy-status-dot"></span>
        <strong style="color:#f8fafc;font-weight:800;font-size:14.5px;letter-spacing:0.02em">✦ AMY</strong>
      </div>
      <button type="button" id="amy-btn-fullbubble" class="amy-hdr-btn" title="Layar Penuh / Normal">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
      </button>
      <button type="button" id="amy-btn-min" class="amy-hdr-btn" title="Kecilkan Panel">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
      <button type="button" id="amy-btn-clear" class="amy-hdr-btn" title="Bersihkan Obrolan">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
      <button type="button" id="amy-local-close" class="amy-hdr-btn" aria-label="Tutup asisten" title="Tutup">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;

    small.textContent = '';

    // Area Gelembung Fullscreen Interaktif (Minimalis & Fokus Tanpa Teks Berlebihan)
    const orbHero = document.createElement('div');
    orbHero.id = 'amy-orb-hero';
    orbHero.innerHTML = `
      <div class="amy-bubble-stage" id="amy-bubble-stage" title="Ketuk gelembung untuk bicara atau menjawab langsung">
        <div class="amy-bubble-halo" id="amy-bubble-halo"></div>
        <div class="amy-bubble-ring"></div>
        <div class="amy-bubble-core" id="amy-bubble-core">
          <span class="orb-spark">✦</span>
        </div>
      </div>
      <div class="amy-orb-title" id="amy-orb-title">Ketuk Gelembung untuk Bicara</div>
      <div class="amy-vu-wrap"><div class="amy-vu-fill" id="amy-vu-fill"></div></div>
      <div class="amy-orb-controls">
        <button type="button" id="amy-orb-call-btn" class="amy-orb-btn">Mulai Suara</button>
        <button type="button" id="amy-orb-mute-btn" class="amy-orb-btn" hidden>Mic Aktif</button>
      </div>
    `;
    panel.insertBefore(orbHero, promptsWrap);

    const attachBar = document.createElement('div');
    attachBar.id = 'amy-attach-preview';
    attachBar.hidden = true;
    panel.insertBefore(attachBar, form);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.hidden = true;
    panel.appendChild(fileInput);

    const btnChartSnap = document.createElement('button');
    btnChartSnap.type = 'button';
    btnChartSnap.className = 'amy-bar-btn';
    btnChartSnap.title = 'Analisa Chart Gold di layar';
    btnChartSnap.innerHTML = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#f5c451" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`;

    const btnAttach = document.createElement('button');
    btnAttach.type = 'button';
    btnAttach.className = 'amy-bar-btn';
    btnAttach.title = 'Lampirkan gambar';
    btnAttach.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`;

    const btnVoice = document.createElement('button');
    btnVoice.type = 'button';
    btnVoice.id = 'amy-btn-voice';
    btnVoice.className = 'amy-bar-btn';
    btnVoice.title = 'Suara Live';
    btnVoice.innerHTML = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;

    const submitBtnEl = form.querySelector('button[type="submit"]');
    submitBtnEl.className = 'amy-send-btn';
    submitBtnEl.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;

    input.placeholder = 'Ketik pesan untuk AMY…';
    form.insertBefore(btnChartSnap, input);
    form.insertBefore(btnAttach, input);
    form.insertBefore(btnVoice, submitBtnEl);

    const statusDot = header.querySelector('#amy-gemini-dot');
    const closeBtn = header.querySelector('#amy-local-close');
    const fullBubbleBtn = header.querySelector('#amy-btn-fullbubble');
    const minBtn = header.querySelector('#amy-btn-min');
    const clearBtn = header.querySelector('#amy-btn-clear');

    const bubbleStage = orbHero.querySelector('#amy-bubble-stage');
    const bubbleCore = orbHero.querySelector('#amy-bubble-core');
    const orbTitle = orbHero.querySelector('#amy-orb-title');
    const vuFill = orbHero.querySelector('#amy-vu-fill');
    const orbCallBtn = orbHero.querySelector('#amy-orb-call-btn');
    const orbMuteBtn = orbHero.querySelector('#amy-orb-mute-btn');

    const statusBadge = {
      set textContent(_) {},
      set className(_) {}
    };

    function setOrbVisualState(mode, titleText) {
      bubbleStage.className = 'amy-bubble-stage' + (mode ? ' ' + mode : '');
      if (titleText) orbTitle.textContent = titleText;
      if (statusDot) {
        statusDot.className = 'amy-status-dot' + (isLiveConnected || mode ? ' live' : '');
      }
    }

    function setBubbleFullscreen(enabled) {
      isBubbleFullscreen = Boolean(enabled);
      panel.classList.remove('amy-minimized');
      if (isBubbleFullscreen) {
        panel.classList.add('amy-bubble-fullscreen');
      } else {
        panel.classList.remove('amy-bubble-fullscreen');
      }
      setTimeout(() => {
        messages.scrollTop = messages.scrollHeight;
      }, 60);
    }

    fullBubbleBtn.onclick = () => {
      setBubbleFullscreen(!isBubbleFullscreen);
    };

    closeBtn.onclick = () => {
      setBubbleFullscreen(false);
      panel.hidden = true;
      fab.hidden = false;
    };

    minBtn.onclick = () => {
      if (isBubbleFullscreen) {
        setBubbleFullscreen(false);
      }
      panel.classList.toggle('amy-minimized');
    };

    function renderBubble(role, text, opts = {}) {
      const p = document.createElement('p');
      p.className = role === 'user' ? 'amy-msg-user' : 'amy-msg-ai';
      if (opts.imageBase64) {
        const img = document.createElement('img');
        img.className = 'amy-msg-img';
        img.src = 'data:image/jpeg;base64,' + opts.imageBase64;
        img.alt = 'Chart';
        p.appendChild(img);
      }
      const span = document.createElement('span');
      const cleaned = role === 'user' ? String(text || '').replace(/^Sayang:\s*/i, '').trim() : cleanPlainText(String(text || '').replace(/^✦\s*AMY:\s*/i, ''));
      span.textContent = cleaned;
      p.appendChild(span);

      if (Array.isArray(opts.links)) {
        opts.links.forEach(l => {
          try {
            const a = document.createElement('a');
            a.href = l.path;
            a.textContent = l.label;
            a.style.marginTop = '8px';
            a.style.fontWeight = '600';
            a.style.fontSize = '12.5px';
            p.appendChild(a);
          } catch (_) {}
        });
      }
      messages.appendChild(p);
      while (messages.children.length > 40) messages.firstChild.remove();
      messages.scrollTop = messages.scrollHeight;
      return span;
    }

    function restoreSavedChat() {
      messages.innerHTML = '';
      const saved = loadHistory();
      if (!saved.length) {
        renderBubble(
          'model',
          'Halo, ada yang ingin kamu analisa di Chart Gold atau pelajari di Academy hari ini?'
        );
        return;
      }
      for (const item of saved) {
        renderBubble(item.role, item.text);
      }
    }

    clearBtn.onclick = () => {
      saveHistory([]);
      restoreSavedChat();
    };

    function setPendingAttachment(base64, label) {
      pendingImageBase64 = base64;
      pendingImageLabel = label || 'Gambar Chart';
      if (!base64) {
        attachBar.hidden = true;
        attachBar.innerHTML = '';
        return;
      }
      attachBar.hidden = false;
      attachBar.innerHTML = `
        <img src="data:image/jpeg;base64,${base64}" alt="Preview">
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${pendingImageLabel} siap dianalisa</span>
        <button type="button" id="amy-cancel-attach" style="padding:4px 8px;font-size:11px">✕</button>
      `;
      attachBar.querySelector('#amy-cancel-attach').onclick = () => setPendingAttachment('', '');
    }

    btnAttach.onclick = () => fileInput.click();
    fileInput.onchange = e => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxW = 960;
          let w = img.width;
          let h = img.height;
          if (w > maxW) {
            h = Math.round(h * (maxW / w));
            w = maxW;
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const b64 = canvas.toDataURL('image/jpeg', 0.82).replace(/^data:image\/\w+;base64,/, '');
          setPendingAttachment(b64, file.name);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
      fileInput.value = '';
    };

    btnChartSnap.onclick = () => {
      const snap = captureChartCanvasBase64();
      if (snap) {
        setPendingAttachment(snap, 'Kanvas Chart Gold Live');
        sendChatMessage('Tolong analisa Chart Gold di layar saya sekarang (struktur candle M15/M5, Dealing Range, dan area pantau Buy/Sell 100 pips).');
      } else {
        sendChatMessage('Bagaimana analisa struktur dan harga Gold di Mapping sekarang?');
      }
    };

    let isSending = false;
    async function sendChatMessage(rawText) {
      const q = String(rawText ?? input.value ?? '').trim();
      if (isSending || (!q && !pendingImageBase64)) return;
      isSending = true;
      input.value = '';

      let imgToSend = pendingImageBase64;
      if (!imgToSend && /\b(chart|grafik|candle|analisa|mapping|setup|entry|fvg|sbr|rbs|pdl|pdh|harga|xau|gold)\b/i.test(q)) {
        imgToSend = captureChartCanvasBase64();
      }
      setPendingAttachment('', '');

      renderBubble('user', q || 'Analisa gambar chart ini', { imageBase64: imgToSend });

      if (isLiveConnected && ws && ws.readyState === WebSocket.OPEN) {
        stopPlayback();
        isStreamingMic = false;
        setOrbVisualState('thinking', 'Memproses…');
        if (imgToSend) {
          ws.send(JSON.stringify({
            realtimeInput: { mediaChunks: [{ mimeType: 'image/jpeg', data: imgToSend }] }
          }));
        }

        // Jika pertanyaan menanyakan modul/level/materi tertentu, ambil isi materinya dan tempelkan kartunya ke chat
        let turnText = q || 'Tolong analisa gambar chart ini.';
        if (/\b(modul|level|bab|bagian|materi|pelajari|belajar|buka|fvg|order block|liquidity|bos|mss|ote|killzone|candle)\b/i.test(q)) {
          try {
            const r = await fetch(`/api/academy-reading?q=${encodeURIComponent(q)}`);
            if (r.ok) {
              const d = await r.json();
              if (d?.requestedLesson?.title) {
                const les = d.requestedLesson;
                renderBubble(
                  'model',
                  `${les.title}\n\n${(les.fullText || les.summary || '').slice(0, 1800)}`,
                  { links: [{ label: `Buka Materi: ${les.title}`, path: `/apps/academy/${les.relPath}` }] }
                );
                turnText =
                  `${q}\n\n[FAKTA MATERI ACADEMY YANG SUDAH DITEMPEL DI LAYAR PENGGUNA]:\n` +
                  `Judul: ${les.title} (apps/academy/${les.relPath})\n` +
                  `Isi Materi:\n${(les.fullText || les.summary || '').slice(0, 3500)}\n\n` +
                  `Jelaskan langsung isi materi di atas kepada pengguna dengan sapaan "kamu" secara jelas!`;
              }
            }
          } catch (_) {}
        }

        ws.send(JSON.stringify({
          clientContent: {
            turns: [{ role: 'user', parts: [{ text: turnText }] }],
            turnComplete: true
          }
        }));
        isSending = false;
        return;
      }

      setOrbVisualState('thinking', 'Menganalisa…');
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

      try {
        const hist = loadHistory();
        const appContext = await collectAmyAppContext(q);
        const resp = await fetch('/api/gemini-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: q,
            appContext,
            imageBase64: imgToSend,
            history: hist
          })
        });
        const data = await resp.json();

        let replyText = '';
        let links = [];
        if (root.AmyLocalAssistant) {
          try {
            const localRes = await root.AmyLocalAssistant.ask(q);
            if (Array.isArray(localRes?.links)) links = localRes.links;
            if (!data.ok && localRes?.text) replyText = localRes.text;
          } catch (_) {}
        }
        if (data.ok && data.reply) {
          replyText = data.reply;
        }
        if (lastRequestedLesson && lastRequestedLesson.relPath) {
          links.unshift({
            label: `Buka Materi: ${lastRequestedLesson.title}`,
            path: `/apps/academy/${lastRequestedLesson.relPath}`
          });
          if (lastRequestedLesson.nextLessonPath) {
            links.push({
              label: `Selanjutnya: ${lastRequestedLesson.nextLessonTitle || 'Lanjut'}`,
              path: `/apps/academy/${lastRequestedLesson.nextLessonPath}`
            });
          }
        }
        if (!replyText) {
          replyText = 'Maaf, koneksi sedang sibuk. Coba ketuk sekali lagi ya.';
        }

        renderBubble('model', replyText, { links });
        hist.push({ role: 'user', text: q });
        hist.push({ role: 'model', text: replyText });
        saveHistory(hist);
      } catch (_) {
        if (root.AmyLocalAssistant) {
          const fallback = await root.AmyLocalAssistant.ask(q);
          renderBubble('model', fallback.text, { links: fallback.links });
        }
      } finally {
        setOrbVisualState('', 'Ketuk Gelembung untuk Bicara');
        submitBtn.disabled = false;
        isSending = false;
        input.focus();
      }
    }

    form.onsubmit = e => {
      e.preventDefault();
      e.stopImmediatePropagation();
      sendChatMessage(input.value);
    };

    promptsWrap.innerHTML = '';
    [
      { label: 'Chart Gold', q: 'Analisa Chart Gold M15 & M5 di layar sekarang beserta zona Support/Demand dan Resistance/Supply untuk target 100 pips' },
      { label: 'Berita', q: 'Apa berita terbaru dan jadwal kalender ekonomi High Impact terdekat?' },
      { label: 'Jurnal', q: 'Evaluasi performa jurnal trading, winrate, dan refleksi emosi saya' },
      { label: 'Academy', q: 'Bagaimana progres belajar saya di Academy dan materi apa yang perlu saya pelajari selanjutnya?' }
    ].forEach(item => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = item.label;
      b.onclick = () => sendChatMessage(item.q);
      promptsWrap.appendChild(b);
    });

    // Fungsi penutup giliran bicara pengguna (mengirim sinyal audioStreamEnd: true agar Gemini langsung merespon tanpa menggantung!)
    function commitUserSpeechTurn() {
      if (!isLiveConnected || !ws || ws.readyState !== WebSocket.OPEN) return;
      if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
      }
      isUserSpeaking = false;
      isStreamingMic = false;
      vuFill.style.width = '0%';
      bubbleCore.style.transform = 'scale(1)';
      setOrbVisualState('thinking', 'Memproses…');

      try {
        ws.send(JSON.stringify({
          realtimeInput: { audioStreamEnd: true }
        }));
      } catch (_) {}

      // Pengaman: jika dalam 6 detik belum ada suara balasan, buka kembali mic secara otomatis
      setTimeout(() => {
        if (isLiveConnected && !isStreamingMic && activeSources.length === 0) {
          isStreamingMic = true;
          if (!isMicMuted) {
            setOrbVisualState('listening', 'Mendengarkan…');
          }
        }
      }, 6000);
    }

    // --- FITUR SUARA LIVE GEMINI 3.8 LIVE (AOEDE) + FULLSCREEN BUBBLE ---
    async function toggleLiveVoice() {
      if (isLiveConnected || isLiveConnecting) {
        stopLiveVoice();
        return;
      }

      if (!isBubbleFullscreen) {
        setBubbleFullscreen(true);
      }

      const cfg = await ensureGeminiConfig();
      if (!cfg || !cfg.apiKey) {
        renderBubble('model', 'API Key Gemini belum siap di server lokal.');
        return;
      }

      isLiveConnecting = true;
      btnVoice.classList.add('active-mic');
      orbCallBtn.classList.add('call-active');
      orbCallBtn.textContent = 'Menyambungkan…';
      setOrbVisualState('thinking', 'Menyambungkan…');

      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

        micAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        await micAudioCtx.resume();
        const nativeRate = micAudioCtx.sampleRate;

        playAudioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
        await playAudioCtx.resume();
        nextPlayTime = 0;

        const appContext = await collectAmyAppContext('Analisa chart dan semua modul');
        const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${cfg.apiKey}`;
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          const setupMsg = {
            setup: {
              model: cfg.liveModel || 'models/gemini-3.8-live',
              generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: cfg.voiceName || 'Aoede'
                    }
                  }
                }
              },
              tools: [
                {
                  functionDeclarations: [
                    {
                      name: 'open_academy_material',
                      description:
                        'Membuka dan mengambil isi lengkap materi belajar trading dari Amy FX Academy (Level 0 s.d. Level 6, Modul 01 s.d. Modul 10, atau Bagian 01 s.d. Bagian 36). WAJIB dipanggil setiap kali pengguna meminta membuka, mempelajari, atau menjelaskan Level, Modul, atau Bab tertentu (contoh: "pelajari modul 2", "buka level 1", "materi FVG", "tampilkan full materi").',
                      parameters: {
                        type: 'OBJECT',
                        properties: {
                          query: {
                            type: 'STRING',
                            description: 'Nama level, modul, bab, atau topik yang diminta pengguna (contoh: "modul 2", "level 1 bab 2", "level 0", "order block", "fvg").'
                          }
                        },
                        required: ['query']
                      }
                    }
                  ]
                }
              ],
              systemInstruction: {
                parts: [{
                  text:
                    `Kamu adalah AMY (✦ AMY), asisten suara pintar di dalam aplikasi Amy FX Pro.\n` +
                    `Berbicaralah 100% dalam Bahasa Indonesia yang ramah, cerdas, dan natural. Panggil pengguna dengan sebutan "kamu" (JANGAN panggil "Sayang", "Mas", atau sapaan lainnya).\n` +
                    `Pengguna adalah Pure Gold Scalper (XAU/USD timeframe M15 & M5, target presisi 100 pips / $10, zona waktu WITA).\n` +
                    `Kamu berada langsung di dalam layar aplikasi Amy FX Pro bersama pengguna, sehingga kamu bisa melihat langsung Chart Gold M15/M5 yang sedang tampil di layar pengguna beserta seluruh data aplikasi berikut:\n\n` +
                    `${appContext}\n\n` +
                    `ATURAN PENTING & AKSES PENUH MATERI PER LEVEL/MODUL:\n` +
                    `- Jawab singkat, padat, jelas, dan tuntas. Jangan gunakan simbol markdown seperti tanda bintang (*), pagar (#), atau garis (---).\n` +
                    `- AKSES PENUH SELURUH MATERI ACADEMY: Kamu memiliki akses penuh ke seluruh kurikulum Amy FX Academy (Level 0 s.d. Level 6 total 42 bab, 10 Modul Master, dan 36 Bagian / 222 bab) yang terdaftar di atas.\n` +
                    `- DILARANG KERAS MENOLAK PERMINTAAN BELAJAR: Saat pengguna meminta mempelajari atau membuka Level mana pun (Level 0–6), Modul mana pun (Modul 1–10), atau topik apa pun (misal "Coba kita pelajari modul 2", "Buka level 2", "Kita belajar bab berikutnya"), kamu WAJIB memanggil tool open_academy_material(query) dan langsung menjelaskan isi materinya dengan jelas! JANGAN PERNAH menolak atau menyuruh menyelesaikan Modul 01 dulu!\n` +
                    `- Saat tool open_academy_material dijalankan, kartu materi lengkapnya otomatis ditempelkan ke layar obrolan pengguna agar pengguna bisa membaca sambil mendengarkan penjelasanmu.\n` +
                    `- Ingatkan dengan jujur (Anti-Yes-Man) jika harga sedang di No-Trade Zone tengah atau jika pasar sedang tutup akhir pekan.`
                }]
              }
            }
          };
          ws.send(JSON.stringify(setupMsg));
        };

        ws.onmessage = async event => {
          let raw = '';
          if (typeof event.data === 'string') raw = event.data;
          else if (event.data instanceof Blob) raw = await event.data.text();

          try {
            const data = JSON.parse(raw);
            if (data.setupComplete) {
              isLiveConnecting = false;
              isLiveConnected = true;
              isStreamingMic = true;
              isMicMuted = false;
              orbCallBtn.textContent = 'Akhiri';
              orbMuteBtn.hidden = false;
              orbMuteBtn.className = 'amy-orb-btn';
              orbMuteBtn.textContent = 'Mic Aktif';
              setOrbVisualState('listening', 'Mendengarkan…');

              const snap = captureChartCanvasBase64();
              if (snap && ws && ws.readyState === WebSocket.OPEN) {
                lastCanvasSentAt = Date.now();
                ws.send(JSON.stringify({
                  realtimeInput: { mediaChunks: [{ mimeType: 'image/jpeg', data: snap }] }
                }));
              }
            }

            if (data.toolCall && Array.isArray(data.toolCall.functionCalls)) {
              setOrbVisualState('thinking', 'Membuka Materi…');
              const functionResponses = [];
              for (const fc of data.toolCall.functionCalls) {
                if (fc.name === 'open_academy_material') {
                  const q = String(fc.args?.query || '').trim();
                  let toolResultText = 'Materi tidak ditemukan.';
                  try {
                    const r = await fetch(`/api/academy-reading?q=${encodeURIComponent(q)}`);
                    if (r.ok) {
                      const d = await r.json();
                      const les = d.requestedLesson || d.lessonDetails;
                      if (les && les.title) {
                        const contentText = les.fullText || les.summary || '';
                        renderBubble(
                          'model',
                          `${les.title}\n\n${contentText.slice(0, 2200)}`,
                          {
                            links: [
                              { label: `Buka Materi: ${les.title}`, path: `/apps/academy/${les.relPath}` },
                              ...(les.nextLessonPath
                                ? [{ label: `Selanjutnya: ${les.nextLessonTitle || 'Lanjut'}`, path: `/apps/academy/${les.nextLessonPath}` }]
                                : [])
                            ]
                          }
                        );
                        toolResultText =
                          `BERHASIL MEMBUKA MATERI LENGKAP (Sudah ditempelkan ke layar obrolan pengguna):\n` +
                          `Judul: ${les.title}\n` +
                          `Lokasi: apps/academy/${les.relPath}\n` +
                          `Isi Lengkap Materi:\n${contentText.slice(0, 4200)}\n` +
                          (les.nextLessonTitle ? `Materi Urutan Berikutnya: ${les.nextLessonTitle} (apps/academy/${les.nextLessonPath})` : '');
                      } else if (d.catalogText) {
                        toolResultText = d.catalogText;
                      }
                    }
                  } catch (e) {
                    toolResultText = 'Gagal membaca materi: ' + e.message;
                  }
                  functionResponses.push({
                    id: fc.id,
                    name: fc.name,
                    response: { output: toolResultText }
                  });
                }
              }
              if (functionResponses.length > 0 && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ toolResponse: { functionResponses } }));
              }
            }

            if (data.serverContent) {
              const parts = data.serverContent.modelTurn?.parts || [];
              for (const part of parts) {
                if (part.inlineData?.data) {
                  playPcm24k(part.inlineData.data, speaking => {
                    if (!isLiveConnected) return;
                    if (speaking) {
                      setOrbVisualState('speaking', 'AMY Berbicara…');
                    } else {
                      setOrbVisualState(isMicMuted ? '' : 'listening', isMicMuted ? 'Mic Nonaktif' : 'Mendengarkan…');
                    }
                  });
                }
              }

              if (data.serverContent.inputTranscription?.text) {
                const t = data.serverContent.inputTranscription.text;
                if (!currentLiveUserBubble) {
                  currentLiveUserBubble = renderBubble('user', t);
                } else {
                  currentLiveUserBubble.textContent += t;
                  messages.scrollTop = messages.scrollHeight;
                }
              }

              if (data.serverContent.outputTranscription?.text) {
                const t = data.serverContent.outputTranscription.text.replace(/[*#`]/g, '');
                if (!currentLiveAiBubble) {
                  currentLiveAiBubble = renderBubble('model', t);
                } else {
                  currentLiveAiBubble.textContent += t;
                  messages.scrollTop = messages.scrollHeight;
                }
              }

              if (data.serverContent.turnComplete) {
                const hist = loadHistory();
                if (currentLiveUserBubble) {
                  hist.push({ role: 'user', text: currentLiveUserBubble.textContent });
                  currentLiveUserBubble = null;
                }
                if (currentLiveAiBubble) {
                  const cleanedFinal = cleanPlainText(currentLiveAiBubble.textContent);
                  currentLiveAiBubble.textContent = cleanedFinal;
                  hist.push({ role: 'model', text: cleanedFinal });
                  currentLiveAiBubble = null;
                }
                saveHistory(hist);

                setTimeout(() => {
                  if (isLiveConnected && activeSources.length === 0) {
                    isStreamingMic = true;
                    if (!isMicMuted) {
                      setOrbVisualState('listening', 'Mendengarkan…');
                    }
                  }
                }, 280);
              }
            }
          } catch (_) {}
        };

        ws.onerror = () => stopLiveVoice();
        ws.onclose = () => stopLiveVoice();

        const source = micAudioCtx.createMediaStreamSource(micStream);
        micProcessor = micAudioCtx.createScriptProcessor(4096, 1, 1);
        micProcessor.onaudioprocess = e => {
          if (!isLiveConnected || !ws || ws.readyState !== WebSocket.OPEN) return;

          if (micAudioCtx && micAudioCtx.state === 'suspended') {
            micAudioCtx.resume().catch(() => {});
          }

          if (isMicMuted || !isStreamingMic || activeSources.length > 0) {
            vuFill.style.width = '0%';
            return;
          }

          const inputData = e.inputBuffer.getChannelData(0);
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) sum += Math.abs(inputData[i]);
          const vol = sum / inputData.length;

          const vuPercent = Math.min(100, Math.round(vol * 650));
          vuFill.style.width = vuPercent + '%';
          const scale = 1 + Math.min(0.22, vol * 2.4);
          bubbleCore.style.transform = `scale(${scale.toFixed(2)})`;

          const pcm16 = downsampleTo16k(inputData, nativeRate);
          const bytes = new Uint8Array(pcm16.buffer);
          let bin = '';
          for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
          ws.send(JSON.stringify({
            realtimeInput: {
              audio: { mimeType: 'audio/pcm;rate=16000', data: btoa(bin) }
            }
          }));

          if (vol > VAD_SPEECH_THRESHOLD) {
            if (!isUserSpeaking) {
              isUserSpeaking = true;
              setOrbVisualState('listening', 'Mendengarkan…');
              if (Date.now() - lastCanvasSentAt > 12000) {
                const snap = captureChartCanvasBase64();
                if (snap) {
                  lastCanvasSentAt = Date.now();
                  ws.send(JSON.stringify({
                    realtimeInput: { mediaChunks: [{ mimeType: 'image/jpeg', data: snap }] }
                  }));
                }
              }
            }
            if (silenceTimer) {
              clearTimeout(silenceTimer);
              silenceTimer = null;
            }
          } else if (isUserSpeaking) {
            if (!silenceTimer) {
              silenceTimer = setTimeout(() => {
                commitUserSpeechTurn();
              }, VAD_SILENCE_MS);
            }
          }
        };
        source.connect(micProcessor);
        micProcessor.connect(micAudioCtx.destination);
      } catch (err) {
        renderBubble('model', 'Gagal mengaktifkan mikrofon: ' + err.message);
        stopLiveVoice();
      }
    }

    function stopLiveVoice() {
      isLiveConnecting = false;
      isLiveConnected = false;
      isUserSpeaking = false;
      if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
      }
      stopPlayback();
      if (ws) {
        try { ws.close(); } catch (_) {}
        ws = null;
      }
      if (micStream) {
        micStream.getTracks().forEach(t => t.stop());
        micStream = null;
      }
      if (micProcessor) {
        try { micProcessor.disconnect(); } catch (_) {}
        micProcessor = null;
      }
      if (micAudioCtx) {
        try { micAudioCtx.close(); } catch (_) {}
        micAudioCtx = null;
      }
      if (playAudioCtx) {
        try { playAudioCtx.close(); } catch (_) {}
        playAudioCtx = null;
      }
      btnVoice.classList.remove('active-mic');
      orbCallBtn.classList.remove('call-active');
      orbCallBtn.textContent = 'Mulai Suara';
      orbMuteBtn.hidden = true;
      vuFill.style.width = '0%';
      bubbleCore.style.transform = 'scale(1)';
      setOrbVisualState('', 'Ketuk Gelembung untuk Bicara');
      currentLiveAiBubble = null;
      currentLiveUserBubble = null;
    }

    bubbleStage.onclick = () => {
      if (!isLiveConnected && !isLiveConnecting) {
        toggleLiveVoice();
        return;
      }
      if (activeSources.length > 0) {
        stopPlayback();
        isStreamingMic = true;
        setOrbVisualState('listening', 'Mendengarkan…');
        return;
      }
      commitUserSpeechTurn();
    };

    orbCallBtn.onclick = toggleLiveVoice;
    orbMuteBtn.onclick = () => {
      if (!isLiveConnected) return;
      isMicMuted = !isMicMuted;
      if (isMicMuted) {
        orbMuteBtn.className = 'amy-orb-btn muted-btn';
        orbMuteBtn.textContent = 'Mic Nonaktif';
        setOrbVisualState('', 'Mic Nonaktif');
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
        }
      } else {
        orbMuteBtn.className = 'amy-orb-btn';
        orbMuteBtn.textContent = 'Mic Aktif';
        isStreamingMic = true;
        setOrbVisualState('listening', 'Mendengarkan…');
      }
    };

    btnVoice.onclick = toggleLiveVoice;

    restoreSavedChat();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(upgradeAssistantPanel, 60), { once: true });
  } else {
    setTimeout(upgradeAssistantPanel, 60);
  }
})(typeof window === 'undefined' ? globalThis : window);
