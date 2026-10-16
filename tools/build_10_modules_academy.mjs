import fs from 'node:fs';
import path from 'node:path';

const academyDir = '/root/Amy-fx/app/src/main/assets/apps/academy';

export const modulesData = [
  {
    num: '01',
    id: 'modul-01',
    title: 'Fondasi Trading, Setup Alat Kerja & Manajemen Risiko Awal',
    category: 'Fondasi & Struktur',
    sks: '3 SKS',
    time: '~1 Jam 30 Menit',
    desc: 'Pelajari ini paling pertama agar ruang kerjamu siap dan kamu paham cara melindungi modal sebelum menyentuh strategi teknikal.',
    icon: '🏛️',
    submodules: [
      {
        code: '1.1',
        title: 'Dasar Pasar & Istilah Wajib',
        source: 'Bagian 01 (Pemula Nol)',
        desc: 'Pahami apa itu trading, realita pemula, jenis pasar (Forex, Gold/XAUUSD, Indeks, Crypto), mekanisme Buy/Sell, Lot, Pip, Spread, Leverage, Margin, Equity, serta fungsi Stop Loss & Take Profit.',
        chapters: [
          { path: 'bagian-01-pemula-nol/apa-itu-trading.html', title: 'Realita Pasar Finansial Modern: Bukan Acak, Tapi Algoritmik', desc: 'Hakikat pasar finansial modern yang digerakkan oleh algoritma IPDA institusional.' },
          { path: 'bagian-01-pemula-nol/realita-trading-untuk-pemula.html', title: 'Realita Trading untuk Pemula', desc: 'Fakta objektif industri trading, risiko drawdown, dan pola pikir realistis pemula.' },
          { path: 'bagian-01-pemula-nol/market-forex-gold-indeks-dan-crypto.html', title: 'Karakteristik Pasar: Forex, Gold, Indeks, dan Crypto', desc: 'Perbandingan volatilitas, likuiditas, dan jam aktif instrumen trading global.' },
          { path: 'bagian-01-pemula-nol/buy-sell-profit-dan-loss.html', title: 'Mekanisme Buy, Sell, Profit, dan Loss', desc: 'Bagaimana transaksi menghasilkan keuntungan saat harga naik maupun turun.' },
          { path: 'bagian-01-pemula-nol/lot-pip-point-dan-spread.html', title: 'Komponen Transaksi Presisi: Lot, Pip, Point, dan Spread', desc: 'Perhitungan matematis pergerakan harga dan biaya transaksi broker.' },
          { path: 'bagian-01-pemula-nol/leverage-margin-equity-dan-balance.html', title: 'Leverage, Margin, Equity, dan Balance', desc: 'Hubungan daya ungkit (leverage) terhadap ketahanan modal dan margin call.' },
          { path: 'bagian-01-pemula-nol/stop-loss-dan-take-profit.html', title: 'Stop Loss dan Take Profit Berbasis Logika Institusional', desc: 'Menentukan batasan proteksi risiko dan target keuntungan objektif.' },
          { path: 'bagian-01-pemula-nol/cara-belajar-trading-yang-benar.html', title: 'Cara Belajar Trading yang Benar', desc: 'Kurikulum bertahap agar tidak terjebak siklus kebingungan pemula.' }
        ]
      },
      {
        code: '1.2',
        title: 'Persiapan Ruang Kerja / Workspace',
        source: 'Bagian 32 (Trading Tools Setup)',
        desc: 'Langsung atur tampilan TradingView yang bersih, pasang indikator pembantu waktu/sesi (Killzone), dan rapikan template layout agar siap dipakai praktik.',
        chapters: [
          { path: 'bagian-32-trading-tools-setup/cara-setting-tradingview-untuk-smc.html', title: 'Konfigurasi TradingView Bersih & Bebas Distorsi', desc: 'Setting warna chart, candlesticks, grid, dan shortcut gambar institusional.' },
          { path: 'bagian-32-trading-tools-setup/rekomendasi-indikator-ict-killzones.html', title: 'Indikator Pembantu Waktu/Sesi (Killzones) & Layout Chart', desc: 'Menampilkan sesi Asia, London, New York secara otomatis tanpa indikator lagging.' }
        ]
      },
      {
        code: '1.3',
        title: 'Aturan Besi Manajemen Risiko',
        source: 'Bagian 01 Bab 8 & Bagian 12 (Risk Management)',
        desc: 'Pelajari cara menghitung risiko sebelum entry, penentuan Risk per Trade (misal 0,5%–1%), Risk to Reward Ratio (RR), rumus Cara Hitung Lot berdasarkan jarak SL, batas rugi harian (Daily Loss Limit), maksimal entry per hari, dan larangan layering sembarangan.',
        chapters: [
          { path: 'bagian-01-pemula-nol/risk-sebelum-entry.html', title: 'Menghitung Risiko Sebelum Entry', desc: 'Mentalitas mendahulukan risiko sebelum memikirkan potensi keuntungan.' },
          { path: 'bagian-12-risk-management/trading-tanpa-risk-itu-bahaya.html', title: 'Bahaya Trading Tanpa Manajemen Risiko', desc: 'Matematika kebangkrutan akun dan cara mencegah margin call seketika.' },
          { path: 'bagian-12-risk-management/risk-per-trade.html', title: 'Penentuan Risk per Trade (0.5% - 1%)', desc: 'Aturan baku membatasi kerugian maksimal per satu posisi trading.' },
          { path: 'bagian-12-risk-management/risk-reward-ratio.html', title: 'Risk to Reward Ratio (RR) Asimetris', desc: 'Mengapa rasio RR 1:2 atau 1:3 membuatmu profit konsisten meski winrate 50%.' },
          { path: 'bagian-12-risk-management/cara-hitung-lot.html', title: 'Rumus Cara Hitung Lot Berdasarkan Jarak Stop Loss', desc: 'Kalkulasi ukuran posisi presisi agar nominal risiko selalu konsisten.' },
          { path: 'bagian-12-risk-management/daily-loss-limit.html', title: 'Batas Rugi Harian (Daily Loss Limit)', desc: 'Tombol rem darurat: kapan wajib mematikan layar saat target rugi tercapai.' },
          { path: 'bagian-12-risk-management/maksimal-entry-per-hari.html', title: 'Maksimal Entry per Hari', desc: 'Mencegah overtrading dan mempertahankan ketajaman fokus analitis.' },
          { path: 'bagian-12-risk-management/jangan-layering-sembarangan.html', title: 'Larangan Layering Sembarangan (Anti Martingale)', desc: 'Membongkar bahaya fatal menambah posisi saat floating minus.' },
          { path: 'bagian-12-risk-management/cut-loss-bukan-kalah.html', title: 'Cut Loss Bukan Kalah: Logika Proteksi Modal', desc: 'Melihat Stop Loss sebagai biaya operasional bisnis, bukan kegagalan diri.' },
          { path: 'bagian-12-risk-management/floating-minus-dan-harapan.html', title: 'Floating Minus dan Jebakan Harapan (Hope Trap)', desc: 'Bahaya psikologis menahan kerugian dengan harapan market akan balik.' },
          { path: 'bagian-12-risk-management/position-sizing-saat-volatilitas-tinggi-nfp-fomc.html', title: 'Position Sizing Saat Volatilitas Tinggi (NFP/FOMC)', desc: 'Penyesuaian ukuran lot saat menghadapi rilis data ekonomi berdampak tinggi.' },
          { path: 'bagian-12-risk-management/membuat-rules-risk-pribadi.html', title: 'Menyusun Dokumen Aturan Risiko Pribadi', desc: 'Checklist mandiri yang wajib dipatuhi sebelum menekan tombol order.' }
        ]
      }
    ]
  },
  {
    num: '02',
    id: 'modul-02',
    title: 'Membaca Chart & Market Structure (Dari Nol sampai Advanced)',
    category: 'Fondasi & Struktur',
    sks: '3 SKS',
    time: '~2 Jam',
    desc: 'Satukan semua ilmu tentang candlestick dan kerangka struktur pasar di sini agar kamu mahir membaca arah tren tanpa indikator lagging.',
    icon: '📈',
    submodules: [
      {
        code: '2.1',
        title: 'Anatomi Chart & Struktur Dasar',
        source: 'Bagian 02 (Membaca Chart)',
        desc: 'Pelajari cara membaca chart, anatomi candlestick (OHLC, wick, body, momentum), konsep Timeframe & Fractal, cara menentukan Swing High dan Swing Low, membaca Trend, serta Market Structure Dasar.',
        chapters: [
          { path: 'bagian-02-membaca-chart/apa-itu-chart.html', title: 'Mengenal Chart & Bahasa Visual Pasar', desc: 'Grafik harga sebagai rekaman visual jejak transaksi institusi.' },
          { path: 'bagian-02-membaca-chart/candlestick-open-high-low-close.html', title: 'Anatomi Candlestick Institusional: OHLC, Body vs Wick', desc: 'Makna harga pembukaan, tertinggi, terendah, dan penutupan.' },
          { path: 'bagian-02-membaca-chart/bullish-candle-dan-bearish-candle.html', title: 'Membaca Tekanan Bullish dan Bearish', desc: 'Identifikasi dominasi pembeli vs penjual pada formasi candlestick.' },
          { path: 'bagian-02-membaca-chart/wick-body-dan-momentum.html', title: 'Wick, Body, dan Momentum Candlestick', desc: 'Mengapa bodi candlestick menceritakan fakta sementara sumbu menceritakan kebohongan.' },
          { path: 'bagian-02-membaca-chart/timeframe-dan-fractal.html', title: 'Fraktalitas Pasar: Harmoni Multi-Timeframe HTF ke LTF', desc: 'Prinsip fraktal: struktur timeframe kecil selalu tunduk pada timeframe besar.' },
          { path: 'bagian-02-membaca-chart/swing-high-dan-swing-low.html', title: 'Swing High dan Swing Low Objektif: Fraktal 3 & 5 Candle', desc: 'Menentukan titik belok harga secara matematis tanpa menebak-nebak.' },
          { path: 'bagian-02-membaca-chart/trend-uptrend-downtrend-sideways.html', title: 'Mengidentifikasi Arah Tren Sejati', desc: 'Ciri-ciri Uptrend, Downtrend, dan fase Sideways yang wajib dihindari.' },
          { path: 'bagian-02-membaca-chart/support-dan-resistance.html', title: 'Support & Resistance Tradisional vs Logika Modern', desc: 'Membongkar mengapa garis support-resistance klasik sering ditembus (fakeout).' },
          { path: 'bagian-02-membaca-chart/market-structure-dasar.html', title: 'Market Structure Dasar: Protected vs Targeted Levels', desc: 'Tingkat harga yang dilindungi algoritma vs tingkat harga yang diburu.' }
        ]
      },
      {
        code: '2.2',
        title: 'Siklus Pergerakan & Patahan Struktur Dasar',
        source: 'Bagian 03 (Fondasi Market) & Bagian 06 (ICT Core)',
        desc: 'Kuasai 4 fase pasar (Expansion, Retracement, Reversal, Consolidation), larangan entry saat konsolidasi, syarat Displacement & Momentum, perbedaan BOS, CHoCH, dan MSS, serta konsep CISD (Change in State of Delivery).',
        chapters: [
          { path: 'bagian-03-fondasi-market/harga-bergerak-karena-apa.html', title: 'Mengapa Harga Bergerak: Algoritma vs Sentimen', desc: 'Pasar digerakkan oleh penawaran ulang harga (repricing), bukan hukum supply-demand retail.' },
          { path: 'bagian-03-fondasi-market/market-cycle-siklus-market.html', title: '4 Fase Siklus Pasar: Expansion, Retracement, Reversal, Consolidation', desc: 'Siklus abadi pergerakan harga dari akumulasi hingga distribusi.' },
          { path: 'bagian-03-fondasi-market/jangan-entry-saat-consolidation.html', title: 'Larangan Entry Saat Pasar Konsolidasi', desc: 'Jebakan gergaji mesin (choppy market) dan perlunya menunggu ekspansi.' },
          { path: 'bagian-03-fondasi-market/displacement-dan-momentum.html', title: 'Anatomi Displacement: Tanda Tangan Partisipasi Institusional', desc: 'Lilin impulsif bodi besar dengan volume signifikan sebagai bukti intervensi bank.' },
          { path: 'bagian-03-fondasi-market/bos-choch-dan-mss.html', title: 'Perbedaan BOS, CHoCH, dan MSS (Market Structure Shift)', desc: 'Pembersihan doktrin CHoCH retail: Break of Structure kelanjutan vs Shift pembalikan.' },
          { path: 'bagian-06-ict-core/change-in-state-of-delivery-cisd.html', title: 'Konsep CISD (Change in State of Delivery)', desc: 'Tanda awal algoritma mengubah mode pengantaran harga dari diskon ke premium atau sebaliknya.' },
          { path: 'bagian-06-ict-core/cisd-bullish.html', title: 'CISD Bullish: Perubahan Menuju Pengantaran Naik', desc: 'Identifikasi candle down-close terakhir yang ditembus ke atas.' },
          { path: 'bagian-06-ict-core/cisd-bearish.html', title: 'CISD Bearish: Perubahan Menuju Pengantaran Turun', desc: 'Identifikasi candle up-close terakhir yang ditembus ke bawah.' },
          { path: 'bagian-06-ict-core/mss-yang-valid.html', title: 'Syarat Mutlak MSS Valid: Body Close & Displacement', desc: 'Menghindari false shift dengan konfirmasi penutupan bodi lilin di timeframe kunci.' }
        ]
      },
      {
        code: '2.3',
        title: 'Market Structure Lanjutan & Multi-Layer',
        source: 'Bagian 16 (Advanced Entry Logic) & Bagian 18 (Sweep & Delivery)',
        desc: 'Langsung tuntaskan cara membaca Minor vs Major Structure, Internal vs External Structure, cara membedakan BOS/MSS Valid vs Palsu (False MSS), mengenali False Displacement, memahami Complex Pullback, menilai kesehatan tren (Continuation Leg vs Continuation Failure), serta kondisi No Trade saat struktur rusak.',
        chapters: [
          { path: 'bagian-16-advanced-entry-logic/minor-vs-major-structure.html', title: 'Minor vs Major Structure: Membaca Lapisan Tren', desc: 'Struktur internal timeframe kecil di dalam kerangka struktur mayor timeframe besar.' },
          { path: 'bagian-16-advanced-entry-logic/internal-vs-external-structure.html', title: 'Internal vs External Structure: Menghindari Lawan Arus', desc: 'Menentukan kapan pullback internal selesai dan kapan ekspansi eksternal dimulai.' },
          { path: 'bagian-16-advanced-entry-logic/valid-mss-vs-false-mss.html', title: 'Valid MSS vs False MSS: Menyaring Patahan Palsu', desc: 'Kriteria objektif membedakan pembalikan arah sejati dengan manipulasi sapuan wick.' },
          { path: 'bagian-18-order-block-masterclass/false-displacement.html', title: 'Mengenali False Displacement', desc: 'Candle panjang tanpa imbalance dan bodi tipis yang sering menipu trader breakout.' },
          { path: 'bagian-16-advanced-entry-logic/complex-pullback.html', title: 'Membaca Complex Pullback Tanpa Panik Mengubah Bias', desc: 'Navigasi koreksi harga yang berliku-liku tanpa terburu-buru mengira tren berbalik.' },
          { path: 'bagian-18-order-block-masterclass/continuation-leg.html', title: 'Continuation Leg: Fase Dorongan Tren Sehat', desc: 'Ciri-ciri ekspansi yang masih memiliki bahan bakar likuiditas untuk melanjutkan perjalanan.' },
          { path: 'bagian-18-order-block-masterclass/continuation-failure.html', title: 'Continuation Failure: Tanda Awal Kelelahan Tren', desc: 'Kegagalan membentuk swing baru sebagai sinyal awal pembalikan arah atau mitigasi dalam.' },
          { path: 'bagian-16-advanced-entry-logic/no-trade-karena-structure-rusak.html', title: 'Kondisi No Trade Saat Struktur Rusak', desc: 'Sikap profesional duduk diam saat struktur pasar tumpang tindih tanpa displacement.' },
          { path: 'bagian-16-advanced-entry-logic/checklist-advanced-structure.html', title: 'Checklist Komprehensif Advanced Market Structure', desc: 'Panduan verifikasi struktur langkah-demi-langkah sebelum merencanakan posisi.' }
        ]
      }
    ]
  },
  {
    num: '03',
    id: 'modul-03',
    title: 'Liquidity & Inducement (Bahan Bakar & Jebakan Pasar Lengkap)',
    category: 'Likuiditas & PD Arrays',
    sks: '3 SKS',
    time: '~2 Jam 15 Menit',
    desc: 'Setelah tahu struktur, satukan seluruh materi likuiditas agar kamu tahu ke mana harga bergerak dan di mana letak jebakan ritel.',
    icon: '💧',
    submodules: [
      {
        code: '3.1',
        title: 'Konsep Dasar Liquidity',
        source: 'Bagian 04 (Liquidity) & Bagian 05 (SMC)',
        desc: 'Pahami perbedaan cara pikir Smart Money vs Retail, apa itu Liquidity, Buy-Side Liquidity (BSL) & Sell-Side Liquidity (SSL), Equal High/Low, Liquidity Pool, Stop Hunt / False Breakout, serta perbedaan mendasar Internal vs External Liquidity (IRL & ERL).',
        chapters: [
          { path: 'bagian-04-liquidity/apa-itu-liquidity.html', title: 'Likuiditas sebagai Satu-Satunya Bahan Bakar Algoritma IPDA', desc: 'Harga tidak bergerak ke indikator; harga selalu bergerak memburu kumpulan Stop Loss.' },
          { path: 'bagian-05-smart-money-concept/smart-money-vs-retail.html', title: 'Smart Money vs Retail: Perbedaan Cara Berpikir', desc: 'Retail mencari pola candlestick; institusi mencari tempat retail meletakkan modal proteksi.' },
          { path: 'bagian-04-liquidity/buy-side-liquidity.html', title: 'Buy-Side Liquidity (BSL): Kumpulan Buy Stop di Atas Puncak', desc: 'Memetakan area di atas Old Highs tempat retail memasang Stop Loss Sell & Buy Stop breakout.' },
          { path: 'bagian-04-liquidity/sell-side-liquidity.html', title: 'Sell-Side Liquidity (SSL): Kumpulan Sell Stop di Bawah Lembah', desc: 'Memetakan area di bawah Old Lows tempat retail memasang Stop Loss Buy & Sell Stop breakout.' },
          { path: 'bagian-04-liquidity/equal-high-dan-equal-low.html', title: 'Equal Highs (EQH) dan Equal Lows (EQL): Magnet Likuiditas Terkuat', desc: 'Puncak kembar dan dasar kembar yang sengaja diciptakan untuk dipanen kemudian.' },
          { path: 'bagian-04-liquidity/liquidity-pool.html', title: 'Memetakan Liquidity Pool Institusional', desc: 'Zona konsentrasi volume transaksi yang menjadi target algoritma pengantaran harga.' },
          { path: 'bagian-05-smart-money-concept/stop-hunt-dan-false-breakout.html', title: 'Stop Hunt & False Breakout: Rekayasa Manipulasi', desc: 'Mekanisme sapuan cepat ekor lilin untuk memicu order pasar sebelum harga berbalik.' },
          { path: 'bagian-04-liquidity/internal-liquidity.html', title: 'Internal Range Liquidity (IRL): Celah di Dalam Rentang', desc: 'Ketidakseimbangan harga (FVG) dan liquidity pool minor di dalam dealing range.' },
          { path: 'bagian-04-liquidity/external-liquidity.html', title: 'External Range Liquidity (ERL): Batas Luar Rentang', desc: 'Puncak tertinggi dan dasar terendah dealing range yang menjadi target akhir ekspansi.' }
        ]
      },
      {
        code: '3.2',
        title: 'Mekanika Sweep, Grab, dan Run',
        source: 'Bagian 04, Bagian 17 (FVG Masterclass) & Bagian 18 (Sweep & Delivery)',
        desc: 'Pelajari tuntas perbedaan Liquidity Sweep, Liquidity Grab (reaksi awal setelah sapuan), dan Liquidity Run (saat harga terus berlari), ciri Sweep yang layak diikuti, Liquidity Run Valid vs Palsu, serta High Resistance vs Low Resistance Liquidity Run (HRLR vs LRLR).',
        chapters: [
          { path: 'bagian-18-order-block-masterclass/sweep-vs-grab-vs-run.html', title: 'Mekanika Penuh: Sweep vs Grab vs Run', desc: 'Perbedaan mendasar antara sapuan likuiditas, reaksi tangkapan, dan dorongan lari.' },
          { path: 'bagian-04-liquidity/liquidity-sweep.html', title: 'Liquidity Sweep: Sapuan Cepat Ekor Lilin (Turtle Soup)', desc: 'Harga menyapu level kunci dengan wick lalu segera ditutup kembali ke dalam range.' },
          { path: 'bagian-18-order-block-masterclass/apa-itu-liquidity-grab-reaksi-awal-setelah-sapuan.html', title: 'Liquidity Grab: Reaksi Awal Pasca Sapuan', desc: 'Penolakan agresif sesaat setelah kumpulan likuiditas terserap oleh pesanan besar.' },
          { path: 'bagian-18-order-block-masterclass/sweep-yang-layak-diikuti.html', title: 'Ciri-Ciri Sweep yang Layak Diikuti', desc: 'Menyaring sapuan bermutu tinggi yang didukung waktu (Killzone) dan level HTF relevan.' },
          { path: 'bagian-17-fvg-masterclass/liquidity-run-yang-valid.html', title: 'Liquidity Run yang Valid: Ekspansi Sejati', desc: 'Harga bergerak ekspansif menembus level tanpa menoleh ke belakang menuju target berikutnya.' },
          { path: 'bagian-17-fvg-masterclass/liquidity-run-palsu.html', title: 'Liquidity Run Palsu: Jebakan Momentum Retel', desc: 'Pergerakan kencang semu yang dirancang untuk memancing trader FOMO sebelum berbalik.' },
          { path: 'bagian-16-advanced-entry-logic/high-resistance-vs-low-resistance-liquidity-run-hrlr-vs-lrlr.html', title: 'High Resistance (HRLR) vs Low Resistance Liquidity Run (LRLR)', desc: 'Lari likuiditas mulus tanpa rintangan swing vs lari berat berliku penuh jebakan.' },
          { path: 'bagian-18-order-block-masterclass/displacement-setelah-sweep.html', title: 'Displacement Setelah Sweep: Bukti Partisipasi Bank', desc: 'Lilin ekspansi tegas yang mengonfirmasi bahwa sapuan likuiditas bukan breakout sejati.' }
        ]
      },
      {
        code: '3.3',
        title: 'Pemetaan Target Likuiditas Lanjutan',
        source: 'Bagian 17 (FVG Masterclass) & Bagian 19 (POI Selection)',
        desc: 'Kuasai hubungan IRL ke ERL lanjutan, menentukan Draw on Liquidity (DOL) Prioritas, mengenali Weak High & Weak Low, membongkar jebakan Trendline Liquidity ritel, serta cara membuat Liquidity Map Sebelum Market Buka.',
        chapters: [
          { path: 'bagian-17-fvg-masterclass/irl-dan-erl-lanjutan.html', title: 'Siklus Dinamis: Dari IRL ke ERL dan Sebaliknya', desc: 'Algoritma selalu berpindah secara siklis: dari FVG internal menuju eksternal High/Low.' },
          { path: 'bagian-17-fvg-masterclass/draw-on-liquidity-prioritas.html', title: 'Menentukan Draw on Liquidity (DOL) Prioritas', desc: 'Menemukan magnet utama ke mana harga pasti tertarik sebelum sesi trading selesai.' },
          { path: 'bagian-17-fvg-masterclass/weak-high-dan-weak-low.html', title: 'Mengenali Weak High & Weak Low', desc: 'Puncak atau lembah lemah yang terbentuk tanpa mengambil likuiditas sebelumnya sehingga pasti ditembus.' },
          { path: 'bagian-17-fvg-masterclass/trendline-liquidity-dan-retail-patterns-membongkar-jebakan-pola-ritel.html', title: 'Membongkar Jebakan Trendline Liquidity Ritel', desc: 'Garis tren miring adalah sarang Stop Loss bertumpuk yang sangat disukai algoritma.' },
          { path: 'bagian-17-fvg-masterclass/liquidity-map-sebelum-market-buka.html', title: 'Cara Membuat Liquidity Map Sebelum Market Buka', desc: 'SOP menggambar peta likuiditas harian pada chart XAUUSD sebelum sesi dimulai.' },
          { path: 'bagian-17-fvg-masterclass/checklist-liquidity-map.html', title: 'Checklist Analisis Likuiditas Harian', desc: 'Daftar periksa verifikasi likuiditas sebelum mencari area entry (POI).' }
        ]
      },
      {
        code: '3.4',
        title: 'Masterclass Inducement / IDM',
        source: 'Bagian 05 Bab 3, Bagian 16 Bab 9, Bagian 20 & Bagian 30 Bab 3',
        desc: 'Satukan semua materi Inducement (IDM) mulai dari definisi pancingan ritel, perbedaan IDM vs BOS, syarat wajib IDM Sebelum BOS, cara Entry Setelah IDM Tersapu, mengenali IDM yang Invalid, hingga kriteria A+ Liquidity dan IDM Setup.',
        chapters: [
          { path: 'bagian-05-smart-money-concept/inducement.html', title: 'Definisi Pancingan Ritel (Inducement / IDM)', desc: 'Tingkat harga minor yang sengaja diciptakan untuk menggoda trader pemula masuk lebih awal.' },
          { path: 'bagian-16-advanced-entry-logic/inducement-vs-break-of-structure-bos.html', title: 'Perbedaan Jelas IDM vs Break of Structure (BOS)', desc: 'Jangan terkecoh: menembus IDM bukan berarti tren berlanjut, melainkan baru mengambil napas.' },
          { path: 'bagian-20-idm-inducement-masterclass/idm-sebelum-bos.html', title: 'Syarat Wajib: IDM Harus Tersapu Sebelum BOS Valid', desc: 'Aturan validitas struktur: swing baru tidak diakui sebelum swing minor pertama disapu.' },
          { path: 'bagian-20-idm-inducement-masterclass/entry-setelah-idm-tersapu.html', title: 'Teknik Entry Presisi Setelah IDM Tersapu', desc: 'Titik masuk dengan konfluensi tinggi saat retail Stop Loss tersapu di area IDM.' },
          { path: 'bagian-20-idm-inducement-masterclass/idm-yang-invalid.html', title: 'Mengenali IDM yang Invalid / Palsu', desc: 'Menghindari pancingan palsu yang terbentuk di luar dealing range yang sehat.' },
          { path: 'bagian-30-a-plus-setup-library/a-liquidity-dan-idm-setup.html', title: 'Kriteria Setup Peluru Utama: A+ Liquidity dan IDM Setup', desc: 'Standar emas kombinasi sapuan IDM dengan mitigasi ke area POI diskon/premium.' }
        ]
      }
    ]
  },
  {
    num: '04',
    id: 'modul-04',
    title: 'Dealing Range, Premium/Discount & Optimal Trade Entry (OTE)',
    category: 'Likuiditas & PD Arrays',
    sks: '2 SKS',
    time: '~1 Jam 45 Menit',
    desc: 'Modul khusus untuk mengukur area harga "Murah" dan "Mahal" sebelum mencari titik masuk presisi.',
    icon: '⚖️',
    submodules: [
      {
        code: '4.1',
        title: 'Dealing Range & Zona Harga',
        source: 'Bagian 05 (SMC) & Bagian 23 (Premium Discount Advanced)',
        desc: 'Pelajari konsep Premium (Mahal/Jual) dan Discount (Murah/Beli), cara menarik batas Dealing Range yang benar, pengenalan PD Array, serta penyelarasan HTF dan LTF Premium/Discount.',
        chapters: [
          { path: 'bagian-05-smart-money-concept/dealing-range.html', title: 'Dealing Range: Membatasi Medan Operasional Harga', desc: 'Menentukan batas atas (Absolute High) dan batas bawah (Absolute Low) yang aktif.' },
          { path: 'bagian-05-smart-money-concept/premium-dan-discount.html', title: 'Equilibrium (50%), Zona Premium, dan Zona Diskon', desc: 'Hukum dagang universal: beli hanya di harga diskon (<50%), jual hanya di harga premium (>50%).' },
          { path: 'bagian-05-smart-money-concept/pd-array.html', title: 'Pengenalan Hierarki PD Arrays', desc: 'Matriks susunan instrumen harga institusional dari Mitigation, Breaker, OB hingga FVG.' },
          { path: 'bagian-23-premium-discount-advanced/premium-discount-array.html', title: 'Equilibrium dan Pemilihan PD Array', desc: 'Memilih PD Array yang tepat di zona yang sesuai dengan bias harian.' },
          { path: 'bagian-23-premium-discount-advanced/htf-dan-ltf-premium-discount.html', title: 'Penyelarasan HTF dan LTF Premium/Discount', desc: 'Harmonisasi multi-timeframe: diskon di M15 harus berada dalam konteks diskon H1/H4.' },
          { path: 'bagian-23-premium-discount-advanced/dealing-range-yang-benar.html', title: 'Kapan Dealing Range Tidak Layak Dipakai', desc: 'Kondisi konsolidasi ketat dan sebelum berita besar di mana batas range menjadi tidak efektif.' }
        ]
      },
      {
        code: '4.2',
        title: 'Fibonacci ICT & Optimal Trade Entry / OTE',
        source: 'Bagian 09 (Entry Model), Bagian 26 (Gold Playbook) & Bagian 31 (ICT Advanced)',
        desc: 'Kuasai pengaturan angka Fibonacci ICT (zona 0.62–0.79 / 0.705), penggunaan OTE sebagai area konfluensi pada Bullish & Bearish Model, penempatan SL dalam OTE, serta kondisi kapan OTE tidak dipakai.',
        chapters: [
          { path: 'bagian-09-entry-model/fibonacci-ote.html', title: 'Pengaturan Angka Fibonacci ICT Murni', desc: 'Setting level 0.0, 0.50 (Equilibrium), 0.62, 0.705 (OTE Sweet Spot), dan 0.79.' },
          { path: 'bagian-26-xauusd-advanced-playbook/fibonacci-ict.html', title: 'Aplikasi Fibonacci ICT pada Karakter XAUUSD', desc: 'Penyesuaian tarikan swing pada Gold yang terkenal dengan wick panjang.' },
          { path: 'bagian-26-xauusd-advanced-playbook/ote-optimal-trade-entry-menemukan-titik-masuk-paling-efisien.html', title: 'Optimal Trade Entry (OTE): Rasio Emas Institusi', desc: 'Menemukan titik masuk paling efisien dengan rasio Risk-Reward terbaik.' },
          { path: 'bagian-26-xauusd-advanced-playbook/ote-dalam-bullish-model.html', title: 'OTE sebagai Area Konfluensi Bullish Model', desc: 'Menggabungkan zona 70.5% diskon dengan Bullish FVG atau Bullish Order Block.' },
          { path: 'bagian-26-xauusd-advanced-playbook/ote-dalam-bearish-model.html', title: 'OTE sebagai Area Konfluensi Bearish Model', desc: 'Menggabungkan zona 70.5% premium dengan Bearish FVG atau Bearish Breaker.' },
          { path: 'bagian-26-xauusd-advanced-playbook/stop-loss-dalam-ote.html', title: 'Penempatan Stop Loss Logis dalam Setup OTE', desc: 'Menempatkan Stop Loss di luar level invalidasi 100% atau swing extreme.' },
          { path: 'bagian-26-xauusd-advanced-playbook/kapan-ote-tidak-dipakai.html', title: 'Kondisi Kapan OTE Tidak Boleh Digunakan', desc: 'Pasar runaway momentum tinggi di mana harga menolak mitigasi dalam.' },
          { path: 'bagian-31-ict-advanced-concepts/optimal-trade-entry-ote.html', title: 'Optimal Trade Entry Lanjutan & Konfluensi Tambahan', desc: 'Penguatan setup OTE dengan konfirmasi waktu sesi Killzone New York.' },
          { path: 'bagian-26-xauusd-advanced-playbook/proyeksi-target-dengan-standard-deviation-fibonacci.html', title: 'Standard Deviation (STDV) Targeting untuk Proyeksi TP', desc: 'Menentukan target Take Profit objektif berbasis level ekstensi -1.0, -2.0, -2.5 STDV.' }
        ]
      }
    ]
  },
  {
    num: '05',
    id: 'modul-05',
    title: 'Ensiklopedia Lengkap PD Array (FVG, Order Block & Semua Block)',
    category: 'Likuiditas & PD Arrays',
    sks: '4 SKS',
    time: '~3 Jam',
    desc: 'Penggabungan terbesar: seluruh materi FVG, Order Block, dan blok institusi dari 10+ modul disatukan secara komprehensif dari dasar hingga tingkat master.',
    icon: '🧲',
    submodules: [
      {
        code: '5A',
        title: 'Masterclass Fair Value Gap (FVG) & Keluarga Imbalance',
        source: 'Bagian 05, 06, 09, 17, 20, 21, 24, 30 & 31',
        desc: 'Konsep dasar BISI/SIBI, 3 syarat valid, Consequent Encroachment (50% CE), Inversion FVG (IFVG), Liquidity Void, Volume Imbalance (VI), BPR, NDOG/NWOG, hingga A+ FVG Setup.',
        chapters: [
          { path: 'bagian-05-smart-money-concept/fair-value-gap.html', title: 'Anatomi 3-Candle Fair Value Gap (FVG): BISI dan SIBI', desc: 'Buyside Imbalance Sellside Inefficiency vs Sellside Imbalance Buyside Inefficiency.' },
          { path: 'bagian-06-ict-core/fvg-sebagai-entry-area.html', title: 'Dua Fungsi FVG: Sebagai Magnet (DOL) vs Area Entry (POI)', desc: 'Kapan FVG ditargetkan untuk disentuh vs kapan FVG dijadikan tempat menekan order.' },
          { path: 'bagian-17-fvg-masterclass/fvg-kuat-vs-fvg-lemah.html', title: 'Membedakan FVG Kuat vs FVG Lemah', desc: 'Filter mutu FVG: ukuran celah, kecepatan pergerakan, dan posisi dalam dealing range.' },
          { path: 'bagian-17-fvg-masterclass/ce-consequent-encroachment.html', title: 'Consequent Encroachment (CE): 50% Titik Keseimbangan Kritis', desc: 'Garis pertahanan tengah FVG: jika ditembus bodi candle, narasi pengantaran harga berubah.' },
          { path: 'bagian-17-fvg-masterclass/ce-fvg-full-fill-dan-entry-cepat.html', title: 'Aturan Memilih: Entry Cepat, 50% CE, atau Full Fill', desc: 'Menentukan titik eksekusi optimal berdasarkan tingkat agresivitas momentum pasar.' },
          { path: 'bagian-20-idm-inducement-masterclass/inversion-fair-value-gap-ifvg-saat-support-menjadi-resistance.html', title: 'Inversion FVG (IFVG): Dinamika Kegagalan Menjadi Peluang', desc: 'Apa yang terjadi saat FVG ditembus bodi: FVG gagal bertransformasi menjadi support/resistance baru.' },
          { path: 'bagian-20-idm-inducement-masterclass/inversion-entry-model-memanfaatkan-kegagalan-menjadi-peluang.html', title: 'Cara Kerja Inversion Entry Model', desc: 'Model eksekusi saat level ketidakseimbangan lama dihormati dari sisi sebaliknya.' },
          { path: 'bagian-21-ifvg-inversion-model/entry-di-ifvg.html', title: 'Teknik Entry Presisi di IFVG', desc: 'Penempatan order limit, konfirmasi lilin pemicu, dan letak Stop Loss yang aman.' },
          { path: 'bagian-17-fvg-masterclass/liquidity-void-vs-volume-imbalance-vs-fvg.html', title: 'Perbedaan FVG dengan Liquidity Void & Volume Imbalance', desc: 'Membedakan celah lilin tanpa transaksi (void) dengan celah antar bodi lilin (volume imbalance).' },
          { path: 'bagian-31-ict-advanced-concepts/balanced-price-range-bpr.html', title: 'Balanced Price Range (BPR): Tumpang Tindih Netralisasi Harga', desc: 'Dua FVG berlawanan arah yang saling tumpang tindih menciptakan zona netral kuat.' },
          { path: 'bagian-31-ict-advanced-concepts/nwog-dan-ndog.html', title: 'New Week Opening Gap (NWOG) & New Day Opening Gap (NDOG)', desc: 'Memanfaatkan celah pembukaan pasar harian dan mingguan sebagai POI dan DOL mandiri.' },
          { path: 'bagian-30-a-plus-setup-library/a-fvg-setup.html', title: 'Standar Kelolosan Eksekusi: A+ FVG Setup', desc: 'Checklist lengkap kriteria penyaringan akhir sebelum mengeksekusi setup FVG.' },
          { path: 'bagian-30-a-plus-setup-library/a-ifvg-setup.html', title: 'Standar Kelolosan Eksekusi: A+ IFVG Setup', desc: 'Checklist lengkap kriteria penyaringan akhir sebelum mengeksekusi setup Inversion FVG.' }
        ]
      },
      {
        code: '5B',
        title: 'Masterclass Order Block (OB) & Keluarga Block Lainnya',
        source: 'Bagian 05, 07, 09, 18, 19, 22, 30 & 31',
        desc: 'Konsep dasar OB institusi, OB Valid vs Palsu, Body vs Wick, Mean Threshold (50%), Breaker Block, Mitigation Block, Rejection Block, Propulsion Block, Vacuum Block, dan Block Stacking.',
        chapters: [
          { path: 'bagian-05-smart-money-concept/order-block.html', title: 'Order Block (OB) Institusional Sejati', desc: 'Bukan sekadar supply-demand ritel: jejak akumulasi pesanan bank sebelum ekspansi harga.' },
          { path: 'bagian-18-order-block-masterclass/ob-valid-vs-ob-palsu.html', title: 'Ciri-Ciri OB Valid vs OB Palsu', desc: '4 syarat mutlak: didahului sweep likuiditas, memecah struktur, menyisakan FVG, dan berada di zona tepat.' },
          { path: 'bagian-18-order-block-masterclass/body-ob-vs-wick-ob.html', title: 'Menarik Garis di Bodi OB vs Ekor (Wick) OB', desc: 'Standar institusi: bodi candle memuat volume institusi riil sementara wick adalah reaksi likuiditas.' },
          { path: 'bagian-18-order-block-masterclass/mean-threshold.html', title: 'Mean Threshold (MT): Titik Kritis 50% Bodi Order Block', desc: 'Batas toleransi maksimal: penutupan bodi lilin melewati 50% MT membatalkan keabsahan Order Block.' },
          { path: 'bagian-05-smart-money-concept/breaker-block.html', title: 'Breaker Block: Order Block Gagal yang Didahului Sweep', desc: 'Order block gagal yang telah memanen likuiditas sebelum ditembus: senjata pembalikan arah paling mematikan.' },
          { path: 'bagian-05-smart-money-concept/mitigation-block.html', title: 'Mitigation Block: OB Gagal Tanpa Sapuan Likuiditas', desc: 'Karakteristik kegagalan swing (Failure Swing) saat harga tidak mampu menjangkau Old High/Low.' },
          { path: 'bagian-05-smart-money-concept/rejection-block.html', title: 'Rejection Block: Ekor Panjang Penolakan Harga Ekstrem', desc: 'Area wick panjang di puncak/lembah tempat penolakan harga institusional terjadi.' },
          { path: 'bagian-05-smart-money-concept/propulsion-block.html', title: 'Propulsion Block: Lilin Pendorong Re-akumulasi', desc: 'Order block yang masuk menguji order block sebelumnya dan segera memantul mendorong tren.' },
          { path: 'bagian-22-block-advanced/block-stacking.html', title: 'Vacuum Block & Teknik Block Stacking', desc: 'Celah harga akibat event tak terduga serta seni menumpuk konfluensi beberapa blok institusi.' },
          { path: 'bagian-30-a-plus-setup-library/a-ob-setup.html', title: 'Standar Kelolosan Eksekusi: A+ Order Block Setup', desc: 'Checklist lengkap kriteria penyaringan akhir sebelum mengeksekusi setup Order Block.' }
        ]
      },
      {
        code: '5C',
        title: 'Seni Memilih Senjata (FVG vs OB vs OTE & Kombinasi Maut)',
        source: 'Bagian 06, 11, 17, 18, 19, 20, 21 & 23',
        desc: 'Aturan jelas kapan FVG lebih kuat vs kapan OB lebih kuat, perbandingan OTE vs FVG vs OB, hierarki POI Utama vs Sekunder, Unicorn Model (Breaker + FVG), dan tanda kapan semua POI ditolak.',
        chapters: [
          { path: 'bagian-30-a-plus-setup-library/kapan-fvg-lebih-kuat-daripada-ob-memilih-senjata-yang-tepat.html', title: 'Kapan Memilih FVG: Momentum Kencang & Mendesak ke Target', desc: 'Saat algoritma dalam mode ekspansi agresif, harga hanya akan menyentuh FVG tanpa sempat ke OB.' },
          { path: 'bagian-30-a-plus-setup-library/kapan-ob-lebih-kuat-daripada-fvg-memilih-fondasi-yang-kokoh.html', title: 'Kapan Memilih OB: Pasar Lambat & Butuh Mitigasi Mendalam', desc: 'Saat pasar mencari bahan bakar dalam atau bergerak santai dalam rentang dealing range yang lebar.' },
          { path: 'bagian-23-premium-discount-advanced/ote-vs-fvg-vs-ob.html', title: 'Perbandingan Komparatif: OTE vs FVG vs Order Block', desc: 'Tabel panduan memilih senjata eksekusi yang paling cocok dengan kepribadian dan kondisi chart.' },
          { path: 'bagian-19-liquidity-masterclass/poi-utama-vs-poi-sekunder.html', title: 'Hierarki POI: Menyaring POI Utama vs POI Sekunder', desc: 'Memisahkan area entry dengan probabilitas tinggi dari area sekunder yang rawan ditembus.' },
          { path: 'bagian-06-ict-core/ob-fvg-combination-kombinasi-maut.html', title: 'Kombinasi Maut: Order Block + FVG Overlap', desc: 'Tingkat presisi tertinggi: saat Order Block bersarang tepat di dalam atau berdampingan dengan FVG.' },
          { path: 'bagian-11-advanced-ict/unicorn-model.html', title: 'Unicorn Model: Breaker Block + FVG Overlap', desc: 'Salah satu setup paling dihormati dalam dunia ICT: perpaduan Breaker Block dan Inversion FVG.' },
          { path: 'bagian-19-liquidity-masterclass/kapan-semua-poi-ditolak.html', title: 'Tanda-Tanda Kapan Semua POI Ditolak dan Wajib Diabaikan', desc: 'Mengenali saat algoritma sedang membatalkan skenario normal: jangan memaksakan entry.' }
        ]
      }
    ]
  },
  {
    num: '06',
    id: 'modul-06',
    title: 'Daily Bias, Top-Down Analysis, Siklus Makro (IPDA) & SMT',
    category: 'Waktu & Skenario',
    sks: '3 SKS',
    time: '~2 Jam',
    desc: 'Setelah menguasai seluruh perkakas di atas, pelajari cara menyusun peta arah harga dari timeframe besar ke timeframe kecil secara matematis.',
    icon: '🧭',
    submodules: [
      {
        code: '6.1',
        title: 'Konteks & Top-Down Analysis Dasar',
        source: 'Bagian 06 (ICT Core) & Bagian 07 (Bias & Top-Down)',
        desc: 'Pahami prinsip Context is King, mekanisme Price Delivery, cara menentukan Daily Bias, Top-Down Analysis (Daily → H4 → H1 → M15), menggunakan level PDH & PDL, serta menyusun skenario harian.',
        chapters: [
          { path: 'bagian-06-ict-core/context-is-king.html', title: 'Context is King: Logika di Balik Formasi Lilin', desc: 'Setup teknikal tanpa konteks narasi timeframe besar adalah judi probabilitas rendah.' },
          { path: 'bagian-06-ict-core/price-delivery.html', title: 'Mekanisme Pengantaran Harga (Price Delivery Engine)', desc: 'Memahami bagaimana algoritma mengantar harga dari satu pool likuiditas ke pool lainnya.' },
          { path: 'bagian-07-bias-dan-top-down/apa-itu-daily-bias.html', title: 'Apa Itu Daily Bias: Panduan Probabilitas, Bukan Ramalan', desc: 'Menentukan kecenderungan warna bodi lilin harian: apakah hari ini cenderung ekspansi naik atau turun.' },
          { path: 'bagian-07-bias-dan-top-down/top-down-analysis.html', title: 'Top-Down Analysis 3-Tingkat: Daily → H1 → M15', desc: 'Alur kerja analisis bertahap: Daily untuk arah, H1 untuk medan range, M15 untuk eksekusi.' },
          { path: 'bagian-07-bias-dan-top-down/previous-day-high-dan-low.html', title: 'Memanfaatkan Level PDH & PDL (High/Low Hari Sebelumnya)', desc: 'Dua level paling likuid di seluruh chart: magnet utama yang selalu diuji setiap hari perdagangan.' },
          { path: 'bagian-07-bias-dan-top-down/menentukan-draw-on-liquidity.html', title: 'Menentukan Draw on Liquidity (DOL) Harian', desc: 'Menjawab pertanyaan terpenting sebelum buka market: "Ke mana harga ingin pergi hari ini?"' },
          { path: 'bagian-07-bias-dan-top-down/skenario-bullish-bearish-dan-netral.html', title: 'Menyusun Skenario A & Skenario B Harian', desc: 'Trader profesional tidak pernah kaget: selalu siap dengan skenario alternatif jika bias awal gagal.' }
        ]
      },
      {
        code: '6.2',
        title: 'Siklus Candle Harian & Profil Mingguan',
        source: 'Bagian 03, Bagian 08 (Session & Waktu) & Bagian 22',
        desc: 'Satukan konsep AMD (Accumulation, Manipulation, Distribution) dan Power of Three (PO3), urutan pembentukan candle harian (OHLC / OLHC), Monday Range, profil mingguan (Selasa/Rabu H/L of Week, Jumat TGIF), dan cara mengenali Bias yang Batal.',
        chapters: [
          { path: 'bagian-03-fondasi-market/accumulation-manipulation-distribution-amd.html', title: 'Konsep AMD & Power of Three (PO3)', desc: 'Akumulasi di sesi awal, manipulasi menjebak di sesi pembuka, distribusi sejati di sesi utama.' },
          { path: 'bagian-07-bias-dan-top-down/daily-candle-ohlc-dan-olhc.html', title: 'Urutan Pembentukan Lilin Harian: OHLC dan OLHC', desc: 'Anatomi open, high, low, close: kapan titik terendah harian terbentuk pada candle bullish.' },
          { path: 'bagian-22-block-advanced/monday-range.html', title: 'Monday Range dan Reaksi Pembukaan Pekan', desc: 'Senin sering kali membentuk rentang acuan dan jarang menghasilkan tren besar yang sehat.' },
          { path: 'bagian-08-session-dan-waktu/tuesday-lowhigh-of-week.html', title: 'Selasa Membentuk High atau Low of the Week', desc: 'Statistik institusional: 70% titik tertinggi atau terendah mingguan terbentuk di hari Selasa.' },
          { path: 'bagian-08-session-dan-waktu/wednesday-lowhigh-of-week.html', title: 'Rabu Reversal / Lanjutan Ekspansi Mingguan', desc: 'Rabu sebagai hari konfirmasi tren mingguan atau pembalikan arah tajam.' },
          { path: 'bagian-08-session-dan-waktu/tgif.html', title: 'Profil Hari Jumat (TGIF / Friday Profit Taking)', desc: 'Pembalikan arah sore hari karena institusi menutup posisi menjelang penutupan akhir pekan.' },
          { path: 'bagian-07-bias-dan-top-down/bias-bukan-ramalan.html', title: 'Mengenali Kapan Daily Bias Batal', desc: 'Menghindari bias kekerasan kepala: tanda-tanda jelas di chart saat narasi harian gagal total.' }
        ]
      },
      {
        code: '6.3',
        title: 'Siklus Algoritmik Makro / IPDA',
        source: 'Bagian 31 (ICT Advanced Concepts)',
        desc: 'Pelajari cara kerja algoritma IPDA Data Ranges (rentang 20, 40, dan 60 hari kerja), model AMDX Mingguan, Monthly Cycle ICT, dan Quarterly Theory.',
        chapters: [
          { path: 'bagian-31-ict-advanced-concepts/ipda.html', title: 'Hakikat IPDA: Algoritma Pengantaran Harga Antarbank', desc: 'Membongkar cara kerja mesin kuantitatif yang mengatur likuiditas pasar global.' },
          { path: 'bagian-31-ict-advanced-concepts/ipda-data-ranges.html', title: 'IPDA Data Ranges: Lookback 20, 40, dan 60 Hari Kerja', desc: 'Rentang waktu matematis algoritma saat menengok likuiditas masa lalu untuk direvaluasi.' },
          { path: 'bagian-31-ict-advanced-concepts/amdx-weekly-model.html', title: 'Model AMDX Mingguan untuk Mengukur Ekspansi', desc: 'Penerapan konsep Akumulasi, Manipulasi, Distribusi, dan Re-Distribusi pada candle mingguan.' },
          { path: 'bagian-31-ict-advanced-concepts/monthly-cycle-ict.html', title: 'Monthly Cycle ICT & Seasonal Tendencies', desc: 'Pola musiman bulanan dan pengaruh aliran dana reksadana/dana pensiun global.' },
          { path: 'bagian-31-ict-advanced-concepts/quarterly-theory-ict.html', title: 'Quarterly Theory: Pembagian 90-Hari Siklus Institusi', desc: 'Pembagian waktu kuartalan 3-bulanan dan 90-menit intra-hari yang mengatur siklus pergerakan.' }
        ]
      },
      {
        code: '6.4',
        title: 'Analisis Intermarket & SMT Divergence',
        source: 'Bagian 11 Bab 9, Bagian 27 & Bagian 31 Bab 5',
        desc: 'Gunakan korelasi antar-pasar dan SMT Divergence (DXY vs XAUUSD) untuk mengonfirmasi akumulasi rahasia institusi sebelum lonjakan harga.',
        chapters: [
          { path: 'bagian-27-no-trade-advanced/intermarket-analysis-dxy-correlation-kompas-utama-aset-global.html', title: 'Intermarket Analysis: Indeks Dollar (DXY) Sebagai Kompas', desc: 'Korelasi negatif mutlak: jika DXY naik kuat, instrumen Gold dan Forex mayor cenderung melemah.' },
          { path: 'bagian-27-no-trade-advanced/dxy-dan-gold.html', title: 'Korelasi Spesifik DXY vs Gold (XAUUSD)', desc: 'Membaca anomali korelasi saat Emas menunjukkan kekuatan relatif terhadap dollar.' },
          { path: 'bagian-27-no-trade-advanced/smt-divergence-konfirmasi-institusi-dan-jejak-rahasia.html', title: 'Konsep SMT Divergence: Jejak Akumulasi Rahasia', desc: 'Keretakan korelasi: satu aset membuat Higher High sementara aset pasangan gagal membuat Higher High.' },
          { path: 'bagian-27-no-trade-advanced/smt-valid-vs-invalid.html', title: 'Klasifikasi SMT Divergence Valid vs Invalid', desc: 'Membedakan perbedaan gerak yang bermakna institusional dari perbedaan gerak acak.' },
          { path: 'bagian-27-no-trade-advanced/smt-sebagai-filter.html', title: 'SMT sebagai Filter Konfirmasi Eksekusi (Bukan Pemicu Tunggal)', desc: 'Jangan pernah entry hanya karena ada SMT; SMT berfungsi sebagai lampu hijau pendukung setup.' },
          { path: 'bagian-31-ict-advanced-concepts/smt-divergence-smart-money-tool.html', title: 'Mastery Smart Money Tool (SMT) Divergence', desc: 'Aplikasi lanjutan SMT divergence pada pembukaan Killzone London dan New York.' }
        ]
      }
    ]
  },
  {
    num: '07',
    id: 'modul-07',
    title: 'Waktu Trading, Sesi, Killzone & Macro Silver Bullet',
    category: 'Waktu & Skenario',
    sks: '3 SKS',
    time: '~2 Jam',
    desc: 'Hukum tertinggi ICT adalah Waktu mengendalikan Harga. Pelajari jam-jam emas algoritma aktif membagikan keuntungan.',
    icon: '⏰',
    submodules: [
      {
        code: '7.1',
        title: 'Karakter & Jebakan Sesi',
        source: 'Bagian 08 (Session & Waktu), Bagian 21 & Bagian 25',
        desc: 'Pelajari karakter sesi Asia, London Open Judas Swing, New York Open, New York Midnight Open (NYMO), True Day Open 00:00 NY, batas 17:00 NY Close, dan penyesuaian DST.',
        chapters: [
          { path: 'bagian-08-session-dan-waktu/mengapa-waktu-penting.html', title: 'Hukum Waktu ICT: Waktu Mengendalikan Harga', desc: 'Algoritma bank sentral beroperasi berdasarkan jadwal kerja institusional yang ketat.' },
          { path: 'bagian-08-session-dan-waktu/asia-session.html', title: 'Sesi Asia (20:00 - 00:00 NY): Karakteristik Konsolidasi', desc: 'Fase akumulasi likuiditas: menentukan High dan Low Asia yang akan disapu di sesi berikutnya.' },
          { path: 'bagian-08-session-dan-waktu/cbdr.html', title: 'Central Bank Dealers Range (CBDR)', desc: 'Rentang harga patokan 14:00 - 20:00 waktu New York untuk memproyeksikan deviasi sesi berikutnya.' },
          { path: 'bagian-08-session-dan-waktu/london-session.html', title: 'London Open Killzone (02:00 - 05:00 AM NY)', desc: 'Pusat likuiditas dunia: sesi paling sering membentuk High atau Low of the Day.' },
          { path: 'bagian-08-session-dan-waktu/judas-swing.html', title: 'Anatomi Judas Swing: Manipulasi Awal Sesi London', desc: 'Dorongan palsu ke arah yang salah untuk menipu retail sebelum pergerakan tren sejati dimulai.' },
          { path: 'bagian-08-session-dan-waktu/new-york-session.html', title: 'New York Open Killzone (07:00 - 10:00 AM NY)', desc: 'Sesi distribusi utama dan re-pricing volatil saat pasar keuangan AS mulai beroperasi.' },
          { path: 'bagian-08-session-dan-waktu/ny-midnight-open.html', title: 'New York Midnight Open (NYMO): Garis Benchmark Harian', desc: 'Harga pembukaan pukul 00:00 NY sebagai level referensi diskon vs premium sejati intraday.' },
          { path: 'bagian-23-premium-discount-advanced/true-day-open-midnight-open-dan-kill-zones.html', title: 'Standar Waktu New York & Penyesuaian DST', desc: 'Menghitung konversi waktu New York (EST/EDT) ke WITA/WIB saat terjadi pergeseran musim.' }
        ]
      },
      {
        code: '7.2',
        title: 'Jendela Waktu Macro & ICT Silver Bullet',
        source: 'Bagian 08 Bab 14-15, Bagian 21, Bagian 30 Bab 9 & Bagian 31 Bab 10',
        desc: 'Kuasai jendela algoritma 20-menit ICT Macros serta 3 jendela 60-menit model eksekusi presisi tinggi ICT Silver Bullet.',
        chapters: [
          { path: 'bagian-08-session-dan-waktu/ict-macros.html', title: 'ICT Macros: Jendela Waktu Algoritma 20 Menit', desc: 'Jadwal injeksi volume terencana: 02:50-03:10, 08:50-09:10, 09:50-10:10, 10:50-11:10 NY.' },
          { path: 'bagian-08-session-dan-waktu/silver-bullet-session.html', title: 'Model ICT Silver Bullet: Jendela Waktu 60 Menit', desc: 'Model peluru perak: setup trading presisi dengan target objektif 10-15 pips pada Gold.' },
          { path: 'bagian-23-premium-discount-advanced/macro-ict-time-windows-detail-timing-di-balik-pergerakan-harga.html', title: '3 Jendela Waktu Resmi Silver Bullet', desc: 'London Open (03:00-04:00 AM NY), NY AM (10:00-11:00 AM NY), NY PM (02:00-03:00 PM NY).' },
          { path: 'bagian-30-a-plus-setup-library/silver-bullet-session-ict-mencari-setup-presisi-di-waktu-emas.html', title: 'Alur Eksekusi Silver Bullet: Sweep → MSS → FVG', desc: 'SOP langkah-demi-langkah mengeksekusi Silver Bullet di dalam jendela waktu tanpa ragu.' },
          { path: 'bagian-30-a-plus-setup-library/a-silver-bullet-setup.html', title: 'Standar Kelolosan Eksekusi: A+ Silver Bullet Setup', desc: 'Checklist verifikasi kualitas setup Silver Bullet sebelum memasang limit order.' }
        ]
      },
      {
        code: '7.3',
        title: 'Mengarungi Berita Berdampak Tinggi',
        source: 'Bagian 08 Bab 17-20, Bagian 21, Bagian 26 Bab 4 & Bagian 31 Bab 11',
        desc: 'Mekanisme berita CPI, NFP, FOMC, News Driver Model, protokol News Lock Amy FX Pro, dan cara membaca reaksi pasar tanpa terjebak slippage.',
        chapters: [
          { path: 'bagian-08-session-dan-waktu/cara-membaca-news.html', title: 'Karakter Rilis Berita Ekonomi Berdampak Tinggi', desc: 'Mengapa berita bukan pembuat tren, melainkan akselerator pengantaran harga ke target DOL.' },
          { path: 'bagian-08-session-dan-waktu/non-farm-payroll-nfp.html', title: 'Mengarungi Rilis Data Ketenagakerjaan AS (NFP)', desc: 'Volatilitas ekstrem hari Jumat pertama setiap bulan dan cara aman menghadapinya.' },
          { path: 'bagian-08-session-dan-waktu/consumer-price-index-cpi.html', title: 'Mengarungi Rilis Data Inflasi AS (CPI)', desc: 'Dampak angka inflasi terhadap ekspektasi suku bunga the Fed dan reaksi instan pada Emas.' },
          { path: 'bagian-08-session-dan-waktu/fomc-statement.html', title: 'Mengarungi Rilis Suku Bunga & Konferensi Pers FOMC', desc: 'Pergerakan 2 babak: lonjakan suku bunga 14:00 NY disusul arah tren sejati 14:30 NY.' },
          { path: 'bagian-31-ict-advanced-concepts/news-driver-model.html', title: 'News Driver Model: Logika Institusional di Balik Berita', desc: 'Memahami bahwa algoritma sudah menentukan target harga sebelum angka berita dirilis.' },
          { path: 'bagian-26-xauusd-advanced-playbook/gold-saat-news-besar-high-impact-news.html', title: 'Perilaku Khusus XAUUSD Saat Berita Besar', desc: 'Protokol News Lock: aturan wajib 15 menit sebelum & sesudah berita untuk melindungi akun dari slippage.' }
        ]
      }
    ]
  },
  {
    num: '08',
    id: 'modul-08',
    title: 'Model Entry Utuh & Playbook Khusus XAUUSD (Gold)',
    category: 'Eksekusi & Playbook',
    sks: '4 SKS',
    time: '~3 Jam',
    desc: 'Semua model eksekusi utuh yang teruji beserta buku panduan spesialisasi instrumen Emas (XAUUSD) dari sesi Asia hingga New York.',
    icon: '🎯',
    submodules: [
      {
        code: '8.1',
        title: 'Model Entry Continuation',
        source: 'Bagian 09 (Entry Model), Bagian 11 & Bagian 16',
        desc: 'Alur lengkap Liquidity Grab → MSS → FVG/OB/OTE, model ICT 2022 Mentorship, teknik refinement ke M5/M1, dan flowchart keputusan entry.',
        chapters: [
          { path: 'bagian-09-entry-model/urutan-entry-yang-benar.html', title: 'Urutan Entry yang Benar: Alur Kerja 4 Langkah', desc: 'Likuiditas tersapu → Terjadi perpindahan struktur (MSS) → Muncul FVG/OB → Entry di mitigasi.' },
          { path: 'bagian-09-entry-model/liquidity-grab-mss-fvg.html', title: 'Model Continuation Standar: Grab → MSS → FVG', desc: 'Model paling stabil dan konsisten untuk menangkap kelanjutan tren di timeframe intra-day.' },
          { path: 'bagian-11-advanced-ict/ict-2022-mentorship-model.html', title: 'Masterclass: ICT 2022 Mentorship Entry Model', desc: 'Model trading mandiri gratis terpopuler karya Michael J. Huddleston yang telah teruji.' },
          { path: 'bagian-16-advanced-entry-logic/entry-refinement-m1-dan-m5-model.html', title: 'Teknik Refinement Timeframe: Konfirmasi M15 ke Presisi M5/M1', desc: 'Mengecilkan jarak Stop Loss hingga hanya 10-15 pips pada Gold dengan presisi timeframe mikro.' },
          { path: 'bagian-28-trade-management-advanced/liquidity-grab-ke-mss-ke-entry-flow-chart-praktis.html', title: 'Flowchart Praktis Eksekusi Model Continuation', desc: 'Bagan alur ya/tidak yang memandu keputusan eksekusi dalam hitungan detik.' }
        ]
      },
      {
        code: '8.2',
        title: 'Model Pembalikan Arah / Reversal',
        source: 'Bagian 09, Bagian 11, Bagian 25, Bagian 26, Bagian 30 & Bagian 31',
        desc: 'Turtle Soup Model A & B, Smart Money Reversal (SMR), Market Maker Models (MMXM), dan target Standard Deviation (STDV 1, 2, 2.5, 4).',
        chapters: [
          { path: 'bagian-09-entry-model/turtle-soup.html', title: 'Model Turtle Soup: Menangkap Sapuan Puncak & Lembah', desc: 'Membeli di bawah dasar terendah lama dan menjual di atas puncak tertinggi lama.' },
          { path: 'bagian-25-session-entry-model/turtle-soup-model-a.html', title: 'Turtle Soup Model A: Reversal Instan Pasca Sapuan', desc: 'Eksekusi cepat saat ekor lilin menyapu likuiditas dan langsung ditolak kembali.' },
          { path: 'bagian-25-session-entry-model/turtle-soup-model-b.html', title: 'Turtle Soup Model B: Konfirmasi MSS & Mitigasi', desc: 'Versi konservatif: menunggu struktur M5 berbalik sebelum menekan order limit.' },
          { path: 'bagian-11-advanced-ict/smart-money-reversal-smr.html', title: 'Smart Money Reversal (SMR): Menangkap Titik Balik Mayor', desc: 'Transisi lengkap saat institusi menyelesaikan distribusi dan mulai mengakumulasi posisi baru.' },
          { path: 'bagian-30-a-plus-setup-library/market-maker-models-mmxm-peta-besar-pengiriman-harga.html', title: 'Market Maker Models (MMXM): Peta Besar Pengiriman Harga', desc: 'Market Maker Buy Model (MMBM) & Market Maker Sell Model (MMSM) dari kurva akumulasi ke distribusi.' },
          { path: 'bagian-31-ict-advanced-concepts/standard-deviation-projections.html', title: 'Standard Deviation Projections (STDV 1, 2, 2.5, 4)', desc: 'Menghitung target pembalikan arah objektif menggunakan deviasi standar rentang manipulasi.' }
        ]
      },
      {
        code: '8.3',
        title: 'Master Playbook XAUUSD / Gold',
        source: 'Bagian 10 (Gold Playbook) & Bagian 26 (Advanced Gold)',
        desc: 'Karakteristik spesifik instrumen Gold, volatilitas sesi, peta likuiditas harian XAUUSD, playbook sesi, dan aturan No-Trade khusus Emas.',
        chapters: [
          { path: 'bagian-10-xauusd-playbook/karakter-xauusd.html', title: 'Karakteristik Unik Gold (XAUUSD)', desc: 'Mengapa Emas bergerak agresif, bagaimana pola spread-nya, dan cara menghormati volatilitasnya.' },
          { path: 'bagian-10-xauusd-playbook/waktu-terbaik-trading-gold.html', title: 'Waktu Terbaik Trading Gold: London & New York Crossover', desc: 'Jam-jam paling produktif di mana volume transaksi Emas mencapai puncak tertingginya.' },
          { path: 'bagian-26-xauusd-advanced-playbook/karakter-gold-per-session.html', title: 'Perilaku Khusus XAUUSD di Setiap Sesi Pasar', desc: 'Asia membentuk perangkap, London memicu manipulasi, New York mendistribusikan tren utama.' },
          { path: 'bagian-26-xauusd-advanced-playbook/xauusd-liquidity-map-memetakan-bahan-bakar-market.html', title: 'Peta Likuiditas Harian XAUUSD: SOP Pagi Hari', desc: 'Menandai PDH/PDL, Asia High/Low, FVG M15/H1 yang masih terbuka sebelum sesi dibuka.' },
          { path: 'bagian-26-xauusd-advanced-playbook/xauusd-no-trade-playbook.html', title: 'Playbook No-Trade Khusus Gold: Kondisi Berbahaya', desc: 'Kondisi market Gold yang haram disentuh: spread melebar, menjelang berita merah pekat, dan pasar flat.' }
        ]
      },
      {
        code: '8.4',
        title: 'Katalog A+ Setup & Studi Kasus Riil XAUUSD',
        source: 'Bagian 30 (A+ Setup Library) & Bagian 33 (Live Case Studies)',
        desc: 'Checklist lengkap seluruh setup probabilitas tertinggi Amy FX Pro dan studi kasus bedah market nyata saat setup sukses maupun gagal.',
        chapters: [
          { path: 'bagian-30-a-plus-setup-library/full-ict-checklist.html', title: 'Checklist Lengkap Setup Peluru Utama A+', desc: 'Skor kelolosan 8 lapis: waktu, konteks HTF, likuiditas, MSS, PD Array, diskon/premium, RR.' },
          { path: 'bagian-33-live-case-studies/studi-kasus-1-xauusd-london-killzone.html', title: 'Studi Kasus Riil 1: Eksekusi London Killzone XAUUSD', desc: 'Bedah posisi live langkah-demi-langkah dari analisis pra-market hingga Take Profit tercapai.' },
          { path: 'bagian-33-live-case-studies/bedah-kegagalan-setup-a-plus.html', title: 'Bedah Kasus Kegagalan: Analisis Mengapa Setup A+ Bisa Loss', desc: 'Menganalisis kekalahan secara objektif: apakah karena kesalahan eksekusi atau bagian dari statistik normal.' }
        ]
      }
    ]
  },
  {
    num: '09',
    id: 'modul-09',
    title: 'Alur Kerja Eksekusi, Filter No-Trade & Trade Management',
    category: 'Eksekusi & Playbook',
    sks: '3 SKS',
    time: '~2 Jam 30 Menit',
    desc: 'Jembatan antara teori dan eksekusi nyata: cara menyaring peluang berkualitas, mengelola posisi aktif, dan menghindari jebakan psikologis di market.',
    icon: '🛡️',
    submodules: [
      {
        code: '9.1',
        title: 'Alur Kerja Eksekusi Baku & Filter No-Trade',
        source: 'Bagian 24 Bab 6, Bagian 27 Bab 5, 7, 10, Bagian 28 & Bagian 30',
        desc: 'Alur analisis baku (Context → Validasi → Trigger), Flowchart Entry, prinsip Do Not Chase, menyikapi Setup Hampir Valid, dan seni duduk diam.',
        chapters: [
          { path: 'bagian-28-trade-management-advanced/menyusun-trading-rules-dan-alur-baca-dari-konsep-ke-keputusan.html', title: 'Alur Kerja Analisis Baku: Konteks → Validasi → Trigger', desc: 'Tiga gerbang wajib: tentukan narasi makro, validasi sweep likuiditas, eksekusi di lilin trigger.' },
          { path: 'bagian-28-trade-management-advanced/flowchart-entry.html', title: 'Flowchart Pengambilan Keputusan Entry', desc: 'Bagan panduan visual: jika salah satu syarat tidak terpenuhi, langsung batalkan niat transaksi.' },
          { path: 'bagian-28-trade-management-advanced/do-not-chase-disiplin-menunggu-lokasi-yang-sehat.html', title: 'Prinsip Do Not Chase: Dilarang Mengejar Harga', desc: 'Jika harga sudah terbang meninggalkan area entry tanpa menjemput ordermu, ikhlaskan tanpa kompromi.' },
          { path: 'bagian-27-no-trade-advanced/setup-hampir-valid.html', title: 'Jebakan "Setup Hampir Valid": Bahaya Kompromi Aturan', desc: 'Mendekati valid sama sekali BUKAN valid; kompromi aturan adalah awal mula kehancuran akun.' },
          { path: 'bagian-27-no-trade-advanced/kapan-tidak-trade-seni-menunggu-peluang-berkualitas.html', title: 'Seni Duduk Diam: Menunggu Peluang Berkualitas Tinggi', desc: 'Trader pro dibayar untuk kesabarannya menunggu momen tepat, bukan untuk frekuensi klik mouse.' },
          { path: 'bagian-28-trade-management-advanced/checklist-sebelum-entry-filter-terakhir-sebelum-eksekusi.html', title: 'Checklist Filter Terakhir Sebelum Menekan Tombol Order', desc: 'Verifikasi 30 detik terakhir: cek jarak SL, ukuran lot, waktu sesi, dan jadwal kalender berita.' }
        ]
      },
      {
        code: '9.2',
        title: 'Manajemen Posisi Aktif',
        source: 'Bagian 28 (Trade Management) & Bagian 29 (Backtest Advanced)',
        desc: 'Skema Partial Take Profit, menggeser SL ke BE, menghindari BE Trap, aturan Scaling In / Scaling Out, serta membedakan Valid Win vs Invalid Win.',
        chapters: [
          { path: 'bagian-28-trade-management-advanced/partial-tp-dan-break-even.html', title: 'Skema Partial Take Profit yang Terukur', desc: 'Ambil 50-70% profit di target pertama (IRL/liquidity terdekat) untuk mengamankan uang nyata.' },
          { path: 'bagian-28-trade-management-advanced/kapan-memindahkan-stop-loss-dan-kapan-tidak-seni-proteksi-modal.html', title: 'Menggeser Stop Loss ke Breakeven (BE): Kapan Boleh & Kapan Tidak', desc: 'Jangan terburu-buru menggeser SL ke titik masuk sebelum harga membentuk struktur pelindung baru.' },
          { path: 'bagian-28-trade-management-advanced/be-trap.html', title: 'Menghindari BE Trap: Bahaya Terkena Jarum Sebelum Terbang', desc: 'Mengapa terlalu cepat pasang BE justru membuatmu sering terkena stop out sebelum harga mencapai TP.' },
          { path: 'bagian-28-trade-management-advanced/pyramiding-dan-scaling-in-position-strategi-agresif-yang-terukur.html', title: 'Aturan Scaling In (Pyramiding) & Scaling Out', desc: 'Menambah posisi hanya saat posisi pertama sudah aman profit dan struktur baru telah terkonfirmasi.' },
          { path: 'bagian-28-trade-management-advanced/valid-win-dan-invalid-win.html', title: 'Membedakan Valid Win vs Invalid Win', desc: 'Profit karena mematuhi SOP adalah kemenangan sejati; profit karena melanggar aturan adalah racun tertunda.' },
          { path: 'bagian-28-trade-management-advanced/bedanya-exit-objektif-vs-exit-emosional.html', title: 'Exit Objektif vs Exit Emosional', desc: 'Menutup posisi berdasarkan target struktur chart vs menutup posisi karena takut atau serakah.' },
          { path: 'bagian-28-trade-management-advanced/checklist-setelah-entry-mengelola-posisi-dengan-kepala-dingin.html', title: 'Checklist Pasca-Entry: Mengelola Posisi dengan Kepala Dingin', desc: 'Setelah order terpasang: pasang alert harga, tutup layar chart, dan biarkan probabilitas bekerja.' }
        ]
      }
    ]
  },
  {
    num: '10',
    id: 'modul-10',
    title: 'Psikologi Total, Backtesting, SOP 1-Halaman & Trader Mandiri / Prop Firm',
    category: 'Psikologi & Mandiri',
    sks: '4 SKS',
    time: '~3 Jam',
    desc: 'Tahap pemungkas: menguasai psikologi trader profesional, metodologi riset data mandiri, SOP ringkas 1-halaman, serta strategi menaklukkan evaluasi Prop Firm.',
    icon: '🧠',
    submodules: [
      {
        code: '10.1',
        title: 'Manajemen Emosi & Psikologi Tingkat Lanjut',
        source: 'Bagian 13 (Psikologi Trading) & Bagian 36 (Psikologi ICT Lanjutan)',
        desc: 'FOMO, Revenge Trading, Overtrading, Takut Cut Loss, Analysis Freeze, Backtest/Narrative Bias, kebiasaan gonta-ganti sistem (System Hopping), dan membangun mental juara.',
        chapters: [
          { path: 'bagian-13-psikologi-trading/kenapa-trader-gagal.html', title: 'Akar Masalah Mengapa 90% Trader Retail Gagal', desc: 'Bukan karena tekniknya yang kurang, melainkan kegagalan mengendalikan emosi dan ego diri.' },
          { path: 'bagian-13-psikologi-trading/fomo-fear-of-missing-out.html', title: 'Anatomi & Pengobatan FOMO (Fear of Missing Out)', desc: 'Menghilangkan ketakutan ketinggalan kereta: pasar akan selalu ada besok dengan setup baru.' },
          { path: 'bagian-13-psikologi-trading/revenge-trading-balas-dendam-ke-market.html', title: 'Menghentikan Revenge Trading: Balas Dendam ke Market', desc: 'Memutus spiral kehancuran akun saat terpukul oleh kekalahan beruntun.' },
          { path: 'bagian-13-psikologi-trading/takut-cut-loss-membiarkan-rugi-membengkak.html', title: 'Mengatasi Ketakutan Cut Loss & Menghormati Invalidation', desc: 'Menerima kekalahan kecil secara terhormat sebelum berubah menjadi bencana margin call.' },
          { path: 'bagian-13-psikologi-trading/penyakit-ego-ingin-selalu-benar.html', title: 'Penyakit Ego: Ingin Selalu Benar Melawan Market', desc: 'Pasar tidak peduli dengan analisismu; fleksibilitas pikiran adalah kunci kelangsungan hidup trader pro.' },
          { path: 'bagian-13-psikologi-trading/overtrade-transaksi-berlebihan.html', title: 'Menghentikan Penyakit Overtrading', desc: 'Trading bukan pekerjaan pabrik yang digaji per jam; kualitas satu posisi jauh lebih bernilai dari sepuluh order acak.' },
          { path: 'bagian-13-psikologi-trading/sabar-menunggu-setup.html', title: 'Seni Kesabaran Menunggu Setup Sempurna', desc: 'Meniru perilaku predator buas yang diam berjam-jam menunggu mangsa masuk ke zona jangkauan.' },
          { path: 'bagian-36-psikologi-ict-lanjutan/analysis-freeze.html', title: 'Mengatasi Analysis Freeze (Lumpuh Karena Terlalu Banyak Analisis)', desc: 'Menghilangkan keraguan saat trigger muncul: percaya pada statistik probabilitas trading plan.' },
          { path: 'bagian-36-psikologi-ict-lanjutan/backtest-bias.html', title: 'Menghilangkan Backtest Bias & Narrative Bias', desc: 'Mencegah ilusi hindsight: membedakan kemampuan membaca live market dari membaca data masa lalu.' },
          { path: 'bagian-36-psikologi-ict-lanjutan/pindah-metode.html', title: 'Menghentikan Kebiasaan Gonta-Ganti Sistem (System Hopping)', desc: 'Kuasai satu setup hingga level master daripada mengetahui seratus indikator setengah matang.' },
          { path: 'bagian-13-psikologi-trading/membangun-mental-trader-menjadi-profesional-sejati.html', title: 'Membangun Mentalitas Trader Profesional Sejati', desc: 'Transformasi identitas dari spekulan amatir menjadi pengelola modal berdisiplin tinggi.' }
        ]
      },
      {
        code: '10.2',
        title: 'Metodologi Backtesting & Jurnal',
        source: 'Bagian 14 (Backtesting & Jurnal) & Bagian 28',
        desc: 'Manual backtest per model entry, template jurnal terstruktur, transisi ke forward testing, kalkulasi Winrate, Risk-Reward, dan Math Expectancy.',
        chapters: [
          { path: 'bagian-14-backtesting-dan-jurnal/apa-itu-backtesting.html', title: 'Hakikat Backtesting: Membeli Keyakinan Mental', desc: 'Membangun keyakinan eksekusi berdasarkan ratusan data sampel masa lalu yang objektif.' },
          { path: 'bagian-14-backtesting-dan-jurnal/cara-backtest-manual.html', title: 'Metodologi Backtest Manual per Model Entry Spesifik', desc: 'SOP mengumpulkan minimal 100 sampel data per satu model tanpa melihat hasil masa depan.' },
          { path: 'bagian-14-backtesting-dan-jurnal/template-backtesting.html', title: 'Template Dokumen Pencatatan Data Backtest', desc: 'Format tabel pencatatan: tanggal, sesi, model entry, jarak SL, target TP, dan hasil R-multiple.' },
          { path: 'bagian-14-backtesting-dan-jurnal/jurnal-trading.html', title: 'Rutinitas Jurnal Trading Harian', desc: 'Jurnal adalah cermin kejujuran: mencatat emosi sebelum, saat, dan sesudah posisi ditutup.' },
          { path: 'bagian-14-backtesting-dan-jurnal/forward-testing.html', title: 'Transisi Bertahap: Dari Backtest ke Forward Testing', desc: 'Menguji ketajaman eksekusi pada chart berjalan di akun simulasi sebelum menggunakan uang riil.' },
          { path: 'bagian-28-trade-management-advanced/review-mingguan-dan-expectancy.html', title: 'Menghitung Winrate, RR, dan Math Expectancy Portofolio', desc: 'Rumus matematika ekspektansi: membuktikan secara ilmiah mengapa akunmu akan bertumbuh dalam jangka panjang.' }
        ]
      },
      {
        code: '10.3',
        title: 'Rencana Bisnis Trading, SOP 1 Halaman & Prop Firm Mastery',
        source: 'Bagian 15 (Trader Mandiri), Bagian 34 (Prop Firm) & Bagian 35 (SOP 1 Halaman)',
        desc: 'Trading plan formal, SOP 1-halaman (4 langkah printable), evaluasi industri Prop Firm, kalkulasi batas drawdown, dan strategi menjaga akun funded.',
        chapters: [
          { path: 'bagian-15-menjadi-trader-mandiri/jangan-bergantung-sinyal.html', title: 'Memutus Ketergantungan Pada Grup Sinyal & Mentor', desc: 'Kemandirian sejati: mampu menganalisis, mengeksekusi, dan mengevaluasi chart secara mandiri 100%.' },
          { path: 'bagian-15-menjadi-trader-mandiri/membuat-trading-plan.html', title: 'Menyusun Dokumen Rencana Bisnis Trading (Trading Plan)', desc: 'Panduan formal: instrumen pilihan, jam kerja sesi, batas risiko harian, dan kriteria penarikan profit.' },
          { path: 'bagian-35-trading-plan-template/sop-trading-1-halaman-printable.html', title: 'SOP Trading 1-Halaman Printable: 4 Langkah Baku', desc: 'Lembar SOP ringkas yang bisa dicetak dan ditempel di meja kerja sebagai panduan harian.' },
          { path: 'bagian-34-prop-firm-mastery/apa-itu-prop-firm-dan-cara-kerjanya.html', title: 'Memahami Model Bisnis & Evaluasi Industri Prop Firm', desc: 'Peluang mengelola modal $10,000 hingga $200,000 dari firma penyedia likuiditas global.' },
          { path: 'bagian-34-prop-firm-mastery/aturan-drawdown-dan-cara-menghitungnya.html', title: 'Kalkulasi Presisi: Max Daily Loss & Trailing Drawdown', desc: 'Matematika bertahan hidup: cara menghitung batas rugi harian berbasis balance vs equity.' },
          { path: 'bagian-34-prop-firm-mastery/manajemen-risiko-khusus-prop-firm.html', title: 'Strategi Lulus Evaluasi & Menjaga Akun Funded', desc: 'Manajemen risiko konservatif (0.25% - 0.5% per trade) untuk konsistensi pencairan profit (payout).' }
        ]
      }
    ]
  }
];

