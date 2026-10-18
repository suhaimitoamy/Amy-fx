/**
 * Amy FX - Weak-Spot & Spaced-Repetition Quiz Suggester
 * Menghubungkan catatan kesalahan jurnal trading dengan kurikulum remedial Akademi
 * dan menghasilkan mini-kuis 3-soal pengingat cerdas (spaced repetition).
 */

export const MISTAKE_TOPIC_MAP = Object.freeze({
  moved_sl: {
    patterns: [/geser\s*sl/i, /pindah\s*sl/i, /move(d)?\s*sl/i, /sl\s*(digeser|dipindah)/i, /hapus\s*sl/i],
    category: 'trade-management-advanced',
    title: 'Manajemen Stop Loss & Proteksi Modal',
    lessonUrl: 'bagian-29-backtest-advanced/kapan-memindahkan-stop-loss-dan-kapan-tidak-seni-proteksi-modal.html',
    advice: 'Biarkan market membuktikan analisis Anda atau kenai SL awal. Menggeser SL menjauh hanya melipatgandakan risiko.'
  },
  early_exit: {
    patterns: [/early\s*exit/i, /keluar\s*(terlalu\s*)?cepat/i, /panik\s*close/i, /tutup\s*terburu/i, /premature\s*exit/i],
    category: 'trade-management-advanced',
    title: 'Target & Partial Take Profit Terukur',
    lessonUrl: 'bagian-29-backtest-advanced/target-dan-partial-take-profit-mengelola-hasil-secara-objektif.html',
    advice: 'Terapkan partial TP pada likuiditas terdekat (BSL/SSL) dan geser SL ke BE hanya setelah struktur internal terbentuk.'
  },
  fomo_chasing: {
    patterns: [/fomo/i, /chasing/i, /kejar\s*harga/i, /ketinggalan/i, /late\s*entry/i, /entry\s*pucuk/i],
    category: 'psikologi-trading',
    title: 'Psikologi Anti-FOMO & Disiplin Menunggu Retracement',
    lessonUrl: 'bagian-36-psikologi-ict-lanjutan/analysis-freeze.html',
    advice: 'Jika harga sudah jalan tanpa Anda, jangan dikejar. Selalu tunggu retracement ke zona Discount (Buy) atau Premium (Sell).'
  },
  revenge_overtrading: {
    patterns: [/revenge/i, /balas\s*dendam/i, /overtrading/i, /banyak\s*posisi/i, /marah/i, /tilt/i],
    category: 'risk-management',
    title: 'Risk Management & Daily Drawdown Cap',
    lessonUrl: 'bagian-34-prop-firm-mastery/manajemen-risiko-khusus-prop-firm.html',
    advice: 'Batas maksimal 2-3 trade per hari. Setelah 2 kekalahan beruntun, tutup laptop dan evaluasi pada sesi berikutnya.'
  },
  wrong_bias: {
    patterns: [/lawan\s*trend/i, /salah\s*bias/i, /counter\s*trend/i, /wrong\s*bias/i, /lawan\s*arah/i],
    category: 'bias-dan-top-down',
    title: 'Top-Down Analysis & Higher-Timeframe Bias',
    lessonUrl: 'bagian-31-ict-advanced-concepts/killzones-dan-true-day-open.html',
    advice: 'Tentukan Draw on Liquidity harian (D1/H4) sebelum mencari entry di lower timeframe (M15/M5).'
  },
  fvg_trap: {
    patterns: [/fvg\s*(gagal|trap|rusak)/i, /salah\s*fvg/i, /imbalance/i, /fvg\s*tembus/i],
    category: 'fvg-masterclass',
    title: 'Validitas FVG & Consequent Encroachment (50% CE)',
    lessonUrl: 'bagian-30-a-plus-setup-library/kapan-fvg-lebih-kuat-daripada-ob-memilih-senjata-yang-tepat.html',
    advice: 'FVG valid hanya jika didukung Displacement kuat dan tercipta setelah pembersihan likuiditas kunci.'
  },
  ob_trap: {
    patterns: [/ob\s*(gagal|trap|rusak)/i, /order\s*block\s*(gagal|tembus)/i, /salah\s*ob/i],
    category: 'order-block-masterclass',
    title: 'Karakteristik High-Probability Order Block',
    lessonUrl: 'bagian-30-a-plus-setup-library/order-block-yang-high-probability.html',
    advice: 'Order block yang berkualitas harus menyebabkan liquidity sweep dan displacement yang meninggalkan FVG murni.'
  },
  liquidity_trap: {
    patterns: [/stop\s*hunt/i, /sweep\s*palsu/i, /inducement/i, /terjebak\s*liquidity/i, /liquidity\s*trap/i],
    category: 'liquidity-masterclass',
    title: 'Memahami Inducement vs True Liquidity Sweep',
    lessonUrl: 'bagian-30-a-plus-setup-library/a-liquidity-dan-idm-setup.html',
    advice: 'Hati-hati dengan likuiditas internal (inducement) yang sengaja dibuat algoritma untuk memancing early retail trader.'
  }
});

