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

## QA Checklist Sebelum Rilis

```text
[ ] Fresh install berhasil.
[ ] Dashboard utama terbuka.
[ ] Mapping terbuka.
[ ] Scanner start/stop berhasil.
[ ] Notifikasi target membuka Mapping.
[ ] Export file masuk folder Download.
[ ] App tidak crash saat offline.
[ ] Unit test lulus.
[ ] Release APK tidak berisi credential rahasia.
```
