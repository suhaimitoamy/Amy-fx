"use strict";

(function () {
  if (window.__amyFxMentorCustomerServiceV1) return;
  window.__amyFxMentorCustomerServiceV1 = true;

  const VERSION = "1.0.0";
  const ROUTING_KEY = "amyfx.mentor.routing.v1";
  const SCRIPT_URL = document.currentScript?.src || "";
  const ASSET_ROOT = SCRIPT_URL ? new URL("../../", SCRIPT_URL) : new URL("../../", location.href);
  const ROUTES = Object.freeze({
    home: "index.html",
    mapping: "apps/mapping/index.html",
    intel: "apps/market-intel/index.html",
    journal: "apps/journal/index.html",
    academy: "apps/academy/index.html"
  });

  const clean = value => String(value ?? "").trim();
  const lower = value => clean(value).toLowerCase().replace(/\s+/g, " ");
  const safeParse = (value, fallback = null) => {
    try { return JSON.parse(value); } catch { return fallback; }
  };

  function routeStats() {
    const saved = safeParse(localStorage.getItem(ROUTING_KEY), {}) || {};
    return {
      bot: Number(saved.bot) || 0,
      ai: Number(saved.ai) || 0,
      last_route: clean(saved.last_route),
      updated_at: clean(saved.updated_at)
    };
  }

  function recordRoute(route) {
    const stats = routeStats();
    if (route === "ai") stats.ai += 1;
    else stats.bot += 1;
    stats.last_route = route;
    stats.updated_at = new Date().toISOString();
    try { localStorage.setItem(ROUTING_KEY, JSON.stringify(stats)); } catch {}
    window.dispatchEvent(new CustomEvent("amyfx:mentor-route", { detail: { ...stats, route } }));
    return stats;
  }

  function workspace(context) {
    return context?.payload?.workspace || null;
  }

  function currentModule() {
    const path = location.pathname.toLowerCase();
    if (path.includes("/apps/mapping/")) return "mapping";
    if (path.includes("/apps/market-intel/")) return "intel";
    if (path.includes("/apps/journal/")) return "journal";
    if (path.includes("/apps/academy/")) return "academy";
    return "home";
  }

  function appVersion(ws) {
    const value = ws?.system?.app_version || window.AmyFXAppVersion || {};
    const name = clean(value.name || value.version || value.versionName);
    const code = Number(value.code || value.versionCode || 0);
    return { name: name || "belum diketahui", code: code || null };
  }

  function journalSummary(ws) {
    return ws?.trading?.journal?.summary || {};
  }

  function librarySummary(ws) {
    return ws?.trading?.library?.catalog || {};
  }

  function academyProgress(ws) {
    return ws?.academy?.progress || {};
  }

  function marketData(ws) {
    return ws?.market || {};
  }

  function providerStatus(ws) {
    const settings = ws?.system?.ai || ws?.system?.provider_status || ws?.system || {};
    const refs = Array.isArray(settings.key_refs) ? settings.key_refs : [];
    const providers = {};
    refs.forEach(ref => {
      const provider = lower(ref.provider || "unknown");
      providers[provider] = (providers[provider] || 0) + 1;
    });
    return {
      total: refs.length,
      providers,
      paidFallback: Boolean(settings.paid_fallback),
      vaultAvailable: ws?.system?.secure_vault?.available ?? Boolean(window.AmyNativeAI?.listSecrets)
    };
  }

  function marketFresh(ws) {
    const capturedAt = marketData(ws).captured_at;
    const timestamp = new Date(capturedAt || 0).getTime();
    return Number.isFinite(timestamp) && timestamp > 86_400_000;
  }

  function resultLabel(value) {
    const normalized = lower(value);
    if (normalized === "win") return "win";
    if (normalized === "loss") return "loss";
    if (["be", "break even", "breakeven"].includes(normalized)) return "break-even";
    return normalized || "belum diisi";
  }

  function navigate(moduleId) {
    const path = ROUTES[moduleId];
    if (!path) return false;
    const target = new URL(path, ASSET_ROOT).href;
    window.setTimeout(() => { location.href = target; }, 650);
    return true;
  }

  function menuAnswer() {
    return [
      "Saya bisa bantu lewat menu cepat:",
      "1. Status market  2. Buka Mapping  3. Cek Jurnal  4. Progres Academy  5. Status API  6. Versi aplikasi.",
      "Untuk analisis bebas, awali pertanyaan dengan ‘AI:’."
    ].join("\n");
  }

  function needsAi(question) {
    const value = lower(question);
    if (/^(ai|pakai ai|gunakan ai|tanya ai)\s*[:,-]/.test(value)) return true;
    if (/analisis|analisa|bedah|review mendalam|evaluasi mendalam|bandingkan|prediksi|forecast|buat strategi|susun strategi|jelaskan kenapa|kenapa market|pola kesalahan|psikologi trading|ajari saya|uji pemahaman/.test(value)) return true;
    if (/chart|setup|entry|bias|likuiditas|liquidity|fvg|order block|ict|smc/.test(value) && value.length > 70) return true;
    return false;
  }

  function stripAiPrefix(question) {
    return clean(question).replace(/^(?:ai|pakai ai|gunakan ai|tanya ai)\s*[:,-]\s*/i, "");
  }

  function customerServiceAnswer(question, context) {
    const value = lower(question);
    const ws = workspace(context);
    if (!ws) return null;

    if (!value || /^(halo|hai|hello|pagi|siang|sore|malam|tes|test)$/.test(value)) {
      return "Halo, saya Amy. Saya bisa membantu membuka fitur, mengecek status aplikasi, Jurnal, Academy, market, dan provider AI. Ketik ‘menu’ untuk melihat pilihan.";
    }

    if (/menu|bantuan|help|fitur apa|bisa apa|cara pakai/.test(value)) return menuAnswer();

    if (/siapa kamu|kamu apa/.test(value)) {
      return "Saya Amy, customer-service bot Amy FX. Sebagian besar permintaan saya jawab langsung dari data aplikasi; AI hanya dipakai untuk analisis yang lebih kompleks.";
    }

    if (/90%|10%|mode bot|mode customer|customer service/.test(value)) {
      const stats = routeStats();
      const total = stats.bot + stats.ai;
      const botPct = total ? Math.round((stats.bot / total) * 100) : 100;
      return `Mode aktif: customer-service bot sebagai jalur utama dengan target 90% bot dan 10% AI. Pemakaian sesi tersimpan saat ini ${botPct}% bot dari ${total} permintaan.`;
    }

    if (/status semua modul|ringkas status semua|status aplikasi|cek semua/.test(value)) {
      const journal = journalSummary(ws);
      const library = librarySummary(ws);
      const academy = academyProgress(ws);
      const providers = providerStatus(ws);
      return `Status Amy FX: market ${marketFresh(ws) ? "tersedia" : "belum valid"}, ${journal.total || 0} jurnal, ${library.total || 0} item Library, Academy ${academy.read_count || 0}/${academy.total_sections || 36}, dan ${providers.total} key AI terdaftar.`;
    }

    if (/apa yang perlu (aku|saya) (kerjakan|lakukan)|harus ngapain|langkah sekarang/.test(value)) {
      if (!marketFresh(ws)) return "Data market live belum valid. Buka Mapping lalu muat ulang data; Jurnal dan Academy tetap bisa digunakan sambil menunggu.";
      const recent = ws?.trading?.journal?.recent || [];
      if (!recent.length) return "Data market sudah tersedia. Buat rencana di Mapping, lalu catat hasil eksekusinya di Jurnal.";
      return "Data market tersedia dan Jurnal sudah berisi riwayat. Periksa setup aktif di Mapping, lalu pastikan rencana dan invalidasinya jelas sebelum entry.";
    }

    if (/buka|masuk|pergi ke|arahkan/.test(value)) {
      if (/mapping/.test(value)) { navigate("mapping"); return "Membuka Mapping…"; }
      if (/market intel|intel|berita|news|heatmap|liquidity|likuiditas/.test(value)) { navigate("intel"); return "Membuka Market Intel…"; }
      if (/jurnal|journal|library|catatan/.test(value)) { navigate("journal"); return "Membuka Jurnal dan Trading Library…"; }
      if (/academy|materi|belajar|kursus/.test(value)) { navigate("academy"); return "Membuka Amy FX Academy…"; }
      if (/beranda|home|profil/.test(value)) { navigate("home"); return "Membuka Beranda…"; }
    }

    if (/status market|market sekarang|harga sekarang|harga xau|data market|setup aktif|arah market/.test(value)) {
      const market = marketData(ws);
      if (!marketFresh(ws)) return "Data market live belum valid. Buka Mapping atau Market Intel dan muat ulang sebelum menggunakan informasi ini untuk keputusan trading.";
      const live = market.live_state || {};
      const setup = live.setup || live.bestSetup || market.active_and_recent_setups?.[0] || {};
      const price = Number(market.current_price || 0);
      const state = clean(setup.state || setup.status || live.directionDecision?.signal || "WAIT");
      return `XAU/USD ${price > 0 ? `terakhir ${price}` : "sudah memiliki data live"}. Status setup saat ini ${state || "WAIT"}; untuk alasan arah dan invalidasi, gunakan “AI: analisis setup sekarang”.`;
    }

    if (/jumlah jurnal|berapa jurnal|statistik jurnal|win rate|berapa win|berapa loss|hasil trading/.test(value)) {
      const journal = journalSummary(ws);
      return `Jurnal berisi ${journal.total || 0} entry: ${journal.win || 0} win, ${journal.loss || 0} loss, dan ${journal.break_even || 0} break-even. Win rate tercatat ${journal.win_rate == null ? "belum cukup data" : `${journal.win_rate}%`}.`;
    }

    if (/jurnal terakhir|entry terakhir|trade terakhir/.test(value)) {
      const row = ws?.trading?.journal?.recent?.[0];
      if (!row) return "Belum ada entry Jurnal yang bisa ditampilkan.";
      return `Entry terakhir: ${clean(row.title || row.market || row.pair || "Trade")} dengan hasil ${resultLabel(row.result)}${row.date ? ` pada ${row.date}` : ""}.`;
    }

    if (/jumlah library|berapa file|isi library|koleksi|materi tersimpan|jumlah materi/.test(value)) {
      const library = librarySummary(ws);
      const categories = Object.entries(library.by_category || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => `${name} ${count}`).join(", ");
      return `Trading Library berisi ${library.total || 0} item${categories ? `; kategori terbanyak: ${categories}` : ""}.`;
    }

    if (/progres academy|sampai mana belajar|materi terakhir|belajar ku|belajarku/.test(value)) {
      const academy = academyProgress(ws);
      const last = clean(academy.last_title);
      return `Progres Academy ${academy.read_count || 0} dari ${academy.total_sections || 36} bagian (${academy.percentage || 0}%)${last ? `. Materi terakhir: ${last}` : ""}.`;
    }

    if (/status api|status key|provider|gemini|openrouter|deepseek|secure vault|api key/.test(value)) {
      const status = providerStatus(ws);
      const labels = Object.entries(status.providers).map(([name, count]) => `${name} ${count}`).join(", ") || "belum ada";
      return `Secure vault ${status.vaultAvailable ? "aktif" : "belum tersedia"}. Key terdaftar: ${labels}; DeepSeek ${status.paidFallback ? "diizinkan sebagai fallback berbayar" : "belum diizinkan sebagai fallback berbayar"}.`;
    }

    if (/versi|version|update aplikasi|cek update/.test(value)) {
      const version = appVersion(ws);
      return `Versi Amy FX Preview saat ini ${version.name}${version.code ? ` dengan version code ${version.code}` : ""}. Pemeriksaan update dapat dibuka dari Profil → Versi Aplikasi.`;
    }

    if (/error|bug|tidak bisa|gagal|macet|freeze|lambat|slow|loading terus|tidak merespons/.test(value)) {
      const status = providerStatus(ws);
      if (/ai|mentor|jawab|respons|loading|provider|api/.test(value)) {
        return status.total ? "Provider AI terdaftar. Tutup lalu buka kembali panel Amy; bila masih gagal, buka Pengaturan Amy dan periksa provider yang aktif." : "Belum ada key AI yang siap digunakan. Buka Pengaturan Amy lalu tambahkan Gemini, OpenRouter, atau DeepSeek ke secure vault.";
      }
      return "Sebutkan fitur yang bermasalah—Mapping, Market Intel, Jurnal, Academy, atau update—agar saya menjalankan pemeriksaan yang tepat.";
    }

    if (/hapus|delete|reset|bersihkan semua|ubah data|edit data/.test(value)) {
      return "Akses customer-service Amy bersifat read-only untuk melindungi data. Perubahan atau penghapusan tetap harus dilakukan melalui menu fitur terkait.";
    }

    if (/terima kasih|makasih|thanks/.test(value)) return "Sama-sama. Ketik ‘menu’ untuk bantuan lain.";

    return null;
  }

  function fallbackAnswer() {
    return "Saya belum menemukan menu yang tepat. Ketik ‘menu’ untuk bantuan cepat, atau awali dengan ‘AI:’ bila pertanyaan memerlukan analisis bebas.";
  }

  function installAskWrapper() {
    const os = window.AmyFXOS;
    if (!os?.ask || os.__amyCustomerServiceV1) return Boolean(os?.__amyCustomerServiceV1);
    const originalAsk = os.ask.bind(os);

    const ask = async function (question, options = {}) {
      const context = options.context || await os.buildContext?.(options.sourceModule || currentModule());
      if (needsAi(question)) {
        recordRoute("ai");
        return originalAsk(stripAiPrefix(question), { ...options, context });
      }

      const answer = customerServiceAnswer(question, context) || fallbackAnswer();
      recordRoute("bot");
      return {
        text: answer,
        provider: "amy-bot",
        model: "customer-service-90-v1",
        source: "Bot Amy FX",
        route: "bot",
        context
      };
    };

    window.AmyFXOS = Object.freeze({
      ...os,
      ask,
      customerService: Object.freeze({
        version: VERSION,
        target: { bot: 90, ai: 10 },
        answer: customerServiceAnswer,
        needsAi,
        stats: routeStats
      }),
      __amyCustomerServiceV1: true
    });
    window.dispatchEvent(new CustomEvent("amyfx:customer-service-ready", { detail: { version: VERSION, bot: 90, ai: 10 } }));
    return true;
  }

  function updateUi() {
    const input = document.querySelector("[data-amy-input]");
    if (input) input.placeholder = "Pilih bantuan atau ketik AI: untuk analisis";

    const health = document.querySelector("[data-amy-health]");
    if (health && !health.dataset.amyCustomerService) {
      health.dataset.amyCustomerService = "1";
      health.textContent = `${health.textContent} • BOT 90% / AI 10%`;
    }

    const starters = document.querySelector("[data-amy-starters]");
    if (starters && starters.dataset.amyCustomerService !== "1") {
      starters.dataset.amyCustomerService = "1";
      starters.innerHTML = [
        ["Status semua modul", "Status"],
        ["Buka Mapping", "Mapping"],
        ["Cek statistik jurnal", "Jurnal"],
        ["Progres Academy", "Academy"],
        ["Status API", "API"],
        ["AI: analisis kondisi yang tersedia", "Tanya AI"]
      ].map(([prompt, label]) => `<button type="button" data-starter="${prompt}">${label}</button>`).join("");
    }
  }

  function boot() {
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      const installed = installAskWrapper();
      updateUi();
      if ((installed && document.querySelector("[data-amy-input]")) || attempts >= 300) clearInterval(timer);
    }, 60);
    window.setTimeout(() => clearInterval(timer), 25_000);

    const target = document.body || document.documentElement;
    if (target) new MutationObserver(() => {
      installAskWrapper();
      updateUi();
    }).observe(target, { childList: true, subtree: true });
    window.addEventListener("focus", () => { installAskWrapper(); updateUi(); });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) { installAskWrapper(); updateUi(); } });
  }

  window.AmyFXCustomerService = Object.freeze({
    version: VERSION,
    target: Object.freeze({ bot: 90, ai: 10 }),
    needsAi,
    answer: customerServiceAnswer,
    stats: routeStats,
    navigate
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
