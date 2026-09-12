#!/bin/sh
# POSIX smoke for reactivecircus/android-emulator-runner.
# That action runs `script` as one `sh -c` string; keep this file self-contained.
set -e
ROOT="${GITHUB_WORKSPACE:-$(pwd)}"
APK="$(find "$ROOT/dist-apk" -name '*.apk' -type f 2>/dev/null | head -n 1)"
if [ -z "$APK" ] || [ ! -f "$APK" ]; then
  echo "emulator-smoke: no APK under ${ROOT}/dist-apk" >&2
  ls -la "${ROOT}/dist-apk" >&2 || true
  exit 1
fi
echo "emulator-smoke: installing ${APK}"
adb install -r "$APK"
adb shell am start -n com.fitgen.peptidecalculator/.MainActivity
sleep 8
adb shell dumpsys activity activities > "${ROOT}/emulator-activities.log"
grep -i peptidecalculator "${ROOT}/emulator-activities.log"
echo "emulator-smoke: launch string found"
