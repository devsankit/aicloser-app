# GXClosers for Android

This folder is the native Android Studio application for the GXclosers Sales CRM. It is Kotlin and Jetpack Compose; it does not use Expo, React Native, EAS, or a JavaScript runtime.

## Open and run

1. Open this `apps/crm-mobile` folder in Android Studio.
2. Use JDK 17 and allow Gradle to sync.
3. Connect a physical Android phone (recommended for SIM and call testing).
4. Run the `app` configuration.

The debug APK is created at `app/build/outputs/apk/debug/app-debug.apk`.

## Identity

- Display name: `GXClosers`
- Application ID: `com.gigxomi.gxclosers`
- Deep-link scheme: `gxclosers`
- API: `https://closers.gigxomi.com/api`
- Minimum Android: 8.0 (API 26)
- Target Android: API 36

## Verification

On Windows:

```text
gradlew.bat testDebugUnitTest lintDebug assembleDebug
```

Before Play Store publication, add a private release keystore outside Git, configure release signing, connect the matching Firebase Android app if push notifications are enabled, build `bundleRelease`, and complete physical-device call/recording tests. Android and some manufacturers can restrict call audio; the app reports capture failures and keeps the CRM disposition flow working.
