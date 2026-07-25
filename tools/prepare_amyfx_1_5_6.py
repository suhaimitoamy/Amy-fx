from pathlib import Path


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, text):
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding='utf-8')


def replace_required(text, old, new, label):
    count = text.count(old)
    if count < 1:
        raise SystemExit(f'Missing release pattern in {label}: {old!r}')
    return text.replace(old, new)

# Android source identity.
path = 'app/build.gradle.kts'
text = read(path)
text = replace_required(text, '?: 46)', '?: 47)', path)
text = replace_required(text, '?: "1.5.5"', '?: "1.5.6"', path)
write(path, text)

path = 'app/src/main/assets/app-version.js'
text = read(path)
text = replace_required(text, "name: '1.5.5', code: 46", "name: '1.5.6', code: 47", path)
write(path, text)

# README release identity and notes.
path = 'README.md'
text = read(path)
text = replace_required(text, '**Versi:** `1.5.5`', '**Versi:** `1.5.6`', path)
text = replace_required(text, '**Version code:** `46`', '**Version code:** `47`', path)
anchor = '## Update v1.5.5'
section = '''## Update v1.5.6 — Perbaikan Restore Kuota Metadata

- Metadata Library dan Jurnal dipindahkan dari `localStorage` berkuota kecil ke IndexedDB.
- Data lama dimigrasikan otomatis setelah penyimpanan baru berhasil, tanpa menghapus lampiran.
- Restore menunggu metadata benar-benar tersimpan sebelum menampilkan status selesai.
- Cache thumbnail video tidak lagi menulis langsung ke `localStorage`.
- Error `tradingLibraryManager.items.v1 exceeded the quota` diperbaiki.
- Package, signing key permanen, data aplikasi, dan kanal update tetap dipertahankan.

'''
if '## Update v1.5.6' not in text:
    index = text.index(anchor)
    text = text[:index] + section + text[index:]
write(path, text)

# Tests that guard the production identity.
path = 'tests/five-issues-regression.test.mjs'
text = read(path)
text = replace_required(text, 'Amy FX 1.5.5 release identity', 'Amy FX 1.5.6 release identity', path)
text = replace_required(text, r'`1\.5\.5`', r'`1\.5\.6`', path)
text = replace_required(text, r'`46`', r'`47`', path)
text = replace_required(text, "name: '1\\.5\\.5', code: 46", "name: '1\\.5\\.6', code: 47", path)
text = replace_required(text, '[42, 43, 44, 45, 46]', '[42, 43, 44, 45, 46, 47]', path)
text = replace_required(text, "const expected = update.latest_version_code === 46\n    ? '1.5.5'", "const expected = update.latest_version_code === 47\n    ? '1.5.6'\n    : update.latest_version_code === 46\n      ? '1.5.5'", path)
write(path, text)

path = 'tests/production-release-identity.test.mjs'
text = read(path)
text = replace_required(text, 'Amy FX 1.5.5', 'Amy FX 1.5.6', path)
text = replace_required(text, r'\?: 46\)', r'\?: 47\)', path)
text = replace_required(text, r'\?: "1\.5\.5"', r'\?: "1\.5\.6"', path)
text = replace_required(text, "name: '1\\.5\\.5', code: 46", "name: '1\\.5\\.6', code: 47", path)
text = replace_required(text, 'AMYFX_VERSION_NAME: "1\\.5\\.5"', 'AMYFX_VERSION_NAME: "1\\.5\\.6"', path)
text = replace_required(text, 'AMYFX_VERSION_CODE: "46"', 'AMYFX_VERSION_CODE: "47"', path)
text = replace_required(text, "latest_version_code': 46", "latest_version_code': 47", path)
text = replace_required(text, "latest_version_name': '1\\.5\\.5'", "latest_version_name': '1\\.5\\.6'", path)
write(path, text)

path = 'tests/profile-version-update-regression.test.mjs'
text = read(path)
text = replace_required(text, 'version 1.5.5', 'version 1.5.6', path)
text = replace_required(text, "name: '1\\.5\\.5'", "name: '1\\.5\\.6'", path)
text = replace_required(text, 'code: 46', 'code: 47', path)
write(path, text)

