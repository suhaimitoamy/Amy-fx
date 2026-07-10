# Release Guide

## Build Debug

```bash
chmod +x ./gradlew
./gradlew testDebugUnitTest assembleDebug --no-configuration-cache --stacktrace
```

## Build Release

```bash
./gradlew assembleRelease --no-configuration-cache --stacktrace
```

## Release Signing

Release APK harus memakai keystore pribadi.

Jangan simpan file keystore, password, token, atau credential apa pun di repository.

Gradle membaca environment berikut:

```text
AMYFX_KEYSTORE_PATH
AMYFX_KEYSTORE_PASSWORD
AMYFX_KEY_ALIAS
AMYFX_KEY_PASSWORD
AMYFX_VERSION_NAME
AMYFX_VERSION_CODE
```

## GitHub Secrets / Variables

Secrets yang perlu disiapkan:

```text
AMYFX_KEYSTORE_BASE64
AMYFX_KEYSTORE_PASSWORD
AMYFX_KEY_ALIAS
AMYFX_KEY_PASSWORD
```

Variables yang boleh disiapkan:

```text
AMYFX_VERSION_NAME
AMYFX_VERSION_CODE
```

QA Checklist Sebelum Rilis di GitHub Actions (HP kentang mode):

Workflow yang harus lulus:
- [ ] `.github/workflows/build-debug.yml` sukses dan artifact diunggah.
- [ ] `.github/workflows/build-release.yml` sukses dengan signing lewat secrets:
  - `AMYFX_KEYSTORE_BASE64`
  - `AMYFX_KEYSTORE_PASSWORD`
  - `AMYFX_KEY_ALIAS`
  - `AMYFX_KEY_PASSWORD`
- [ ] `.github/workflows/lint-check.yml` lulus tanpa error fatal.

Verifikasi APK hasil artifact:
- [ ] Fresh install berhasil.
- [ ] Dashboard utama terbuka.
- [ ] Mapping terbuka via deep link notifikasi.
- [ ] Scanner start/stop berhasil.
- [ ] Notifikasi target membuka Mapping.
- [ ] Export file masuk folder Download.
- [ ] Offline tidak crash.
- [ ] Release APK tidak berisi credential rahasia.
