"""Build 60 pedagogical OHLC scenarios. Prices are illustrative, never market history."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'app/src/main/assets/apps/academy'
lessons = {
 'fvg': ('bagian-20-idm-inducement-masterclass/index.html#fair-value-gap-fvg-celah-imbalance', 'Fair Value Gap (FVG)'),
 'liquidity': ('bagian-17-fvg-masterclass/index.html#equal-highs-dan-equal-lows', 'Equal highs, equal lows dan liquidity'),
 'structure': ('bagian-02-membaca-chart/index.html#market-structure-dasar', 'Market structure dasar'),
 'range': ('bagian-05-smart-money-concept/index.html#premium-dan-discount', 'Premium, discount dan dealing range'),
 'risk': ('bagian-10-xauusd-playbook/index.html#cara-menentukan-sltp-gold', 'Menentukan SL dan TP Gold'),
}
exercises=[]
def add(kind, side, rows, marks, levels, questions, evidence):
    for j,(prompt,answer,wrong,reason) in enumerate(questions):
        n=len(exercises)
        # Translation preserves every OHLC/pattern relationship; each question owns its chart.
        shift=(n//6)*20
        candles=[dict(time=1704067200+n*86400+i*900,open=round(o+shift,2),high=round(h+shift,2),low=round(l+shift,2),close=round(c+shift,2)) for i,(o,h,l,c) in enumerate(rows)]
        price=lambda x: f'{x+shift:.2f}'
        def fmt(s):
            import re
            return re.sub(r'\{(\d+(?:\.\d+)?)\}',lambda m:price(float(m[1])),s)
        path,title=lessons[kind]
        file_path = BASE / path.split('#')[0]
        assert file_path.is_file(), file_path
        exercises.append(dict(id=f'{kind}-{side}-{j+1}',category=title,topic=kind,difficulty=['mudah','mudah','sedang','sedang','advanced','advanced'][j],title=f'{title} · studi {n+1}',type='choice',timeframe='M15',source='illustrative-ohlc-v2',prompt=fmt(prompt),answer=fmt(answer),choices=[fmt(answer)]+[fmt(w) for w in wrong],principle=fmt(reason),lesson={'href':'../'+path,'title':title},candles=candles,markers=[{'time':candles[i]['time'],'position':'aboveBar','color':'#60a5fa','shape':'circle','text':t} for i,t in marks],levels=[{'price':p+shift,'title':t,'color':'#94a3b8'} for p,t in levels],evidence=evidence,chartGuide='Candle A/B/C dan garis acuan adalah bagian dari soal. Geser atau perbesar chart; sentuh candle untuk melihat OHLC.'))

# 1. Fair Value Gap (FVG) — 21 candles with realistic market swing context
for bullish in [True,False]:
    side='bullish' if bullish else 'bearish'
    # 18 realistic context candles showing higher low and base accumulation leading into FVG
    context = [
        (98.0, 99.5, 97.5, 99.0),
        (99.0, 100.5, 98.8, 100.2),
        (100.2, 101.5, 99.8, 101.0),
        (101.0, 101.8, 100.5, 100.8),
        (100.8, 101.2, 99.5, 99.8),
        (99.8, 100.2, 98.5, 98.8),
        (98.8, 99.2, 97.8, 98.0),
        (98.0, 98.6, 97.0, 97.5),
        (97.5, 98.5, 97.2, 98.2),
        (98.2, 99.6, 98.0, 99.2),
        (99.2, 100.5, 98.9, 100.0),
        (100.0, 101.2, 99.7, 100.8),
        (100.8, 101.8, 100.3, 101.4),
        (101.4, 102.2, 101.0, 101.8),
        (101.8, 102.5, 101.3, 102.0),
        (102.0, 102.8, 101.5, 102.3),
        (102.3, 103.2, 101.8, 102.6),
        (102.6, 103.5, 102.0, 102.9),
    ]
    # Candle A (index 18), B (index 19 - displacement), C (index 20)
    pattern = [
        (102.0, 104.0, 101.0, 103.0),
        (103.0, 113.0, 102.0, 112.0),
        (112.0, 115.0, 109.0, 114.0)
    ]
    rows = context + pattern
    if not bullish: rows=[(220-o,220-l,220-h,220-c) for o,h,l,c in rows]
    lo,hi=(104,109) if bullish else (111,116)
    a_idx, b_idx, c_idx = 18, 19, 20
    q=[
      ('Amati candle A–B–C. Jenis imbalance yang terbentuk?',f'FVG {side}',[f'FVG {"bearish" if bullish else "bullish"}','Tidak ada FVG'],'FVG tiga candle memakai wick A dan C yang tidak overlap, dengan displacement pada B.'),
      ('Candle mana yang menjadi dorongan tengah pembentuk FVG?','B',['A','C'],'B berada di tengah dan memiliki body besar; gap dibuktikan oleh wick A dan C.'),
      ('Berapa batas bawah dan atas FVG A–C?',f'{{{lo}}} – {{{hi}}}',[f'{{{lo-3}}} – {{{lo}}}',f'{{{hi}}} – {{{hi+4}}}'],f'Batas gap adalah high A dan low C untuk bullish, low A dan high C untuk bearish. Di sini: {{{lo}}}–{{{hi}}}.'),
      ('Di harga mana midpoint / consequent encroachment FVG?',f'{{{(lo+hi)/2}}}',[f'{{{lo}}}',f'{{{hi}}}'],'CE = (batas bawah + batas atas) / 2. CE bukan jaminan harga akan bereaksi.'),
      ('Chart berakhir di C. Apakah entry retest FVG sudah terjadi?','Belum ada candle retest setelah C',['Sudah, karena B besar','Sudah, karena FVG terbentuk'],'Formasi FVG dan retest adalah dua peristiwa berbeda. Chart belum memuat candle setelah pembentukan.'),
      ('Apa yang dapat disimpulkan dari chart ini saja?','FVG terbentuk; bias HTF dan validasi entry belum tersedia',['Pasti profit jika entry di CE','Bias semua timeframe sudah sama'],'Chart membuktikan geometri FVG saja. Bias HTF, risiko dan konfirmasi entry harus dinilai terpisah.')]
    add('fvg',side,rows,[(a_idx,'A'),(b_idx,'B'),(c_idx,'C')],[(lo,'Batas bawah zona'),(hi,'Batas atas zona')],q,{'pattern':'fvg','direction':side,'a':a_idx,'b':b_idx,'c':c_idx})

# 2. Equal Highs / Lows and Liquidity Sweep — 20 candles with multi-wave price action
for high in [True,False]:
    side='BSL' if high else 'SSL'
    rows = [
        (100.0, 102.5, 99.5, 102.0),
        (102.0, 104.0, 101.5, 103.5),
        (103.5, 105.5, 102.8, 105.0),
        (105.0, 107.0, 104.5, 106.5),
        (106.5, 108.5, 105.8, 107.8),
        (107.8, 109.5, 107.0, 108.5),
        # Candle A (index 6): High 110
        (108.5, 110.0, 107.5, 109.0),
        # Pullback 6 candles dipping to 103-104
        (109.0, 109.5, 106.5, 107.0),
        (107.0, 107.5, 104.5, 105.0),
        (105.0, 105.8, 103.0, 103.5),
        (103.5, 105.0, 103.0, 104.5),
        (104.5, 107.0, 104.0, 106.5),
        (106.5, 108.8, 106.0, 108.2),
        # Candle B (index 13): High 110 (Equal High)
        (108.2, 110.0, 107.8, 108.8),
        # Pullback 5 candles
        (108.8, 109.2, 106.8, 107.2),
        (107.2, 107.8, 105.2, 105.8),
        (105.8, 106.5, 104.5, 105.0),
        (105.0, 106.2, 104.2, 105.5),
        (105.5, 107.5, 105.0, 106.8),
        # Candle C (index 19): High 113 (Sweep), Close 107 (Reclaim)
        (106.8, 113.0, 106.0, 107.0)
    ]
    if not high: rows=[(220-o,220-l,220-h,220-c) for o,h,l,c in rows]
    close=107 if high else 113
    a_idx, b_idx, c_idx = 6, 13, 19
    q=[
     ('Dua wick A dan B berada di level yang sama. Pool yang ditunjukkan?', 'Buy-side liquidity di atas equal highs' if high else 'Sell-side liquidity di bawah equal lows',['FVG tiga candle','Tidak ada level yang berulang'],'Equal highs/lows adalah acuan potensi kumpulan stop, bukan pengamatan langsung seluruh order pasar.'),
     ('Candle mana yang menembus level A/B kemudian close kembali?','C',['A','B'],'C melewati level referensi dengan wick lalu close kembali di sisi sebelumnya.'),
     ('Berapa harga level acuan A/B?','{110}',['{103}','{113}'],'Bandingkan kedua wick A dan B: keduanya tepat di level acuan yang ditandai.'),
     ('Mengapa C dibaca sebagai sweep/reclaim, bukan close breakout?','Wick melewati level dan close kembali',['Warna candle saja cukup','Setiap high/low baru adalah breakout'],f'C menembus {{110}}, tetapi close di {{{close}}}. Posisi close terhadap level membedakan reclaim dari close-through.'),
     ('Apakah sweep C sendirian memastikan pembalikan tren?','Tidak; tunggu konfirmasi struktur dan konteks',['Ya, pasti reversal','Ya, selalu entry tanpa SL'],'Sweep adalah kejadian harga. Konfirmasi sesudahnya belum terlihat di chart.'),
     ('Bukti mana yang belum tersedia sampai candle C?','MSS lanjutan setelah sweep',['Dua wick pada level sama','Wick melewati level acuan'],'Tidak ada candle setelah C. Jangan mengasumsikan MSS atau hasil trade yang belum terjadi.')]
    add('liquidity',side,rows,[(a_idx,'A'),(b_idx,'B'),(c_idx,'C')],[(110,'Level A/B')],q,{'pattern':'sweep','direction':'high' if high else 'low','a':a_idx,'b':b_idx,'c':c_idx})

# 3. Market Structure (BOS / MSS Break) — 18 candles with realistic structure
for bull in [True,False]:
    side='break naik' if bull else 'break turun'
    rows = [
        (100.0, 102.5, 99.5, 102.0),
        (102.0, 104.0, 101.5, 103.5),
        (103.5, 105.5, 102.8, 105.0),
        (105.0, 107.0, 104.5, 106.5),
        (106.5, 108.5, 105.8, 107.5),
        (107.5, 109.2, 106.8, 108.5),
        # Candle A (index 6): Swing High 110
        (108.5, 110.0, 107.5, 108.8),
        # Retracement 6 candles
        (108.8, 109.2, 106.0, 106.5),
        (106.5, 107.2, 104.0, 104.5),
        (104.5, 105.5, 102.5, 103.0),
        (103.0, 104.8, 102.8, 104.2),
        (104.2, 106.5, 103.8, 106.0),
        (106.0, 108.5, 105.5, 107.8),
        # Candle B (index 13): High 112 (wick only), Close 109 (< 110)
        (107.8, 112.0, 106.8, 109.0),
        # Dip 3 candles
        (109.0, 109.5, 106.5, 107.2),
        (107.2, 108.0, 106.0, 106.8),
        (106.8, 109.2, 106.5, 108.8),
        # Candle C (index 17): Breakout Close 116 (> 110)
        (108.8, 117.0, 108.0, 116.0)
    ]
    if not bull: rows=[(220-o,220-l,220-h,220-c) for o,h,l,c in rows]
    a_idx, b_idx, c_idx = 6, 13, 17
    q=[
     ('Candle C close di sisi mana dari level swing A?','Di atas swing A' if bull else 'Di bawah swing A',['Tepat di swing A','Belum menyentuh swing A'],'Baca close C terhadap garis swing A, bukan hanya wick tertinggi/terendah.'),
     ('Candle mana hanya menembus dengan wick tanpa close melewati swing?','B',['A','C'],'B menembus swing tetapi close kembali; C baru close melewati level.'),
     ('Level struktur yang dilampaui close C adalah?','{110}',['{101}','{117}'],'Level {110} berasal dari wick swing A yang terbentuk sebelum breakout.'),
     ('Manakah bukti lebih kuat untuk close-break pada chart ini?','Close C melewati swing A',['Wick B saja','Warna A saja'],'Break berbasis close harus dibuktikan oleh penutupan melewati swing yang sudah ada.'),
     ('Dapatkah satu window ini memastikan label BOS continuation atau MSS reversal?','Perlu konteks tren sebelum window',['Pasti BOS continuation','Pasti MSS reversal'],'Arah break terlihat, tetapi BOS continuation versus MSS reversal memerlukan struktur/tren sebelumnya.'),
     ('Apakah retest level yang ditembus sudah terkonfirmasi?','Belum; chart berhenti pada candle break C',['Sudah karena wick B','Sudah karena C besar'],'Retest harus terjadi sesudah break; tidak boleh memakai candle B sebelum break C sebagai retest.')]
    add('structure',side,rows,[(a_idx,'A'),(b_idx,'B'),(c_idx,'C')],[(110,'Swing A')],q,{'pattern':'break','direction':'up' if bull else 'down','a':a_idx,'b':b_idx,'c':c_idx})

# 4. Premium, Discount and Dealing Range — 20 candles with natural wave oscillation
for premium in [False,True]:
    side='premium' if premium else 'discount'
    last=115 if premium else 105
    if premium:
        retrace = [
            (119.0, 119.5, 117.0, 117.5),
            (117.5, 118.0, 115.5, 116.0),
            (116.0, 117.2, 114.5, 115.0),
            (115.0, 116.0, 113.5, 114.0),
            (114.0, 115.5, 112.5, 113.5),
            (113.5, 115.0, 112.0, 114.0),
            # Candle C: Close 115 (75% of range 100-120)
            (114.0, 116.5, 113.0, 115.0)
        ]
    else:
        retrace = [
            (119.0, 119.5, 116.5, 117.0),
            (117.0, 117.5, 114.0, 114.5),
            (114.5, 115.0, 111.5, 112.0),
            (112.0, 112.5, 109.0, 109.5),
            (109.5, 110.2, 107.0, 107.5),
            (107.5, 108.5, 105.5, 106.0),
            # Candle C: Close 105 (25% of range 100-120)
            (106.0, 107.5, 103.5, 105.0)
        ]
    rows = [
        (105.0, 106.5, 103.5, 104.0),
        (104.0, 104.8, 102.0, 102.5),
        (102.5, 103.0, 100.8, 101.2),
        (101.2, 102.0, 100.5, 101.5),
        # Candle A (index 4): Range Low 100.0
        (101.5, 103.0, 100.0, 102.5),
        # Swing up to Range High 120
        (102.5, 105.0, 102.0, 104.5),
        (104.5, 107.5, 104.0, 107.0),
        (107.0, 109.5, 106.5, 109.0),
        (109.0, 112.0, 108.5, 111.5),
        (111.5, 114.5, 111.0, 114.0),
        (114.0, 117.0, 113.5, 116.5),
        (116.5, 119.0, 115.8, 118.5),
        # Candle B (index 12): Range High 120.0
        (118.5, 120.0, 117.5, 119.0)
    ] + retrace
    a_idx, b_idx, c_idx = 4, 12, 19
    q=[
     ('Close C berada di bagian mana dari dealing range A–B?',side.capitalize(),['Equilibrium',('Discount' if premium else 'Premium')],'Premium di atas midpoint; discount di bawah midpoint dari range yang dinyatakan dalam soal.'),
     ('Berapa equilibrium range {100}–{120}?','{110}',['{100}','{120}'],'Equilibrium = (range high + range low) / 2.'),
     ('Berapa posisi relatif close C dari batas bawah range?', '75%' if premium else '25%',['50%','100%'],f'Posisi = (close − low) / (high − low). Close {{{last}}}, low {{100}}, high {{120}}.'),
     ('Level mana yang merupakan batas external atas range?','{120}',['{110}','{105}'],'External atas adalah high pembentuk range B; midpoint adalah level internal.'),
     ('Apakah lokasi close C cukup untuk langsung entry?','Tidak; lokasi harus dipadukan konteks dan konfirmasi',['Ya, lokasi menjamin arah','Ya, tanpa perlu risiko'],'Premium/discount adalah lokasi relatif terhadap range terpilih, bukan sinyal mandiri.'),
     ('Jika memakai range timeframe lebih tinggi, apa yang harus dilakukan?','Hitung ulang posisi dengan high/low range HTF',['Pertahankan persentase yang sama','Anggap seluruh timeframe identik'],'Persentase lokasi bergantung pada pasangan batas range. Chart ini hanya menunjukkan range yang ditetapkan.')]
    add('range',side,rows,[(a_idx,'A'),(b_idx,'B'),(c_idx,'C')],[(100,'Range low'),(110,'Equilibrium'),(120,'Range high')],q,{'pattern':'range','closeIndex':c_idx,'position':0.75 if premium else 0.25})

# 5. Risk, SL and TP Gold — 19 candles with realistic price action setup
for buy in [True,False]:
    side='BUY' if buy else 'SELL'
    entry,stop,target=(110,105,120) if buy else (110,115,100)
    if buy:
        context = [
            (118.0, 119.5, 117.0, 117.5),
            (117.5, 118.0, 115.5, 116.0),
            (116.0, 116.8, 113.5, 114.0),
            (114.0, 114.5, 111.0, 111.5),
            (111.5, 112.2, 108.5, 109.0),
            (109.0, 109.8, 106.0, 106.5),
            (106.5, 107.0, 104.5, 105.2),
            (105.2, 106.5, 104.8, 106.0),
            (106.0, 107.5, 105.5, 107.0),
            (107.0, 108.5, 106.5, 108.0),
            (108.0, 109.2, 107.2, 108.5),
            (108.5, 109.5, 107.8, 109.0),
            (109.0, 110.5, 108.5, 109.8),
            (109.8, 111.2, 109.2, 110.5),
            (110.5, 111.0, 109.0, 109.5),
            (109.5, 110.2, 108.8, 109.2),
            (109.2, 110.0, 108.5, 109.8),
            (109.8, 110.8, 109.0, 110.2),
            # Candle C (index 18): Entry test at Close 110.0
            (109.5, 111.5, 108.8, 110.0)
        ]
    else:
        context = [
            (102.0, 103.5, 101.5, 103.0),
            (103.0, 104.8, 102.5, 104.2),
            (104.2, 106.5, 103.8, 106.0),
            (106.0, 108.5, 105.5, 108.0),
            (108.0, 111.0, 107.8, 110.5),
            (110.5, 113.5, 110.0, 113.0),
            (113.0, 115.5, 112.5, 115.0),
            (115.0, 115.5, 113.5, 114.0),
            (113.0, 113.5, 111.5, 112.0),
            (112.0, 112.5, 110.8, 111.5),
            (111.5, 112.0, 110.2, 111.0),
            (111.0, 111.5, 109.5, 110.2),
            (110.2, 110.8, 109.0, 109.5),
            (109.5, 111.0, 109.2, 110.5),
            (110.5, 111.2, 109.8, 110.8),
            (110.8, 111.5, 110.0, 110.2),
            (110.2, 111.0, 109.5, 109.8),
            (109.8, 110.5, 108.8, 109.5),
            # Candle C (index 18): Entry test at Close 110.0
            (110.5, 111.8, 109.2, 110.0)
        ]
    rows = context
    c_idx = 18
    q=[
     (f'Rencana {side}: garis Entry, SL, TP terlihat. Berapa jarak risiko entry–SL?','5 poin',['10 poin','15 poin'],'Risiko harga = nilai absolut entry − SL. Nilai uang per poin belum diberikan.'),
     (f'Rencana {side}: berapa jarak reward entry–TP?','10 poin',['5 poin','20 poin'],'Reward harga = nilai absolut TP − entry.'),
     ('Berapa reward:risk rencana pada chart?','2:1',['1:2','1:1'],'Reward 10 poin dibagi risiko 5 poin = 2R, belum memperhitungkan biaya.'),
     (f'Untuk {side}, apakah posisi SL dan TP terhadap entry valid secara geometri?','Ya, SL di sisi rugi dan TP di sisi untung',['Tidak, SL dan TP terbalik','Tidak, karena entry harus sama dengan SL'],'BUY: SL < entry < TP. SELL: TP < entry < SL. Validasi geometri tidak membuktikan kualitas sinyal.'),
     ('Chart berhenti di C sebelum trade berjalan. Apakah TP/SL sudah boleh dicatat?','Belum, perlu candle setelah entry',['Catat TP karena 2R','Catat SL karena wick sebelumnya'],'Candle sebelum/saat keputusan bukan hasil trade ke depan. Jangan mengisi outcome tanpa data lanjutan.'),
     ('Jika biaya round-trip setara 1 poin, reward bersih pada TP berapa?','9 poin',['10 poin','11 poin'],'Reward kotor 10 poin − biaya 1 poin = 9 poin. RR kotor bukan hasil bersih setelah biaya.')]
    add('risk',side,rows,[(c_idx,'C')],[(entry,'Entry'),(stop,'SL'),(target,'TP')],q,{'pattern':'risk','side':side})

assert len(exercises)==60
(BASE/'trading-practice/assets/data/guided-exercises.json').write_text(json.dumps({'schemaVersion':2,'source':'Skenario OHLC ilustratif untuk belajar; bukan harga pasar atau hasil backtest.','exercises':exercises},ensure_ascii=False,indent=2)+'\n')
print(f'Successfully generated {len(exercises)} exercises with rich candle context!')
