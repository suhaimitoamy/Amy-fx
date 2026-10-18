/**
 * Amy FX - Weak-Spot & Spaced-Repetition Quiz Suggester (Browser Companion)
 * Global namespace: window.AmyFXWeakSpotSuggester
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AmyFXWeakSpotSuggester = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var MISTAKE_TOPIC_MAP = {
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
  };

  function analyzeWeakSpots(input) {
    var texts = [];
    if (Array.isArray(input)) {
      input.forEach(function (item) {
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

    var scores = {};
    Object.keys(MISTAKE_TOPIC_MAP).forEach(function (k) { scores[k] = 0; });

    var combinedText = texts.join(' ');
    var totalMatches = 0;

    for (var key in MISTAKE_TOPIC_MAP) {
      var mapping = MISTAKE_TOPIC_MAP[key];
      for (var i = 0; i < mapping.patterns.length; i++) {
        var matches = combinedText.match(new RegExp(mapping.patterns[i].source, 'gi'));
        if (matches) {
          scores[key] += matches.length;
          totalMatches += matches.length;
        }
      }
    }

    var sortedKeys = Object.keys(scores).sort(function (a, b) { return scores[b] - scores[a]; });
    var primaryKey = scores[sortedKeys[0]] > 0 ? sortedKeys[0] : 'fomo_chasing';
    var primaryRemedy = MISTAKE_TOPIC_MAP[primaryKey];

    var recommendations = sortedKeys
      .filter(function (k) { return scores[k] > 0; })
      .slice(0, 3)
      .map(function (k) {
        return Object.assign({ weaknessKey: k, frequency: scores[k] }, MISTAKE_TOPIC_MAP[k]);
      });

    return {
      primaryWeakness: primaryKey,
      hasIdentifiedWeakness: totalMatches > 0,
      totalMistakeCount: totalMatches,
      primaryRecommendation: Object.assign({ weaknessKey: primaryKey }, primaryRemedy),
      recommendations: recommendations.length > 0 ? recommendations : [Object.assign({ weaknessKey: primaryKey, frequency: 0 }, primaryRemedy)]
    };
  }

  function generateWeakSpotQuiz(weakSpotContext, quizzesData, count) {
    count = count || 3;
    if (!quizzesData || typeof quizzesData !== 'object') {
      return { title: 'Mini Kuis Remedial', questions: [] };
    }

    var analysis = (weakSpotContext && typeof weakSpotContext === 'object' && weakSpotContext.primaryWeakness)
      ? weakSpotContext
      : analyzeWeakSpots(weakSpotContext);

    var targetCategory = analysis.primaryRecommendation.category;
    var secondaryCategory = analysis.recommendations[1] ? analysis.recommendations[1].category : 'ict-core';

    var pool = [];
    if (Array.isArray(quizzesData[targetCategory])) {
      pool = pool.concat(quizzesData[targetCategory]);
    }
    if (Array.isArray(quizzesData[secondaryCategory]) && targetCategory !== secondaryCategory) {
      pool = pool.concat(quizzesData[secondaryCategory]);
    }

    var fallbackCategories = ['ict-core', 'smart-money-concept', 'pemula-nol', 'fondasi-market'];
    for (var i = 0; i < fallbackCategories.length; i++) {
      if (pool.length >= count * 2) break;
      var cat = fallbackCategories[i];
      if (Array.isArray(quizzesData[cat])) {
        pool = pool.concat(quizzesData[cat]);
      }
    }

    var picked = [];
    var seen = {};
    var shuffled = pool.slice().sort(function () { return Math.random() - 0.5; });

    for (var j = 0; j < shuffled.length; j++) {
      var item = shuffled[j];
      if (!item || !item.question || seen[item.question]) continue;
      seen[item.question] = true;
      picked.push({
        question: item.question,
        options: (item.options || []).slice(),
        correctIndex: item.correctIndex || 0,
        explanation: item.explanation || ''
      });
      if (picked.length >= count) break;
    }

    return {
      title: 'Mini Kuis Remedial: ' + analysis.primaryRecommendation.title,
      category: targetCategory,
      weaknessKey: analysis.primaryWeakness,
      advice: analysis.primaryRecommendation.advice,
      lessonUrl: analysis.primaryRecommendation.lessonUrl,
      questions: picked
    };
  }

  function generateSpacedRepetitionQuiz(quizzesData, history, count) {
    count = count || 3;
    history = history || [];
    if (!quizzesData || typeof quizzesData !== 'object') {
      return { title: 'Spaced Repetition Review', questions: [] };
    }

    var categories = Object.keys(quizzesData).filter(function (c) {
      return Array.isArray(quizzesData[c]) && quizzesData[c].length > 0;
    });
    if (categories.length === 0) return { title: 'Spaced Repetition Review', questions: [] };

    var stats = {};
    categories.forEach(function (cat) {
      stats[cat] = { attempts: 0, correct: 0, lastTested: 0 };
    });

    history.forEach(function (h) {
      if (h && h.category && stats[h.category]) {
        stats[h.category].attempts += 1;
        if (h.correct) stats[h.category].correct += 1;
        stats[h.category].lastTested = Math.max(stats[h.category].lastTested, Number(h.timestamp || 0));
      }
    });

    var prioritized = categories.slice().sort(function (a, b) {
      if (stats[a].attempts === 0 && stats[b].attempts > 0) return -1;
      if (stats[b].attempts === 0 && stats[a].attempts > 0) return 1;
      var accA = stats[a].attempts > 0 ? stats[a].correct / stats[a].attempts : 0;
      var accB = stats[b].attempts > 0 ? stats[b].correct / stats[b].attempts : 0;
      if (accA !== accB) return accA - accB;
      return stats[a].lastTested - stats[b].lastTested;
    });

    var picked = [];
    var seen = {};

    for (var i = 0; i < prioritized.length; i++) {
      var cat = prioritized[i];
      var list = quizzesData[cat].slice().sort(function () { return Math.random() - 0.5; });
      for (var k = 0; k < list.length; k++) {
        var q = list[k];
        if (!seen[q.question]) {
          seen[q.question] = true;
          picked.push({
            category: cat,
            question: q.question,
            options: q.options.slice(),
            correctIndex: q.correctIndex || 0,
            explanation: q.explanation || ''
          });
          break;
        }
      }
      if (picked.length >= count) break;
    }

    return {
      title: 'Kuis Spaced Repetition (Pengingat Ingatan Jangka Panjang)',
      questions: picked
    };
  }

  return {
    MISTAKE_TOPIC_MAP: MISTAKE_TOPIC_MAP,
    analyzeWeakSpots: analyzeWeakSpots,
    generateWeakSpotQuiz: generateWeakSpotQuiz,
    generateSpacedRepetitionQuiz: generateSpacedRepetitionQuiz
  };
});