/**
 * Menganalisis teks kesalahan atau array trade jurnal.
 * @param {Array|string} input - Teks kesalahan atau array obyek trade jurnal
 * @returns {Object} Hasil analisa weak spot dan rekomendasi modul
 */
export function analyzeWeakSpots(input) {
  const texts = [];
  if (Array.isArray(input)) {
    input.forEach(item => {
      if (typeof item === 'string') {
        texts.push(item);
      } else if (item && typeof item === 'object') {
        if (item.mistakes) texts.push(String(item.mistakes));
        if (item.mistake) texts.push(String(item.mistake));
        if (item.lessons) texts.push(String(item.lessons));
        if (item.evaluation) texts.push(String(item.evaluation));
      }
    });
  } else if (typeof input === 'string') {
    texts.push(input);
  }

  const scores = {};
  Object.keys(MISTAKE_TOPIC_MAP).forEach(k => { scores[k] = 0; });

  const combinedText = texts.join(' ');
  let totalMatches = 0;

  for (const [key, mapping] of Object.entries(MISTAKE_TOPIC_MAP)) {
    for (const pat of mapping.patterns) {
      const matches = combinedText.match(new RegExp(pat.source, 'gi'));
      if (matches) {
        scores[key] += matches.length;
        totalMatches += matches.length;
      }
    }
  }

  const sortedKeys = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
  const primaryKey = scores[sortedKeys[0]] > 0 ? sortedKeys[0] : 'fomo_chasing';
  const primaryRemedy = MISTAKE_TOPIC_MAP[primaryKey];

  const recommendations = sortedKeys
    .filter(k => scores[k] > 0)
    .slice(0, 3)
    .map(k => ({
      weaknessKey: k,
      frequency: scores[k],
      ...MISTAKE_TOPIC_MAP[k]
    }));

  return {
    primaryWeakness: primaryKey,
    hasIdentifiedWeakness: totalMatches > 0,
    totalMistakeCount: totalMatches,
    primaryRecommendation: {
      weaknessKey: primaryKey,
      ...primaryRemedy
    },
    recommendations: recommendations.length > 0 ? recommendations : [{
      weaknessKey: primaryKey,
      frequency: 0,
      ...primaryRemedy
    }]
  };
}

/**
 * Menghasilkan kuis 3-soal terarah berdasarkan kelemahan spesifik pengguna.
 * @param {Object|Array|string} weakSpotContext - Konteks kelemahan atau list catatan kesalahan
 * @param {Object} quizzesData - Data pertanyaan dari quizzes.json
 * @param {number} count - Jumlah soal kuis (default: 3)
 * @returns {Object} Payload kuis kilat siap saji
 */