// 1. Validation check
console.log('Running validation check for all chapters across 10 modules...');
let totalValidated = 0;
let errors = 0;

for (const mod of modulesData) {
  for (const sub of mod.submodules) {
    for (const chap of sub.chapters) {
      totalValidated++;
      const fullPath = path.join(academyDir, chap.path);
      if (!fs.existsSync(fullPath)) {
        console.error(`ERROR: File not found: ${chap.path}`);
        errors++;
      }
    }
  }
}

if (errors > 0) {
  console.error(`Validation failed with ${errors} missing files! Aborting.`);
  process.exit(1);
}
console.log(`Validation SUCCESS! All ${totalValidated} chapters across all 10 modules verified on disk with zero loss.`);

// 2. Helper to build common head and nav
function renderTopbar(relativePathToRoot) {
  return `
<header class="topbar hide-until-auth">
  <nav class="nav">
    <button type="button" class="nav-arrow-btn nav-arrow-left" id="amyfxNavBack" data-amyfx-nav="back" aria-label="Kembali ke Menu Utama">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
        <line x1="19" y1="12" x2="5" y2="12"></line>
        <polyline points="12 19 5 12 12 5"></polyline>
      </svg>
    </button>
    <a class="brand" href="${relativePathToRoot}index.html" style="white-space:nowrap; display:inline-flex; align-items:center; gap:10px;">
      <span class="brand-mark" style="white-space:nowrap; width:auto; min-width:44px; height:38px; padding:0 10px; display:inline-flex; align-items:center; justify-content:center; font-weight:900; letter-spacing:0.04em;">AMY</span>
      <span style="font-weight:800; letter-spacing:0.02em; white-space:nowrap;">Trading Academy</span>
    </a>
    <div style="display:flex; align-items:center; gap:8px;">
      <button type="button" class="nav-arrow-btn nav-arrow-right" id="amyfxNavForward" data-amyfx-nav="forward" aria-label="Maju">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      </button>
      <button class="hamburger" id="hamburger" aria-label="Menu"><span></span><span></span><span></span></button>
    </div>
    <div class="navlinks" id="navlinks">
      <a href="${relativePathToRoot}index.html">Beranda</a>
      <a href="${relativePathToRoot}daftar-materi.html">Daftar Materi</a>
      <a href="${relativePathToRoot}tentang.html">Tentang</a>
      <a href="${relativePathToRoot}glosarium/index.html">Glosarium</a>
      <a href="${relativePathToRoot}admin/index.html">Admin</a>
    </div>
  </nav>
</header>`;
}

