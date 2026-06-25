/* Amy FX Journal AI Prompt Builder v2.0 — konteks terstruktur untuk analisa AI */
window.AmyAIPrompt = (function(){
  'use strict';

  function buildSummaryPrompt(entries, question) {
    if (!entries || entries.length === 0) return null;

    const closed = entries.filter(e => e.result);
    const total  = closed.length;
    const wins   = closed.filter(e => e.result === 'WIN').length;
    const losses = closed.filter(e => e.result === 'LOSS').length;
    const winRate = total > 0 ? ((wins/total)*100).toFixed(1) : '0';

    // Ringkas 30 trade terakhir (bukan full data mentah)
    const recent = closed.slice(-30).map((e, i) => {
      return `${i+1}. ${e.setupType||'?'} | ${e.result} | RR:${e.riskReward||'?'} | Mistake:${e.mistake||'-'} | Rating:${e.rating||'?'}/5`;
    }).join('\n');

    // Kesalahan paling sering
    const mistakeMap = {};
    closed.forEach(e => { if(e.mistake) mistakeMap[e.mistake] = (mistakeMap[e.mistake]||0)+1; });
    const topMistakes = Object.entries(mistakeMap).sort((a,b)=>b[1]-a[1]).slice(0,5)
      .map(([m,c]) => `- ${m}: ${c}x`).join('\n');

    // Setup terbaik vs terburuk
    const setupMap = {};
    closed.forEach(e => {
      const st = e.setupType || 'Unknown';
      if (!setupMap[st]) setupMap[st] = { t:0, w:0 };
      setupMap[st].t++;
      if (e.result === 'WIN') setupMap[st].w++;
    });
    const setupSummary = Object.entries(setupMap).map(([s,d]) =>
      `- ${s}: ${d.w}/${d.t} (${((d.w/d.t)*100).toFixed(0)}% WR)`
    ).join('\n');

    return `Kamu adalah coach trading ICT/SMC berpengalaman. Analisa jurnal trading berikut dan berikan feedback yang jujur, spesifik, dan actionable dalam bahasa Indonesia.

=== DATA JURNAL ===
Total trade dicatat: ${total}
Win Rate: ${winRate}%
Win: ${wins} | Loss: ${losses}

=== PERFORMA PER SETUP ===
${setupSummary || '(tidak ada data)'}

=== KESALAHAN YANG SERING TERJADI ===
${topMistakes || '(tidak ada data)'}

=== 30 TRADE TERAKHIR (ringkas) ===
${recent}

=== PERTANYAAN USER ===
${question || 'Berikan analisa menyeluruh tentang pola trading saya. Apa yang harus diperbaiki dan apa yang sudah baik?'}

=== FORMAT JAWABAN ===
1. Ringkasan performa (2-3 kalimat jujur)
2. Kekuatan yang teridentifikasi (poin-poin konkret)
3. Kelemahan utama yang perlu diperbaiki (poin-poin spesifik)
4. Pola kesalahan psikologis yang terdeteksi
5. Saran perbaikan yang actionable untuk minggu depan (maksimal 3 saran)

Jangan terlalu panjang. Fokus pada hal yang paling penting dan berdampak.`;
  }

  function buildSingleTradePrompt(entry) {
    if (!entry) return null;
    return `Evaluasi satu trade berikut dari perspektif ICT/SMC:

Setup: ${entry.setupType || '-'}
HTF Bias: ${entry.htfBias || '-'}
Timeframe: ${entry.timeframe || '-'}
Entry: ${entry.entryArea || '-'} | SL: ${entry.stopLoss || '-'} | TP: ${entry.takeProfit1 || '-'}
Hasil: ${entry.result || 'belum selesai'}
RR Aktual: ${entry.riskReward || '-'}
Apakah mengikuti rencana: ${entry.followedPlan || '-'}
Kesalahan: ${entry.mistake || '-'}
Catatan trader: ${entry.lesson || entry.planNote || '-'}

Berikan evaluasi singkat (maksimal 150 kata):
1. Apakah setup ini valid secara ICT/SMC?
2. Apakah eksekusi sudah benar?
3. Satu hal yang bisa diperbaiki di trade sejenis berikutnya.`;
  }

  return { buildSummaryPrompt, buildSingleTradePrompt };
})();
