#!/usr/bin/env bash
# Copy Chrome Web Store graphics into a browseable folder (PNGs + HTML).
# The extension zip never contains these listing images — CWS uploads them separately.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEST="${1:-"$ROOT/cws-uploads"}"
EXT="$ROOT/extension"
mkdir -p "$DEST"
if [[ -f "$ROOT/cws-uploads/index.html" && "$DEST" != "$ROOT/cws-uploads" ]]; then
  cp -f "$ROOT/cws-uploads/index.html" "$DEST/index.html"
fi
cp -f "$EXT/releases/OrgKit-store.zip" "$DEST/OrgKit-store.zip"
cp -f "$EXT/icons/orgkit-128.png" "$DEST/store-icon-128.png"
cp -f "$EXT/store/submission/screenshots/home-1280x800.png" "$DEST/01-home-1280x800.png"
cp -f "$EXT/store/submission/screenshots/query-1280x800.png" "$DEST/02-query-1280x800.png"
cp -f "$EXT/store/submission/screenshots/schema-1280x800.png" "$DEST/03-schema-1280x800.png"
cp -f "$EXT/store/submission/screenshots/compare-1280x800.png" "$DEST/04-compare-1280x800.png"
cp -f "$EXT/store/submission/screenshots/launcher-1280x800.png" "$DEST/05-launcher-1280x800.png"
cp -f "$EXT/store/submission/promo/small-promo-440x280.png" "$DEST/small-promo-440x280.png"
cp -f "$EXT/store/submission/promo/marquee-promo-1400x560.png" "$DEST/marquee-promo-1400x560.png"
echo "CWS uploads folder: $DEST"