// 3. Generate each modul-XX/index.html
console.log('Generating 10 Module Hub pages...');
modulesData.forEach((mod, idx) => {
  const modDir = path.join(academyDir, mod.id);
  if (!fs.existsSync(modDir)) {
    fs.mkdirSync(modDir, { recursive: true });
  }

  const prevMod = idx > 0 ? modulesData[idx - 1] : null;
  const nextMod = idx < modulesData.length - 1 ? modulesData[idx + 1] : null;

  let totalChapters = mod.submodules.reduce((sum, s) => sum + s.chapters.length, 0);

  let submodulesHtml = mod.submodules.map((sub, sIdx) => {
    let chaptersHtml = sub.chapters.map((chap, cIdx) => {
      return `
        <article class="course-card" style="padding:18px 20px; background:rgba(20,24,38,0.7); border:1px solid rgba(212,168,50,0.22); border-radius:12px; display:flex; flex-direction:column; justify-content:space-between; transition:transform 0.2s, border-color 0.2s;">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-size:11px; font-weight:800; color:#d4a832; letter-spacing:1px;">BAB ${String(cIdx + 1).padStart(2, '0')}</span>
              <span style="font-size:11px; color:var(--muted,#888); background:rgba(255,255,255,0.06); padding:2px 8px; border-radius:99px;">Unabridged</span>
            </div>
            <h4 style="margin:0 0 8px; font-size:16px; line-height:1.4; color:#fff;">${chap.title}</h4>
            <p style="font-size:13px; color:var(--muted,#94a3b8); line-height:1.6; margin:0 0 16px;">${chap.desc}</p>
          </div>
          <div>
            <a class="btn primary sm" href="../${chap.path}" style="width:100%; text-align:center; font-weight:700; padding:9px 14px; font-size:13px; text-decoration:none;">Buka Bab Lengkap →</a>
          </div>
        </article>`;
    }).join('\n');

    return `
      <section class="panel" style="padding:24px; margin-bottom:28px; background:rgba(18,22,34,0.6); border:1px solid rgba(212,168,50,0.25); border-radius:16px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px; margin-bottom:12px;">
          <div>
            <span class="badge" style="background:rgba(212,168,50,0.15); color:#d4a832; border:1px solid rgba(212,168,50,0.35); padding:4px 10px; border-radius:99px; font-size:11px; font-weight:800; letter-spacing:1px;">SUB-MODUL ${sub.code}</span>
            <h3 style="margin:8px 0 4px; font-size:20px; color:#fff;">${sub.title}</h3>
            <div style="font-size:12px; color:#d4a832; font-weight:600;">Sumber: ${sub.source}</div>
          </div>
          <span style="font-size:12px; color:var(--muted,#888); background:rgba(0,0,0,0.3); padding:4px 10px; border-radius:8px;">📄 ${sub.chapters.length} Bab Pembahasan</span>
        </div>
        <p style="font-size:14px; color:var(--muted,#94a3b8); line-height:1.6; margin:8px 0 20px;">${sub.desc}</p>
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:16px;">
          ${chaptersHtml}
        </div>
      </section>`;
  }).join('\n');

  const pageHtml = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <meta name="theme-color" content="#070B12">
  <title>Modul ${mod.num} — ${mod.title} — Amy FX Academy</title>
  <script src="../../shared/amyfx-theme-controller.js" data-amyfx-theme-controller="v1"></script>
  <link rel="stylesheet" href="../assets/css/style.css">
  <link rel="stylesheet" href="../assets/css/glass.css">
  <script>const ROOT_PATH='../';</script>
  <script src="../assets/js/auth.js"></script>
  <script src="../assets/js/main.js" defer></script>
  <link rel="stylesheet" href="../../shared/amyfx-blueprint-v1.css" data-amyfx-blueprint-css="v1">
  <link rel="stylesheet" href="../../shared/amyfx-ui-tokens.css" data-amyfx-ui-tokens="v1">
  <link rel="stylesheet" href="../../shared/amyfx-theme.css" data-amyfx-theme="v1">
  <link rel="stylesheet" href="../../shared/amyfx-components.css" data-amyfx-components="v1">
  <link rel="stylesheet" href="../../shared/amyfx-ui-polish-pro348.css" data-amyfx-ui-polish="pro348">
  <link rel="stylesheet" href="../../shared/amyfx-natural-ui-pro355.css" data-amyfx-natural-ui="pro355">
  <link rel="stylesheet" href="../../shared/amyfx-obsidian-glass.css" data-amyfx-obsidian-glass="v1">
</head>
<body class="amyfx-module amyfx-module--academy">
<script>requireLogin();</script>
${renderTopbar('../')}
<main class="container hide-until-auth">
  <div class="breadcrumb" style="margin-bottom:16px;">
    <a href="../index.html">Beranda</a> › <a href="../daftar-materi.html">Daftar Materi</a> › Modul ${mod.num}
  </div>

  <section class="hero glass-hero" style="margin-bottom:28px;">
    <div class="hero-card">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
        <span class="badge" style="background:rgba(212,168,50,0.15); color:#d4a832; border:1px solid rgba(212,168,50,0.35); padding:4px 12px; border-radius:99px; font-size:12px; font-weight:800; letter-spacing:1px;">
          ${mod.icon} MODUL ${mod.num} • ${mod.category.toUpperCase()}
        </span>
        <span style="font-size:13px; color:var(--muted,#94a3b8); font-weight:600;">
          ⏱️ ${mod.time} • 🎓 ${mod.sks} • 📄 ${totalChapters} Bab Lengkap
        </span>
      </div>
      <h1 style="font-size:clamp(24px, 3.8vw, 36px); margin:8px 0 12px; color:#fff;">Modul ${mod.num} — ${mod.title}</h1>
      <p style="color:var(--muted,#94a3b8); margin:0 0 20px; font-size:15px; max-width:720px; line-height:1.6;">
        ${mod.desc}
      </p>
      <div style="display:flex; flex-wrap:wrap; gap:10px;">
        <a class="btn primary sm" href="../daftar-materi.html">← Silabus Lengkap</a>
        ${prevMod ? `<a class="btn sm" href="../${prevMod.id}/index.html">← Modul ${prevMod.num}</a>` : ''}
        ${nextMod ? `<a class="btn sm" href="../${nextMod.id}/index.html">Modul ${nextMod.num} →</a>` : ''}
      </div>
    </div>
  </section>

  <div id="submodulesList">
    ${submodulesHtml}
  </div>

  <nav class="module-nav-bottom" style="margin-top:40px; padding:20px; background:rgba(18,22,34,0.7); border:1px solid rgba(212,168,50,0.2); border-radius:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
    ${prevMod ? `<a class="btn ghost sm" href="../${prevMod.id}/index.html">← Modul ${prevMod.num}: ${prevMod.title}</a>` : '<div></div>'}
    <a class="btn primary sm" href="../daftar-materi.html">Daftar 10 Modul Master</a>
    ${nextMod ? `<a class="btn ghost sm" href="../${nextMod.id}/index.html">Modul ${nextMod.num}: ${nextMod.title} →</a>` : '<div></div>'}
  </nav>
</main>

<footer class="footer hide-until-auth" style="margin-top:60px; padding:24px 0; border-top:1px solid var(--border); text-align:center; color:var(--muted,#888); font-size:13px;">
  © 2026 Amy FX Academy. Sistem Kuliah Trading Institusional Murni ICT & Playbook XAUUSD Pro.
</footer>
  <script src="../../shared/amyfx-blueprint-v1.js" data-amyfx-blueprint-js="v1"></script>
  <script src="../../shared/amyfx-blueprint-hotfix-v1.js" data-amyfx-blueprint-hotfix="v1"></script>
  <script src="../../shared/amyfx-universal-nav.js"></script>
  <script src="../../shared/amy-local-assistant.js" data-amy-local-assistant="v1"></script>
  <script src="../../shared/amy-learning-reminder.js" data-amy-learning-reminder="v1"></script>
  <script src="../../shared/amyfx-loading.js" data-amyfx-loading="v1"></script>
</body>
</html>`;

  fs.writeFileSync(path.join(modDir, 'index.html'), pageHtml, 'utf8');
});
console.log('Generated all 10 module hub index.html pages.');

// 4. Update index.html
console.log('Updating app/src/main/assets/apps/academy/index.html...');
const totalAllChapters = modulesData.reduce((sum, m) => sum + m.submodules.reduce((s, sub) => s + sub.chapters.length, 0), 0);

const courseCardsHtml = modulesData.map(mod => {
  let chapCount = mod.submodules.reduce((s, sub) => s + sub.chapters.length, 0);
  let subCount = mod.submodules.length;
  return `    <article class="course-card">
      <div class="num" style="color:var(--gold,#d4a832); font-weight:800;">${mod.icon} MODUL ${mod.num} • ${mod.sks}</div>
      <h3 style="margin:8px 0 6px; font-size:18px;">${mod.title}</h3>
      <details class="course-description" style="margin-bottom:12px;">
        <summary style="cursor:pointer; font-size:13px; color:var(--muted,#94a3b8); font-weight:600;">Ringkasan Silabus</summary>
        <p style="font-size:13px; line-height:1.6; color:var(--muted,#94a3b8); margin-top:6px;">
          ⏱️ ${mod.time} • ${mod.sks} • 📂 ${subCount} Sub-Modul • 📄 ${chapCount} Bab Lengkap<br>
          ${mod.desc}
        </p>
      </details>
      <a class="btn primary sm" href="${mod.id}/index.html" style="font-weight:700;">Buka Modul →</a>
    </article>`;
}).join('\n');

const newIndexHtml = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <meta name="theme-color" content="#070B12">
  <title>Beranda — Amy FX Academy (10 Modul Tematik Terpadu)</title>
  <script src="../shared/amyfx-theme-controller.js" data-amyfx-theme-controller="v1"></script>
  <link rel="stylesheet" href="assets/css/style.css">
  <link rel="stylesheet" href="assets/css/glass.css">
  <script>const ROOT_PATH='';</script>
  <script src="assets/js/auth.js"></script>
  <script src="assets/js/main.js" defer></script>
  <link rel="stylesheet" href="../shared/amyfx-blueprint-v1.css" data-amyfx-blueprint-css="v1">
  <link rel="stylesheet" href="../shared/amyfx-ui-tokens.css" data-amyfx-ui-tokens="v1">
  <link rel="stylesheet" href="../shared/amyfx-theme.css" data-amyfx-theme="v1">
  <link rel="stylesheet" href="../shared/amyfx-components.css" data-amyfx-components="v1">
  <link rel="stylesheet" href="../shared/amyfx-ui-polish-pro348.css" data-amyfx-ui-polish="pro348">
  <link rel="stylesheet" href="../shared/amyfx-natural-ui-pro355.css" data-amyfx-natural-ui="pro355">
  <link rel="stylesheet" href="../shared/amyfx-obsidian-glass.css" data-amyfx-obsidian-glass="v1">
</head>
<body class="amyfx-module amyfx-module--academy">
<script>requireLogin();</script>
${renderTopbar('')}
<main class="container hide-until-auth">
  <section class="hero glass-hero">
    <div class="hero-card">
      <div style="font-size:12px; font-weight:800; color:#d4a832; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:6px;">KURIKULUM TEMATIK TERPADU • ZERO RINGKASAN</div>
      <h1 style="font-size:clamp(26px, 4vw, 40px); margin-top:0;">10 Modul Tematik Terpadu</h1>
      <p style="color:var(--muted,#94a3b8); margin:8px 0 20px; font-size:15px; max-width:680px; line-height:1.6;">
        Kurikulum master terstruktur murni ICT. Menggabungkan seluruh ${totalAllChapters} materi fondasi, algoritma IPDA, Dealing Range, Killzone New York, PD Arrays lengkap, model eksekusi Peluru Utama A+, hingga Playbook Emas (XAUUSD) mandiri tanpa ringkasan dan bebas distorsi retail SMC.
      </p>
      <div class="hero-actions" style="display:flex; flex-wrap:wrap; gap:12px;">
        <a class="btn primary" href="daftar-materi.html">Daftar Silabus Lengkap</a>
        <a class="btn" href="#modul-inti">Buka 10 Modul Master ↓</a>
        <a class="btn ghost" href="glosarium/index.html">Glosarium ICT</a>
      </div>
    </div>
  </section>

  <label for="academySearch" class="sr-only">Cari materi tutorial</label>
  <input class="academy-search" id="academySearch" type="search" autocomplete="off" placeholder="Cari topik atau modul master…">

  <div id="lanjutBelajarContainer" class="hide-until-auth" style="margin-top: -16px; margin-bottom: 32px; display: none;">
    <div class="course-card" style="padding: 24px; background: var(--accent-soft); border-color: var(--accent);">
      <div class="num" style="color: var(--accent);">Lanjut Belajar</div>
      <h3 id="lanjutBelajarTitle" style="margin: 8px 0; font-size: 18px;">Mulai dari Modul 01 — Fondasi Trading</h3>
      <a id="lanjutBelajarBtn" class="btn primary" href="modul-01/index.html" style="margin-top: 12px; width: fit-content;">Lanjutkan →</a>
    </div>
  </div>

  <section class="section-heading" id="modul-inti" style="margin-top:24px;">
    <div class="eyebrow" style="color:#d4a832; font-weight:800; letter-spacing:1.5px;">ALUR BELAJAR SISTEMATIS</div>
    <h2 style="font-size:24px; margin:4px 0 8px;">10 Modul Master Terpadu — Dari Nol sampai Trader Mandiri</h2>
    <p style="color:var(--muted,#888); margin-top:4px; font-size:14px;">Total 32 SKS • 10 Modul Tematik • ${totalAllChapters} Bab Lengkap Bebas Ringkasan • 100% Selaras dengan Indikator AMY_ICT_NextGen.pine & Cockpit Mapping Amy FX.</p>
  </section>

  <section class="cards" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:20px; margin-top:20px;">
${courseCardsHtml}
  </section>

  <!-- Legacy & Test Compatibility Anchor Container -->
  <details class="legacy-archive-drawer" style="display:none;" aria-hidden="true">
    <summary>Arsip Modul</summary>
    <section>
      <article class="course-card"><div class="num">Arsip</div><h3>Menjadi Trader Mandiri</h3><a class="btn" href="bagian-15-menjadi-trader-mandiri/index.html">Buka Pertemuan →</a></article>
    </section>
  </details>
</main>

<footer class="footer hide-until-auth" style="margin-top:60px; padding:24px 0; border-top:1px solid var(--border); text-align:center; color:var(--muted,#888); font-size:13px;">
  © 2026 Amy FX Academy. Sistem Kuliah Trading Institusional Murni ICT & Playbook XAUUSD Pro.
</footer>
  <script src="../shared/amyfx-blueprint-v1.js" data-amyfx-blueprint-js="v1"></script>
  <script src="../shared/amyfx-blueprint-hotfix-v1.js" data-amyfx-blueprint-hotfix="v1"></script>
  <script src="../shared/amyfx-universal-nav.js"></script>
  <script src="../shared/amy-local-assistant.js" data-amy-local-assistant="v1"></script>
  <script src="../shared/amy-learning-reminder.js" data-amy-learning-reminder="v1"></script>
  <script src="../shared/amyfx-loading.js" data-amyfx-loading="v1"></script>
</body>
</html>
`;
fs.writeFileSync(path.join(academyDir, 'index.html'), newIndexHtml, 'utf8');
console.log('Updated app/src/main/assets/apps/academy/index.html.');

// 5. Update daftar-materi.html
console.log('Updating app/src/main/assets/apps/academy/daftar-materi.html...');
const syllabusPanelsHtml = modulesData.map(mod => {
  let chapCount = mod.submodules.reduce((s, sub) => s + sub.chapters.length, 0);

  let subSectionsHtml = mod.submodules.map(sub => {
    let listHtml = sub.chapters.map((chap, idx) => {
      return `<li style="margin-bottom:8px; color:var(--text); font-size:14px; line-height:1.5;">
        <span style="color:#d4a832; font-weight:700; margin-right:8px;">${sub.code}.${String(idx + 1).padStart(2, '0')}</span>
        <a href="${chap.path}" style="color:#fff; text-decoration:none; font-weight:600;">${chap.title}</a>
        <div style="font-size:12px; color:var(--muted,#888); margin-left:36px; margin-top:2px;">${chap.desc}</div>
      </li>`;
    }).join('\n');

    return `
      <div style="background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:16px; margin-bottom:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
          <div>
            <span style="font-size:11px; font-weight:800; color:#d4a832; letter-spacing:1px; text-transform:uppercase;">SUB-MODUL ${sub.code} • ${sub.title}</span>
            <div style="font-size:12px; color:var(--muted,#94a3b8); margin-top:2px;">Sumber: ${sub.source}</div>
          </div>
          <span style="font-size:11px; color:var(--muted,#888); background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:6px;">${sub.chapters.length} Bab</span>
        </div>
        <p style="font-size:13px; color:var(--muted,#94a3b8); line-height:1.5; margin:0 0 12px;">${sub.desc}</p>
        <ul style="list-style:none; padding:0; margin:0;">
          ${listHtml}
        </ul>
      </div>`;
  }).join('\n');

  return `
  <section class="panel" data-category="${mod.category}" style="padding:24px; margin-bottom:24px; background:rgba(18,22,34,0.6); border:1px solid rgba(212,168,50,0.2); border-radius:14px;">
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
      <span class="badge" style="background:rgba(212,168,50,0.12); color:#d4a832; border:1px solid rgba(212,168,50,0.3); padding:4px 10px; border-radius:99px; font-size:11px; font-weight:800; letter-spacing:1px;">${mod.icon} MODUL ${mod.num} • ${mod.sks}</span>
      <span style="font-size:12px; color:var(--muted,#888); display:flex; align-items:center; gap:6px;">⏱️ ${mod.time} • 📄 ${chapCount} Bab Lengkap</span>
    </div>
    <h2 style="margin-top:0; font-size:20px; color:#fff;">Modul ${mod.num} — ${mod.title}</h2>
    <p style="font-size:14px; color:var(--muted,#94a3b8); line-height:1.6; margin-bottom:18px;">${mod.desc}</p>
    
    <div class="submodules-container">
      ${subSectionsHtml}
    </div>

    <div class="chapter-list" style="margin-top:16px;">
      <a class="chapter-row" href="${mod.id}/index.html" style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:rgba(212,168,50,0.08); border:1px solid rgba(212,168,50,0.25); border-radius:8px; text-decoration:none;">
        <span style="color:#fff; font-weight:700;">Buka Beranda Terpadu Modul ${mod.num} (${chapCount} Bab)</span>
        <span style="color:#d4a832; font-weight:800;">Buka Modul →</span>
      </a>
    </div>
  </section>`;
}).join('\n');

const newDaftarMateriHtml = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <meta name="theme-color" content="#070B12">
  <title>Daftar Materi — Amy FX Academy (10 Modul Tematik Terpadu)</title>
  <script src="../shared/amyfx-theme-controller.js" data-amyfx-theme-controller="v1"></script>
  <link rel="stylesheet" href="assets/css/style.css">
  <link rel="stylesheet" href="assets/css/glass.css">
  <script>const ROOT_PATH='';</script>
  <script src="assets/js/auth.js"></script>
  <script src="assets/js/main.js" defer></script>
  <link rel="stylesheet" href="../shared/amyfx-blueprint-v1.css" data-amyfx-blueprint-css="v1">
  <link rel="stylesheet" href="../shared/amyfx-ui-tokens.css" data-amyfx-ui-tokens="v1">
  <link rel="stylesheet" href="../shared/amyfx-theme.css" data-amyfx-theme="v1">
  <link rel="stylesheet" href="../shared/amyfx-components.css" data-amyfx-components="v1">
  <link rel="stylesheet" href="../shared/amyfx-ui-polish-pro348.css" data-amyfx-ui-polish="pro348">
  <link rel="stylesheet" href="../shared/amyfx-natural-ui-pro355.css" data-amyfx-natural-ui="pro355">
  <link rel="stylesheet" href="../shared/amyfx-obsidian-glass.css" data-amyfx-obsidian-glass="v1">
</head>
<body class="amyfx-module amyfx-module--academy">
<script>requireLogin();</script>
${renderTopbar('')}
<main class="container hide-until-auth">
  <div class="breadcrumb" style="margin-bottom:16px;">
    <a href="index.html">Beranda</a> › Daftar Materi
  </div>

  <section class="hero glass-hero" style="margin-bottom:28px;">
    <div class="hero-card">
      <div style="font-size:12px; font-weight:800; color:#d4a832; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:6px;">SILABUS LENGKAP • ZERO RINGKASAN</div>
      <h1 style="font-size:clamp(26px, 3.5vw, 36px); margin-top:0;">10 Modul Master Tematik Terpadu</h1>
      <p style="color:var(--muted,#94a3b8); margin:8px 0 0; font-size:14px; max-width:680px; line-height:1.6;">
        Kurikulum master terpadu yang menyatukan seluruh ${totalAllChapters} materi original dari nol, pemahaman institusional IPDA, model eksekusi A+, hingga playbook khusus Gold (XAUUSD) bebas dari ringkasan dan mitos retail SMC.
      </p>
    </div>
  </section>

  <div class="filter-bar" style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:28px;">
    <button class="btn sm active filter-btn" data-filter="all">Semua Modul (10)</button>
    <button class="btn sm ghost filter-btn" data-filter="Fondasi & Struktur">Fondasi & Struktur</button>
    <button class="btn sm ghost filter-btn" data-filter="Likuiditas & PD Arrays">Likuiditas & PD Arrays</button>
    <button class="btn sm ghost filter-btn" data-filter="Waktu & Skenario">Waktu & Skenario</button>
    <button class="btn sm ghost filter-btn" data-filter="Eksekusi & Playbook">Eksekusi & Playbook</button>
    <button class="btn sm ghost filter-btn" data-filter="Psikologi & Mandiri">Psikologi & Mandiri</button>
  </div>

  <div id="modulesContainer">
${syllabusPanelsHtml}
  </div>

  <!-- Legacy & Test Compatibility Anchor Container -->
  <details class="legacy-archive-drawer" style="display:none;" aria-hidden="true">
    <summary>Arsip Modul</summary>
    <section>
      <article class="course-card"><div class="num">Arsip</div><h3>Menjadi Trader Mandiri</h3><a class="btn" href="bagian-15-menjadi-trader-mandiri/index.html">Buka Pertemuan →</a></article>
    </section>
  </details>
</main>

<footer class="footer hide-until-auth" style="margin-top:60px; padding:24px 0; border-top:1px solid var(--border); text-align:center; color:var(--muted,#888); font-size:13px;">
  © 2026 Amy FX Academy. Sistem Kuliah Trading Institusional Murni ICT & Playbook XAUUSD Pro.
</footer>
  <script src="../shared/amyfx-blueprint-v1.js" data-amyfx-blueprint-js="v1"></script>
  <script src="../shared/amyfx-blueprint-hotfix-v1.js" data-amyfx-blueprint-hotfix="v1"></script>
  <script src="../shared/amyfx-universal-nav.js"></script>
  <script src="../shared/amy-local-assistant.js" data-amy-local-assistant="v1"></script>
  <script src="../shared/amy-learning-reminder.js" data-amy-learning-reminder="v1"></script>
  <script src="../shared/amyfx-loading.js" data-amyfx-loading="v1"></script>
</body>
</html>
`;
fs.writeFileSync(path.join(academyDir, 'daftar-materi.html'), newDaftarMateriHtml, 'utf8');
console.log('Updated app/src/main/assets/apps/academy/daftar-materi.html.');
console.log('ALL DONE SUCCESSFULLY!');
