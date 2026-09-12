# Android internal-test packaging

Free Capacitor 7 wrapper for the existing static web app on current `main`.
This directory does not change calculator formulas or reminder-architecture
semantics.

`prepare-www.js` copies only assets loaded by current `index.html` plus Stage 2
icons. It must not restore retired runtime `*-fix.js` patches.

## Local commands

```bash
npm ci --ignore-scripts
npm run android:www
npx cap sync android
```

`www/` is generated and gitignored. The committed `android/` project is the
Gradle shell; `cap sync` copies `www/` into the WebView assets.

A debug APK needs an Android SDK + Java 21. This repository builds that APK in
`.github/workflows/android-apk.yml` and publishes it **only** as a GitHub
Actions artifact. Do not create or update a GitHub Release from this workflow.

## Signing

`assembleDebug` uses the Gradle debug keystore created on the runner. Never
commit a release keystore, `*.jks`, or signing passwords. A Play / production
signing key is out of scope.
