plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
}

val hasReleaseSigning = listOf(
    "AMYFX_KEYSTORE_PATH",
    "AMYFX_KEYSTORE_PASSWORD",
    "AMYFX_KEY_ALIAS",
    "AMYFX_KEY_PASSWORD"
).all { !System.getenv(it).isNullOrBlank() }

fun buildConfigString(value: String): String =
    "\"${value.replace("\\", "\\\\").replace("\"", "\\\"")}\""

val configuredApplicationId = System.getenv("AMYFX_APPLICATION_ID") ?: "com.amyelitesuite"
val configuredAppLabel = System.getenv("AMYFX_APP_LABEL") ?: "Amy FX"
val configuredUriScheme = System.getenv("AMYFX_URI_SCHEME") ?: "amyfx"
val configuredUpdateManifestUrl = System.getenv("AMYFX_UPDATE_MANIFEST_URL")
    ?: "https://raw.githubusercontent.com/suhaimitoamy/Amy-fx/main/update.json"

android {
    namespace = "com.amyelitesuite"
    compileSdk = 35

    defaultConfig {
        applicationId = configuredApplicationId
        minSdk = 26
        targetSdk = 35
        versionCode = (System.getenv("AMYFX_VERSION_CODE")?.toIntOrNull() ?: 37)
        versionName = System.getenv("AMYFX_VERSION_NAME") ?: "1.4.14"
        manifestPlaceholders["appLabel"] = configuredAppLabel
        manifestPlaceholders["amyFxScheme"] = configuredUriScheme
        buildConfigField("String", "UPDATE_MANIFEST_URL", buildConfigString(configuredUpdateManifestUrl))

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildFeatures {
        buildConfig = true
    }

    signingConfigs {
        create("release") {
            enableV1Signing = true
            enableV2Signing = true
            if (hasReleaseSigning) {
                storeFile = file(System.getenv("AMYFX_KEYSTORE_PATH"))
                storePassword = System.getenv("AMYFX_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("AMYFX_KEY_ALIAS")
                keyPassword = System.getenv("AMYFX_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
            versionNameSuffix = "-debug"
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        create("migration") {
            initWith(getByName("release"))
            isDebuggable = true
            isMinifyEnabled = false
            isShrinkResources = false
            matchingFallbacks += listOf("release")
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
            versionNameSuffix = "-migration"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    implementation("androidx.work:work-runtime-ktx:2.9.1")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-messaging")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.1")
}
