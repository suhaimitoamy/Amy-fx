#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "preview-update.json"
README = ROOT / "README.md"


def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if int(manifest.get("latest_version_code", 0)) != 940315:
        raise RuntimeError("Preview .315 manifest is not active")
    if str(manifest.get("latest_version_name")) != "2.0.0-preview.315":
        raise RuntimeError("Preview .315 version name is not active")

    manifest["release_notes"] = [
        "Valid Break kini membaca schema struktur modern dan legacy secara konsisten; BOS/MSS terkonfirmasi tidak lagi hilang karena renderer membaca field lama.",
        "Tulisan Data belum cukup hanya muncul bila jumlah candle benar-benar kurang; error analisis dengan 300 candle sekarang ditampilkan sebagai error yang sebenarnya.",
        "Freshness candle ditentukan dari timestamp candle terakhir tertutup, bukan hanya waktu fetch, sehingga 300 candle lama tidak dapat disebut data terbaru.",
        "Keterlambatan provider ditampilkan sebagai CANDLE TERTUNDA beserta jumlah bar dan tidak disamarkan menjadi CANDLE TERTUTUP.",
        "Kegagalan refresh timeframe aktif tidak lagi disembunyikan dari data warning.",
        "Direction Forecast, Mapping Accuracy V3, rumus Entry/SL/TP, lifecycle, package, signer, dan data pengguna tidak diubah."
    ]
    manifest["changelog"] = [
        "Modern and legacy structure-break schema resolver",
        "Truthful all-timeframe candle and analysis status",
        "Closed-candle timestamp freshness validation",
        "Provider delay visibility and active-timeframe warning",
        "Regression coverage for break and candle truth"
    ]
    MANIFEST.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8"
    )

    text = README.read_text(encoding="utf-8")
    text = text.replace("2.0.0-preview.314", "2.0.0-preview.315")
    text = text.replace("940314", "940315")
    text = text.replace("## Status Release `.314`", "## Status Release `.315`")

    start_marker = "Preview `.315` menambahkan konteks Mapping"
    end_marker = (
        "Adaptive EQH/EQL dan alternatif origin Order Block **belum mengganti "
        "logika produksi**. Keduanya hanya mengeluarkan metadata eksperimen sampai "
        "memiliki validasi out-of-sample yang cukup."
    )
    if start_marker not in text:
        raise RuntimeError("README release introduction was not found")
    if end_marker not in text:
        raise RuntimeError("README release ending was not found")
    start = text.index(start_marker)
    end = text.index(end_marker, start) + len(end_marker)

    replacement = """Preview `.315` memperbaiki ketidakjujuran antara data candle, detector struktur, dan tampilan Mapping. Perbaikan ini tidak memaksa arah BUY/SELL; tujuannya memastikan UI menampilkan hasil engine dan kondisi sumber candle yang sebenarnya.

Perubahan utama `.315`:

- panel Valid Break membaca schema struktur modern (`concept`, `direction`, `level`, `status`) maupun schema legacy;
- BOS/MSS terkonfirmasi tidak lagi hilang hanya karena renderer mencari field lama;
- `Data belum cukup` hanya digunakan bila candle tertutup benar-benar kurang dari minimum;
- bila 300 candle tersedia tetapi analisis gagal, UI menampilkan `Analisis gagal meski 300 candle tersedia` beserta error sebenarnya;
- freshness memakai timestamp candle tertutup terbaru, bukan waktu fetch request;
- provider yang tertinggal ditampilkan sebagai `CANDLE TERTUNDA N BAR` dan tidak disamarkan menjadi `CANDLE TERTUTUP`;
- kegagalan refresh timeframe aktif ikut diteruskan sebagai warning;
- perubahan konteks `.314`—DST-aware session, PMH/PML, Strong/Weak High-Low, Midnight Open, evidence contract, dan advisory experiments—tetap dipertahankan.

Direction Forecast, Mapping Accuracy V3, rumus Entry, Stop Loss, Take Profit, target struktural, lifecycle setup, Execution Authority, package, signer, dan data pengguna tidak diubah."""

    README.write_text(text[:start] + replacement + text[end:], encoding="utf-8")


if __name__ == "__main__":
    main()
