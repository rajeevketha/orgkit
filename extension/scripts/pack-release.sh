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

# Full Chrome Web Store listing bundle: upload zip + graphics + paste copy.
LISTING="$TMP/listing"
mkdir -p \
  "$LISTING/1-UPLOAD-THIS" \
  "$LISTING/2-GRAPHICS/screenshots" \
  "$LISTING/2-GRAPHICS/promo" \
  "$LISTING/3-PASTE"
cp -f "$STORE_VER" "$LISTING/1-UPLOAD-THIS/OrgKit-store.zip"
cp -f "$EXT/icons/orgkit-128.png" "$LISTING/2-GRAPHICS/store-icon-128.png"
cp -f "$EXT/store/submission/screenshots/home-1280x800.png" "$LISTING/2-GRAPHICS/screenshots/01-home-1280x800.png"
cp -f "$EXT/store/submission/screenshots/query-1280x800.png" "$LISTING/2-GRAPHICS/screenshots/02-query-1280x800.png"
cp -f "$EXT/store/submission/screenshots/schema-1280x800.png" "$LISTING/2-GRAPHICS/screenshots/03-schema-1280x800.png"
cp -f "$EXT/store/submission/screenshots/compare-1280x800.png" "$LISTING/2-GRAPHICS/screenshots/04-compare-1280x800.png"
cp -f "$EXT/store/submission/screenshots/launcher-1280x800.png" "$LISTING/2-GRAPHICS/screenshots/05-launcher-1280x800.png"
cp -f "$EXT/store/submission/promo/small-promo-440x280.png" "$LISTING/2-GRAPHICS/promo/"
cp -f "$EXT/store/submission/promo/marquee-promo-1400x560.png" "$LISTING/2-GRAPHICS/promo/"
cp -f \
  "$EXT/store/submission/LISTING_COPY.txt" \
  "$EXT/store/submission/PERMISSION_JUSTIFICATIONS.txt" \
  "$EXT/store/submission/PRIVACY_QUESTIONNAIRE.txt" \
  "$EXT/store/submission/STORE_LISTING_URLS.txt" \
  "$EXT/store/submission/SUBMIT_CHECKLIST.md" \
  "$EXT/store/submission/proofs/REVIEWER_NOTES.txt" \
  "$LISTING/3-PASTE/"
cat > "$LISTING/READ_ME_FIRST.txt" <<TXT
OrgKit ${VERSION} — Chrome Web Store resubmit pack
=================================================

1) Package
   Upload 1-UPLOAD-THIS/OrgKit-store.zip
   (manifest.json is at the zip root. Version ${VERSION}.)

2) Store icon
   2-GRAPHICS/store-icon-128.png
   Abstract K on a dark tile. Replace any leftover blue OK / briefcase icon.

3) Screenshots (1280×800) — upload in this order
   01-home, 02-query, 03-schema, 04-compare
   05-launcher is optional (dark OrgKit edge tab on a Salesforce page).
   Do not keep old light-theme screenshots in the listing.

4) Promo tiles — replace the old light Lightning tiles
   small-promo-440x280.png
   marquee-promo-1400x560.png

5) Paste from 3-PASTE/
   LISTING_COPY.txt              short + detailed + single purpose
   PERMISSION_JUSTIFICATIONS.txt cookies / storage / tabs / hosts
   PRIVACY_QUESTIONNAIRE.txt     data safety answers
   REVIEWER_NOTES.txt            reviewer notes field
   STORE_LISTING_URLS.txt        homepage / support / privacy

6) Before Submit for review
   Incognito-check:
     https://rajeevketha.github.io/orgkit/
     https://rajeevketha.github.io/orgkit/privacy.html
   Homepage must say Query / Schema / Compare / Apex (not Session Workbench).
TXT

LISTING_VER="$REL/OrgKit-CWS-listing-${VERSION}.zip"
LISTING_STABLE="$REL/OrgKit-CWS-listing.zip"
rm -f "$LISTING_VER" "$LISTING_STABLE"
(cd "$LISTING" && zip -r -q "$LISTING_VER" .)
cp -f "$LISTING_VER" "$LISTING_STABLE"

