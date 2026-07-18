# Amy FX Debug-to-Release Data Migration

This kit is only for the accidentally distributed Amy FX build with:

- package: `com.amyelitesuite`
- version: `1.4.12-debug`
- native versionCode: `35`
- debuggable: `true`
- installed signer SHA-256 beginning with `06:44:FF:C8`

The old APK was produced by an ephemeral GitHub Actions debug keystore. Its private key was not persisted, so Android cannot accept a normal in-place APK update signed by the permanent Amy FX release key.

The migration process preserves data by:

1. stopping the old app;
2. streaming its private data to a verified TAR backup through `run-as`;
3. saving the currently installed APK for rollback;
4. replacing the package with an official-signed, temporarily debuggable migration APK;
5. restoring the original private data through `run-as`;
6. retaining the backup and rollback APK until the user confirms all notes are present.

## Safety rules

- Do not continue unless the script reports a valid, non-empty backup.
- Do not delete the migration backup directory until notes, journal entries, course progress, preferences, and Mapping data have been checked.
- Do not publish the migration APK as the normal rolling update.
- After migration is confirmed, ship the next normal non-debuggable release using the permanent Amy FX release certificate.

## Termux

Place these files in the same directory:

- `AmyFX-1.4.15-migration.apk`
- `migrate-termux.sh`

Install Android platform tools in Termux, connect ADB through Wireless debugging, then run:

```sh
chmod +x migrate-termux.sh
./migrate-termux.sh AmyFX-1.4.15-migration.apk
```

The script stops before package removal unless the backup and rollback APK both pass validation.

## Windows

Install Google Android Platform Tools, enable USB debugging, place these files in the same directory, then run `migrate-windows.bat`:

- `AmyFX-1.4.15-migration.apk`
- `migrate-windows.bat`

The script attempts an automatic rollback if installation or restoration fails.
