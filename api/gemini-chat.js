import fs from 'node:fs';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  let apiKey = process.env.GEMINI_API_KEY?.trim() || '';
  if (!apiKey) {
    try {
      const rawKeys = fs.readFileSync('/root/.gemini_keys', 'utf-8');
      apiKey = rawKeys.split('\n').map(s => s.trim()).find(s => s.startsWith('AIza')) || rawKeys.split('\n')[0].trim();
    } catch (_) {}
  }
  if (!apiKey) {
    apiKey = 'AIzaSyAiB-yJ-wg6Pbd_dPiaO1Q7ZJ_DzLjqsTs';
  }

  if (!apiKey) {
    return res.status(500).json({ ok: false, error: 'API Key Gemini belum ditemukan' });
  }

  try {
    let payload = req.body;
    if (typeof payload === 'string' && payload) {
      try { payload = JSON.parse(payload); } catch (_) { payload = {}; }
    } else if (!payload || typeof payload !== 'object') {
      payload = {};
    }

    const message = String(payload.message || '').trim();
    const appContext = String(payload.appContext || '').trim();
    const imageBase64 = payload.imageBase64 ? String(payload.imageBase64).replace(/^data:image\/\w+;base64,/, '') : '';
    const history = Array.isArray(payload.history) ? payload.history.slice(-8) : [];

    const isAskingFullMaterial = /\b(full|lengkap|buka|pelajari|jelaskan|materi|modul|level|bab)\b/i.test(message);

    const sysPrompt =
      `Kamu adalah AMY (✦ AMY), asisten pintar resmi di dalam aplikasi Amy FX Pro milik pengguna.\n` +
      `Wajib panggil pengguna dengan sebutan "kamu" (JANGAN panggil "Sayang", "Mas", atau sapaan lainnya) dengan nada bicara yang ramah, suportif, dan profesional dalam Bahasa Indonesia yang luwes.\n` +
      `PROFIL TRADING PENGGUNA:\n` +
      `- Pure Gold Scalper (XAU/USD) timeframe M15 & M5 dengan target presisi 100 Pips ($10).\n` +
      `- Zona waktu acuan: WITA (UTC+8).\n` +
      `- Istilah wajib standar trader pro: Support / Demand, Resistance / Supply, No-Trade Zone (jangan entry di tengah), Dealing Range (Premium/Discount/EQ 50%), PDH/PDL, PWH/PWL, Asia High/Low, FVG, Order Block, BSL/SSL, MSS/BOS.\n` +
      `- Prinsip Anti-Yes-Man: Ingatkan dengan jujur jika harga berada di No-Trade Zone atau pasar sedang tutup akhir pekan.\n\n` +
      `DATA REAL-TIME LANGSUNG DARI APLIKASI AMY FX PRO SAAT INI:\n${appContext || 'Tidak ada konteks tambahan.'}\n\n` +
      `ATURAN ANTI-HALUSINASI ANGKA HARGA:\n` +
      `DILARANG KERAS MENGARANG ATAU MEMFABRIKASI ANGKA HARGA GOLD. Patokan harga riil XAU/USD wajib diambil dari data Konteks Aplikasi di atas (Harga Tampil di Layar / Candle Terakhir). Jika data harga belum terbaca di konteks, katakan dengan jujur "Data harga live sedang dimuat, mohon tunggu sebentar". JANGAN PERNAH mengarang angka seperti 4000+!\n\n` +
      `ATURAN JAWABAN & AKSES PENUH MATERI ACADEMY:\n` +
      `- DILARANG KERAS memakai simbol markdown seperti tanda bintang (* atau **), pagar (# atau ###), garis (---), atau backtick (\`). Tulis teks biasa yang bersih dan rapi, gunakan tanda titik bulat (•) untuk poin.\n` +
      `- AKSES PENUH SELURUH MATERI PER LEVEL & MODUL: Kamu memiliki akses penuh ke seluruh kurikulum Amy FX Academy (Level 0 s.d. Level 6 yang berisi 42 bab, 10 Modul Master, dan 36 Bagian / 222 bab yang tercantum pada DATA REAL-TIME di atas).\n` +
      `- DILARANG MENOLAK PERMINTAAN BELAJAR: Jika pengguna meminta membuka, mempelajari, atau menjelaskan Level mana pun (Level 0–6), Modul mana pun (Modul 1–10), atau Bab mana pun (misal "Coba kita pelajari modul 2", "Buka level 2", "Tampilkan full materi"), kamu WAJIB langsung membukakan dan menjelaskan isi materi tersebut secara jelas berdasarkan bagian "ISI LENGKAP MATERI YANG DIMINTA PENGGUNA" atau "DAFTAR LENGKAP KURIKULUM AMY FX ACADEMY" di atas! JANGAN PERNAH menolak atau menyuruh menyelesaikan Modul 01 dulu!\n` +
      `- Jika pengguna hanya bertanya "apa bacaan terakhirku?", mengaculah pada "Materi Terakhir Dibaca Pengguna" di atas.`;

    const contents = [];
    for (const h of history) {
      if (!h || !h.text) continue;
      contents.push({
        role: h.role === 'model' ? 'model' : 'user',
        parts: [{ text: String(h.text) }]
      });
    }

    const userParts = [];
    if (imageBase64) {
      userParts.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } });
    }
    userParts.push({ text: message || 'Tolong analisa gambar chart dan konteks aplikasi saat ini.' });
    contents.push({ role: 'user', parts: userParts });

    const modelsToTry = ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
    let replyText = '';
    const maxTokens = isAskingFullMaterial ? 900 : 420;

    for (const m of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
        const genConfig = m.includes('2.5')
          ? { temperature: 0.25, maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: 0 } }
          : { temperature: 0.25, maxOutputTokens: maxTokens };
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: sysPrompt }] },
            contents,
            generationConfig: genConfig
          })
        });
        if (resp.ok) {
          const result = await resp.json();
          const candidateText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText) {
            replyText = candidateText;
            break;
          }
        }
      } catch (_) {}
    }

    if (!replyText) {
      return res.status(502).json({ ok: false, error: 'Semua model Gemini sedang sibuk atau limit tercapai.' });
    }

    return res.status(200).json({ ok: true, reply: replyText });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Internal Server Error' });
  }
}