if [[ -d "$ART" ]]; then
  cp -f "$LISTING_VER" "$ART/OrgKit-CWS-listing-${VERSION}.zip"
  cp -f "$LISTING_STABLE" "$ART/OrgKit-CWS-listing.zip"
  (cd "$LISTING" && tar -czf "$ART/Download-OrgKit-CWS-listing-${VERSION}.tgz" .)
  cat > "$ART/Download-OrgKit-CWS-listing-${VERSION}.html" <<HTML
<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>OrgKit ${VERSION} Chrome Web Store pack</title></head>
<body style="font:16px/1.45 system-ui,sans-serif;max-width:42rem;margin:2rem auto;padding:0 1rem">
  <h1>OrgKit ${VERSION} listing pack</h1>
  <p><strong>Icons and screenshots are not inside OrgKit-store.zip.</strong> Open the graphics page:</p>
  <p><a href="cws-uploads/index.html">Open icon + screenshot gallery</a></p>
  <p>GitHub folder (each PNG is visible): <a href="https://github.com/rajeevketha/orgkit/tree/cursor/highlight-nl-soql-1d8c/cws-uploads">cws-uploads</a></p>
  <p>Live page: <a href="https://rajeevketha.github.io/orgkit/cws-uploads/">https://rajeevketha.github.io/orgkit/cws-uploads/</a></p>
  <p>If Files hides zip files, download <code>Download-CWS-uploads.tgz</code> or <code>Download-OrgKit-CWS-listing-${VERSION}.tgz</code>.</p>
</body></html>
HTML
fi

# Browseable PNG gallery (GitHub + Files). Do not put these images inside the extension zip.
bash "$ROOT/extension/scripts/publish-cws-uploads.sh" "$ROOT/cws-uploads"
if [[ -d "$ART" ]]; then
  bash "$ROOT/extension/scripts/publish-cws-uploads.sh" "$ART/cws-uploads"
  (cd "$ART/cws-uploads" && tar -czf "$ART/Download-CWS-uploads.tgz" .)
  cp -f "$ART/cws-uploads/index.html" "$ART/Chrome-Web-Store-uploads.html"
  # Root HTML must point at the subfolder so images still load from Files.
  python3 - <<'PY'
from pathlib import Path
p = Path("/opt/cursor/artifacts/Chrome-Web-Store-uploads.html")
html = p.read_text()
# Rewrite relative asset hrefs/src when this copy sits next to cws-uploads/
for name in [
    "OrgKit-store.zip",
    "store-icon-128.png",
    "01-home-1280x800.png",
    "02-query-1280x800.png",
    "03-schema-1280x800.png",
    "04-compare-1280x800.png",
    "05-launcher-1280x800.png",
    "small-promo-440x280.png",
    "marquee-promo-1400x560.png",
]:
    html = html.replace(f'href="{name}"', f'href="cws-uploads/{name}"')
    html = html.replace(f'src="{name}"', f'src="cws-uploads/{name}"')
p.write_text(html)
PY
fi

# Write pointer for docs / agents.
cat > "$REL/latest.json" <<EOF
{
  "version": "${VERSION}",
  "storeZip": "OrgKit-store.zip",
  "storeZipVersioned": "OrgKit-${VERSION}-store.zip",
  "testingZip": "OrgKit-${VERSION}-for-testing.zip",
  "currentZip": "OrgKit-CURRENT.zip",
  "listingZip": "OrgKit-CWS-listing.zip",
  "listingZipVersioned": "OrgKit-CWS-listing-${VERSION}.zip"
}
EOF

echo "Packed OrgKit ${VERSION}"
echo "  Store (upload to CWS): $STORE_VER"
echo "  Listing bundle:        $LISTING_VER"
echo "  Stable default:        $STORE_STABLE"
ls -la "$STORE_VER" "$STORE_STABLE" "$CURRENT" "$LISTING_VER"
