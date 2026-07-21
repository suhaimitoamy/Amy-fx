# Amy FX Preview — Mapping V2

Branch: `experiment/mapping-regime-engine-20260721`

APK eksperimen dibangun sebagai aplikasi terpisah agar dapat dipasang berdampingan dengan Amy FX produksi.

- Nama aplikasi: `Amy FX Preview`
- Application ID: `com.amyelitesuite.learningpreview`
- URI scheme: `amyfxpreview`
- Version name: `1.4.15-preview-debug`
- Version code: `90038`
- Sumber fitur: Mapping V2 pada branch eksperimen

Build dilakukan oleh workflow `Mapping V2 Experiment`. Workflow memeriksa unit test, syntax JavaScript, kontrak context-only, identitas APK, dan Android debug build sebelum mengunggah artefak `AmyFX-Preview-MappingV2`.

Aplikasi preview memiliki penyimpanan aplikasi terpisah dari package produksi `com.amyelitesuite`, sehingga keduanya dapat dibandingkan tanpa mengganti instalasi utama.
