# Amy FX ProGuard / R8 Rules — release build

# ─── JavaScript Bridge ───────────────────────────────────────────────────────
# All @JavascriptInterface methods are called by WebView via reflection.
# They MUST NOT be renamed or removed.
-keepclassmembers class com.amyelitesuite.MainActivity$WebAppInterface {
    @android.webkit.JavascriptInterface <methods>;
}

# ─── App Entry Points ────────────────────────────────────────────────────────
-keep class com.amyelitesuite.ScannerService { *; }
-keep class com.amyelitesuite.BootReceiver { *; }
-keep class com.amyelitesuite.MainActivity { *; }

# ─── Data Models (used by JSON / WebView bridge) ─────────────────────────────
-keep class com.amyelitesuite.CandleStore$Candle { *; }
-keep class com.amyelitesuite.MappingLogicCore$** { *; }
-keep class com.amyelitesuite.MappingLogicCore { *; }

# ─── SecurePrefs / Crypto ────────────────────────────────────────────────────
-keep class androidx.security.crypto.** { *; }
-dontwarn androidx.security.crypto.**

# ─── OkHttp & Okio ──────────────────────────────────────────────────────────
-dontwarn okhttp3.**
-dontwarn okio.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase

# ─── Kotlin Metadata & Coroutines ───────────────────────────────────────────
-dontwarn kotlin.Metadata
-keepclassmembers class kotlinx.coroutines.** { volatile <fields>; }
-dontwarn kotlinx.coroutines.**

# ─── SessionClock (uses java.time) ───────────────────────────────────────────
-keep class com.amyelitesuite.SessionClock { *; }
-dontwarn java.time.**

# ─── General Android ────────────────────────────────────────────────────────
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
-keep public class * extends android.app.Activity
-keep public class * extends android.app.Service
-keep public class * extends android.content.BroadcastReceiver
