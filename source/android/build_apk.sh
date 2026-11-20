#!/bin/bash
# Manual APK build (no Gradle): aapt -> javac -> dx -> aapt -> zipalign -> apksigner
set -e
cd "$(dirname "$0")"
GAME="${GAME:-$(cd .. && pwd)}"
JAR=/usr/lib/android-sdk/platforms/android-23/android.jar
OUTDIR=out
rm -rf "$OUTDIR/obj" "$OUTDIR/dex"; mkdir -p "$OUTDIR/gen" "$OUTDIR/obj" "$OUTDIR/dex"
mkdir -p assets && cp "$GAME/dist/index.html" assets/index.html

echo "== build info"
BUILD_NO=$(cat "$GAME/dist/build.txt")
mkdir -p src/fr/cuistot/tycoon
printf 'package fr.cuistot.tycoon;\n\nfinal class BuildInfo {\n    static final int BUNDLED_BUILD = %s;\n}\n' "$BUILD_NO" > src/fr/cuistot/tycoon/BuildInfo.java
cat src/fr/cuistot/tycoon/BuildInfo.java | grep BUNDLED

echo "== aapt R.java"
aapt package -f -m -J "$OUTDIR/gen" -M AndroidManifest.xml -S res -I "$JAR"

echo "== javac"
javac -nowarn -Xlint:-options -source 8 -target 8 -encoding UTF-8 -bootclasspath "$JAR" -classpath "$JAR" -d "$OUTDIR/obj" \
  "$OUTDIR/gen/fr/cuistot/tycoon/R.java" src/fr/cuistot/tycoon/MainActivity.java src/fr/cuistot/tycoon/BuildInfo.java 2>&1 | grep -v "JAVA_TOOL_OPTIONS\|_JAVA_OPTIONS" || true

echo "== dx"
dalvik-exchange --dex --min-sdk-version=21 --output="$OUTDIR/dex/classes.dex" "$OUTDIR/obj" 2>&1 | grep -v "JAVA_TOOL_OPTIONS\|_JAVA_OPTIONS" || true

echo "== aapt package"
aapt package -f -M AndroidManifest.xml -S res -A assets -I "$JAR" -0 arsc -F "$OUTDIR/unaligned.apk" "$OUTDIR/dex"

echo "== zipalign"
zipalign -f -p 4 "$OUTDIR/unaligned.apk" "$OUTDIR/aligned.apk"

echo "== sign"
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -keystore "$KEYSTORE" -alias cuistot -keyalg RSA -keysize 2048 -validity 12000 \
    -storepass "$KS_PASS" -keypass "$KS_PASS" -dname "CN=Cuistot Tycoon, O=Cuistot Tycoon, C=FR" 2>&1 | grep -v "JAVA_TOOL_OPTIONS\|_JAVA_OPTIONS" || true
fi
apksigner sign --ks "$KEYSTORE" --ks-key-alias cuistot --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" \
  --min-sdk-version 21 --out "$OUTDIR/CuistotTycoon.apk" "$OUTDIR/aligned.apk" 2>&1 | grep -v "JAVA_TOOL_OPTIONS\|_JAVA_OPTIONS" || true
apksigner verify --print-certs -v "$OUTDIR/CuistotTycoon.apk" 2>&1 | grep -v "JAVA_TOOL_OPTIONS\|_JAVA_OPTIONS" | head -8
ls -la "$OUTDIR/CuistotTycoon.apk"
