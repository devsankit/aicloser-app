import org.jetbrains.kotlin.gradle.dsl.JvmTarget

val releaseKeystorePath = providers.gradleProperty("releaseKeystorePath")
    .orElse(providers.environmentVariable("GXCLOSER_UPLOAD_KEYSTORE"))
    .orNull
val releaseStorePassword = providers.gradleProperty("releaseStorePassword")
    .orElse(providers.environmentVariable("GXCLOSER_UPLOAD_STORE_PASSWORD"))
    .orNull
val releaseKeyAlias = providers.gradleProperty("releaseKeyAlias")
    .orElse(providers.environmentVariable("GXCLOSER_UPLOAD_KEY_ALIAS"))
    .orNull
val releaseKeyPassword = providers.gradleProperty("releaseKeyPassword")
    .orElse(providers.environmentVariable("GXCLOSER_UPLOAD_KEY_PASSWORD"))
    .orNull
val hasReleaseSigning = listOf(
    releaseKeystorePath,
    releaseStorePassword,
    releaseKeyAlias,
    releaseKeyPassword,
).all { !it.isNullOrBlank() }

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.gigxomi.gxclosers"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.gigxomi.crm"
        minSdk = 26
        targetSdk = 36
        versionCode = 24
        versionName = "1.0.24"
        buildConfigField("String", "GXCLOSERS_API_BASE", "\"https://app.aicloser.in/api\"")
        // Dedicated API engine for dynamic pipeline, leads, calls, and recording uploads
        buildConfigField("String", "AICLOSER_DEDICATED_API_BASE", "\"https://api.aicloser.in\"")
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }

    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = file(requireNotNull(releaseKeystorePath))
                storePassword = requireNotNull(releaseStorePassword)
                keyAlias = requireNotNull(releaseKeyAlias)
                keyPassword = requireNotNull(releaseKeyPassword)
                enableV1Signing = true
                enableV2Signing = true
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            if (hasReleaseSigning) signingConfig = signingConfigs.getByName("release")
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
        debug {
            // Use Android's default debug keystore. Release credentials must not
            // be required to build or install a local/debug APK.
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    packaging.resources.excludes += setOf("/META-INF/{AL2.0,LGPL2.1}")
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2025.12.00")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.activity:activity-compose:1.12.2")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.10.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.10.0")
    implementation("androidx.navigation:navigation-compose:2.9.8")
    implementation("androidx.work:work-runtime-ktx:2.10.0")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")

    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
}