export function generateWeakSpotQuiz(weakSpotContext, quizzesData, count = 3) {
  if (!quizzesData || typeof quizzesData !== 'object') {
    return { title: 'Mini Kuis Remedial', questions: [] };
  }

  const analysis = (weakSpotContext && typeof weakSpotContext === 'object' && weakSpotContext.primaryWeakness)
    ? weakSpotContext
    : analyzeWeakSpots(weakSpotContext);

  const targetCategory = analysis.primaryRecommendation.category;
  const secondaryCategory = analysis.recommendations[1]?.category || 'ict-core';

  let pool = [];
  if (Array.isArray(quizzesData[targetCategory])) {
    pool = pool.concat(quizzesData[targetCategory]);
  }
  if (Array.isArray(quizzesData[secondaryCategory]) && targetCategory !== secondaryCategory) {
    pool = pool.concat(quizzesData[secondaryCategory]);
  }

  // Fallback ke fondasi ICT murni jika pool masih kurang
  const fallbackCategories = ['ict-core', 'smart-money-concept', 'pemula-nol', 'fondasi-market'];
  for (const cat of fallbackCategories) {
    if (pool.length >= count * 2) break;
    if (Array.isArray(quizzesData[cat])) {
      pool = pool.concat(quizzesData[cat]);
    }
  }

  // Ambil pertanyaan secara acak terdistribusi tanpa duplikasi teks soal
  const picked = [];
  const seenQuestions = new Set();
  const shuffled = [...pool].sort(() => Math.random() - 0.5);

  for (const item of shuffled) {
    if (!item || !item.question || seenQuestions.has(item.question)) continue;
    seenQuestions.add(item.question);
    picked.push({
      question: item.question,
      options: [...(item.options || [])],
      correctIndex: item.correctIndex ?? 0,
      explanation: item.explanation || ''
    });
    if (picked.length >= count) break;
  }

  return {
    title: `Mini Kuis Remedial: ${analysis.primaryRecommendation.title}`,
    category: targetCategory,
    weaknessKey: analysis.primaryWeakness,
    advice: analysis.primaryRecommendation.advice,
    lessonUrl: analysis.primaryRecommendation.lessonUrl,
    questions: picked
  };
}

/**
 * Menghasilkan kuis Spaced Repetition yang memprioritaskan topik yang lama belum diuji.
 * @param {Object} quizzesData - Data pertanyaan dari quizzes.json
 * @param {Array} history - Riwayat jawaban [{ category, correct, timestamp }]
 * @param {number} count - Jumlah pertanyaan (default: 3)
 */
export function generateSpacedRepetitionQuiz(quizzesData, history = [], count = 3) {
  if (!quizzesData || typeof quizzesData !== 'object') {
    return { title: 'Spaced Repetition Review', questions: [] };
  }

  const categories = Object.keys(quizzesData).filter(c => Array.isArray(quizzesData[c]) && quizzesData[c].length > 0);
  if (categories.length === 0) return { title: 'Spaced Repetition Review', questions: [] };

  // Hitung recency & score per kategori dari history
  const stats = {};
  categories.forEach(cat => {
    stats[cat] = { attempts: 0, correct: 0, lastTested: 0 };
  });

  if (Array.isArray(history)) {
    history.forEach(h => {
      if (h && h.category && stats[h.category]) {
        stats[h.category].attempts += 1;
        if (h.correct) stats[h.category].correct += 1;
        stats[h.category].lastTested = Math.max(stats[h.category].lastTested, Number(h.timestamp || 0));
      }
    });
  }

  // Urutkan kategori berdasarkan yang paling jarang / lama diuji atau akurasi terendah
  const prioritizedCats = [...categories].sort((a, b) => {
    // Prioritas 1: belum pernah diuji
    if (stats[a].attempts === 0 && stats[b].attempts > 0) return -1;
    if (stats[b].attempts === 0 && stats[a].attempts > 0) return 1;

    // Prioritas 2: akurasi terendah
    const accA = stats[a].attempts > 0 ? stats[a].correct / stats[a].attempts : 0;
    const accB = stats[b].attempts > 0 ? stats[b].correct / stats[b].attempts : 0;
    if (accA !== accB) return accA - accB;

    // Prioritas 3: waktu pengujian paling lampau
    return stats[a].lastTested - stats[b].lastTested;
  });

  const picked = [];
  const seenQuestions = new Set();

  for (const cat of prioritizedCats) {
    const list = [...quizzesData[cat]].sort(() => Math.random() - 0.5);
    for (const q of list) {
      if (!seenQuestions.has(q.question)) {
        seenQuestions.add(q.question);
        picked.push({
          category: cat,
          question: q.question,
          options: [...q.options],
          correctIndex: q.correctIndex ?? 0,
          explanation: q.explanation || ''
        });
        break; // 1 soal per kategori teratas untuk diversitas
      }
    }
    if (picked.length >= count) break;
  }

  return {
    title: 'Kuis Spaced Repetition (Pengingat Ingatan Jangka Panjang)',
    questions: picked
  };
}