path = 'tests/stage5-hardening.test.mjs'
text = read(path)
text = replace_required(text, 'Amy FX 1.5.5 uses versionCode 46', 'Amy FX 1.5.6 uses versionCode 47', path)
text = replace_required(text, r'versionCode[^\n]*46', r'versionCode[^\n]*47', path)
text = replace_required(text, r'versionName[^\n]*"1\.5\.5"', r'versionName[^\n]*"1\.5\.6"', path)
text = replace_required(text, "name: '1\\.5\\.5', code: 46", "name: '1\\.5\\.6', code: 47", path)
text = replace_required(text, '[40, 41, 42, 43, 44, 45, 46]', '[40, 41, 42, 43, 44, 45, 46, 47]', path)
text = replace_required(text, "const expected = metadata.latest_version_code === 46\n    ? '1.5.5'", "const expected = metadata.latest_version_code === 47\n    ? '1.5.6'\n    : metadata.latest_version_code === 46\n      ? '1.5.5'", path)
text = replace_required(text, 'metadata.latest_version_code <= 46', 'metadata.latest_version_code <= 47', path)
text = replace_required(text, 'AMYFX_VERSION_NAME: "1\\.5\\.5"', 'AMYFX_VERSION_NAME: "1\\.5\\.6"', path)
text = replace_required(text, 'AMYFX_VERSION_CODE: "46"', 'AMYFX_VERSION_CODE: "47"', path)
text = replace_required(text, 'default: "1\\.5\\.5"', 'default: "1\\.5\\.6"', path)
text = replace_required(text, 'default: "46"', 'default: "47"', path)
write(path, text)

# Generate updated workflow copies; actual workflow paths are promoted later.
path = '.github/workflows/build-release.yml'
text = read(path)
text = replace_required(text, '1.5.5', '1.5.6', path)
text = replace_required(text, 'default: "46"', 'default: "47"', path)
write('release-generated/build-release.yml', text)

path = '.github/workflows/stage5-apply.yml'
text = read(path)
text = replace_required(text, '1.5.5', '1.5.6', path)
text = replace_required(text, 'AMYFX_VERSION_CODE: "46"', 'AMYFX_VERSION_CODE: "47"', path)
write('release-generated/stage5-apply.yml', text)

path = '.github/workflows/build-apk.yml'
text = read(path)
text = replace_required(text, '1.5.5', '1.5.6', path)
for old, new in [
    ('AMYFX_VERSION_CODE: "46"', 'AMYFX_VERSION_CODE: "47"'),
    ("name: '1.5.6', code: 46", "name: '1.5.6', code: 47"),
    ("grep -Fq '?: 46)'", "grep -Fq '?: 47)'"),
    ("'latest_version_code': 46", "'latest_version_code': 47"),
    ("'versionCode': 46", "'versionCode': 47"),
    ('"latest_version_code": 46', '"latest_version_code": 47'),
]:
    text = replace_required(text, old, new, path)
old_notes = 'release_notes="Amy FX 1.5.6 memperbaiki restore backup jurnal dan library berukuran besar, menampilkan progress serta detail error, dan menyimpan backup ZIP dengan nama serta format yang benar. Data lokal, package com.amyelitesuite, jalur update produksi, dan sertifikat permanen tetap dipertahankan."'
new_notes = 'release_notes="Amy FX 1.5.6 memindahkan metadata Library dan Jurnal ke IndexedDB untuk memperbaiki kegagalan restore akibat kuota localStorage. Data lama dan lampiran tetap dipertahankan, sementara package serta sertifikat signing permanen tidak berubah."'
text = replace_required(text, old_notes, new_notes, path)
start = text.index('          notes = [')
end = text.index('          ]\n          data.update({', start) + len('          ]')
notes = '''          notes = [
              'Restore backup tidak lagi gagal karena kuota localStorage metadata.',
              'Metadata Library dan Jurnal kini disimpan di IndexedDB.',
              'Data lama dimigrasikan otomatis tanpa menghapus lampiran.',
              'Restore menunggu penyimpanan metadata selesai sebelum menampilkan hasil.',
              'Cache thumbnail video memakai penyimpanan yang sama dan aman.',
              'Package com.amyelitesuite, sertifikat permanen, data lokal, dan jalur update tetap dipertahankan.',
              'Pembaruan dapat dipasang tanpa menghapus aplikasi.'
          ]'''
text = text[:start] + notes + text[end:]
write('release-generated/build-apk.yml', text)
