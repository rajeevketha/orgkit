#!/usr/bin/env bash
# Build OrgKit store / testing zips and refresh stable "current" names.
# Usage: from repo root →  bash extension/scripts/pack-release.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
EXT="$ROOT/extension"
REL="$EXT/releases"
ART="/opt/cursor/artifacts"
VERSION="$(python3 -c "import json; print(json.load(open('$EXT/manifest.json'))['version'])")"

mkdir -p "$REL" "$ART"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Clean extension payload (manifest at zip root). Never include store docs, releases, or tests.
mkdir -p "$TMP/pkg"
(
  cd "$EXT"
  zip -r -q "$TMP/pkg.zip" . \
    -x "releases/*" \
    -x "store/*" \
    -x "scripts/*" \
    -x "*.test.mjs" \
    -x "*/node_modules/*" \
    -x "*node_modules*" \
    -x "*.DS_Store"
)
unzip -q "$TMP/pkg.zip" -d "$TMP/pkg"

STORE_VER="$REL/OrgKit-${VERSION}-store.zip"
TEST_VER="$REL/OrgKit-${VERSION}-for-testing.zip"
STORE_STABLE="$REL/OrgKit-store.zip"
CURRENT="$REL/OrgKit-CURRENT.zip"

rm -f "$STORE_VER" "$TEST_VER" "$STORE_STABLE" "$CURRENT"
(cd "$TMP/pkg" && zip -r -q "$STORE_VER" .)
cp -f "$STORE_VER" "$TEST_VER"
cp -f "$STORE_VER" "$STORE_STABLE"
cp -f "$STORE_VER" "$CURRENT"

# Cursor agent Files panel. .zip is often hidden in the UI, so also publish
# Download-OrgKit-* names plus a .tgz the Files list can show.
if [[ -d "$ART" ]]; then
  cp -f "$STORE_VER" "$ART/OrgKit-${VERSION}-store.zip"
  cp -f "$TEST_VER" "$ART/OrgKit-${VERSION}-for-testing.zip"
  cp -f "$STORE_STABLE" "$ART/OrgKit-store.zip"
  cp -f "$CURRENT" "$ART/OrgKit-CURRENT.zip"
  cp -f "$STORE_VER" "$ART/Download-OrgKit-${VERSION}.zip"
  (cd "$TMP/pkg" && tar -czf "$ART/Download-OrgKit-${VERSION}.tgz" .)
  cat > "$ART/Download-OrgKit-${VERSION}.html" <<HTML
<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Download OrgKit ${VERSION}</title></head>
<body>
  <h1>OrgKit ${VERSION}</h1>
  <p><a href="https://github.com/rajeevketha/orgkit/raw/cursor/highlight-nl-soql-1d8c/extension/releases/OrgKit-store.zip">Download OrgKit-store.zip from GitHub</a></p>
  <p>If Files hides zip files, download <code>Download-OrgKit-${VERSION}.tgz</code> from this folder instead, then extract it.</p>
</body></html>
HTML
fi

# Write pointer for docs / agents.
cat > "$REL/latest.json" <<EOF
{
  "version": "${VERSION}",
  "storeZip": "OrgKit-store.zip",
  "storeZipVersioned": "OrgKit-${VERSION}-store.zip",
  "testingZip": "OrgKit-${VERSION}-for-testing.zip",
  "currentZip": "OrgKit-CURRENT.zip"
}
EOF

echo "Packed OrgKit ${VERSION}"
echo "  Store (upload to CWS): $STORE_VER"
echo "  Stable default:        $STORE_STABLE"
ls -la "$STORE_VER" "$STORE_STABLE" "$CURRENT"
