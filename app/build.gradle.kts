plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val hasReleaseSigning = listOf(
    "AMYFX_KEYSTORE_PATH",
    "AMYFX_KEYSTORE_PASSWORD",
    "AMYFX_KEY_ALIAS",
    "AMYFX_KEY_PASSWORD"
).all { !System.getenv(it).isNullOrBlank() }

android {
    namespace = "com.amyelitesuite"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.amyelitesuite"
        minSdk = 26
        targetSdk = 35
        versionCode = (System.getenv("AMYFX_VERSION_CODE")?.toIntOrNull() ?: 12)
        versionName = System.getenv("AMYFX_VERSION_NAME