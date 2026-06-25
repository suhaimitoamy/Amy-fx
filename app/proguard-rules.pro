# Amy FX release rules

# JavaScript bridge methods are called by WebView using reflection-like lookup.
-keepclassmembers class com.amyelitesuite.MainActivity$WebAppInterface {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep app service and receiver entry points stable.
-keep class com.amyelitesuite.ScannerService { *; }
-keep class com.amyelitesuite.BootReceiver { *; }

# OkHttp / Kotlin metadata safety.
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn kotlin.Metadata

# Preserve model names used by JSON and WebView bridge.
-keep class com.amyelitesuite.CandleStore$Candle { *; }
-keep class com.amyelitesuite.MappingLogicCore$** { *; }
