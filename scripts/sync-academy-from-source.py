#!/usr/bin/env python3
"""Safe sync for Amy FX Academy: refresh lesson content while preserving app shell and local auth assets."""

import os, shutil, filecmp
from pathlib import Path

ROOT = Path('/sdcard/Download')
SRC = ROOT / 'amy-trading-academy'
DEST = ROOT / 'Amy-fx' / 'app' / 'src' / 'main' / 'assets' / 'apps' / 'academy'

SHELL = {
    'admin',
    '.github',
    '.obsidian',
    '.git',
    'assets',  # preserve existing app assets until we confirm specific files to overwrite
    'index.html',
    'login.html',
    'tentang.html',
    'daftar-materi.html',
}

LESSON_DIRS = [
    'bagian-01-pemula-nol',
    'bagian-02-membaca-chart',
    'bagian-03-fondasi-market',
    'bagian-04-liquidity',
    'bagian-05-smart-money-concept',
    'bagian-06-ict-core',
    'bagian-07-bias-dan-top-down',
    'bagian-08-session-dan-waktu',
    'bagian-09-entry-model',
    'bagian-10-xauusd-playbook',
    'bagian-11-advanced-ict',
    'bagian-12-risk-management',
    'bagian-13-psikologi-trading',
    'bagian-14-backtesting-dan-jurnal',
    'bagian-15-menjadi-trader-mandiri',
    'bagian-16-advanced-entry-logic',
    'bagian-17-fvg-masterclass',
    'bagian-18-order-block-masterclass',
    'bagian-19-liquidity-masterclass',
    'bagian-20-idm-inducement-masterclass',
    'bagian-21-ifvg-inversion-model',
    'bagian-22-block-advanced',
    'bagian-23-premium-discount-advanced',
    'bagian-24-market-structure-advanced',
    'bagian-25-session-entry-model',
    'bagian-26-xauusd-advanced-playbook',
    'bagian-27-no-trade-advanced',
    'bagian-28-trade-management-advanced',
    'bagian-29-backtest-advanced',
    'bagian-30-a-plus-setup-library',
    'bagian-30-setup-library',
    'bagian-31-ict-advanced-concepts',
    'bagian-32-trading-tools-setup',
    'bagian-33-live-case-studies',
    'bagian-34-prop-firm-mastery',
    'bagian-35-trading-plan-template',
    'bagian-36-psikologi-smc-lanjutan',
    'assets',
    'data',
    'glosarium',
    'images',
    'tools',
]


def refresh_dir(src_dir: Path, dest_dir: Path):
    if not src_dir.exists():
        return []
    if dest_dir.exists():
        shutil.rmtree(dest_dir)
    shutil.copytree(src_dir, dest_dir)
    touched = []
    for root, _, files in os.walk(dest_dir):
        for f in files:
            p = Path(root) / f
            touched.append(str(p.relative_to(DEST)))
    return touched


def rewrite_branding(path: Path):
    if path.suffix.lower() != '.html' or path.name in {'index.html', 'login.html', 'tentang.html', 'daftar-materi.html'}:
        return False
    txt = path.read_text(encoding='utf-8', errors='ignore')
    orig = txt
    txt = txt.replace('Amy Trading Academy</span>', 'Amy FX Academy</span>')
    txt = txt.replace('>Amy Trading Academy<', '>Amy FX Academy<')
    txt = txt.replace('<title>Amy Trading Academy</title>', '<title>Amy FX Academy</title>')
    txt = txt.replace('<title>Beranda — Amy Trading Academy</title>', '<title>Beranda — Amy FX Academy</title>')
    txt = txt.replace('© 2026 Amy Trading Academy. Belajar Trading dari Nol sampai Mandiri.', '© 2026 Amy FX Academy. Belajar Trading dari Nol sampai Mandiri.')
    txt = txt.replace('© 2026 Amy Trading Academy', '© 2026 Amy FX Academy')
    if txt != orig:
        path.write_text(txt, encoding='utf-8')
        return True
    return False


def main():
    touched = []
    for d in LESSON_DIRS:
        touched.extend(refresh_dir(SRC / d, DEST / d))
    for p in DEST.rglob('*.html'):
        rewrite_branding(p)
    print('summary_touched=', len(touched))
    for x in touched[:40]:
        print('TOUCHED', x)
    print('...')
    print('summary_brand=', sum(1 for _ in DEST.rglob('*.html') if rewrite_branding(Path(_))))


if __name__ == '__main__':
    main()
