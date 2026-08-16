# OrgKit — downloadable packages

## Default downloads (always latest)

| Purpose | File |
|--------|------|
| **Chrome Web Store upload** | [`OrgKit-store.zip`](./OrgKit-store.zip) |
| Same package (alias) | [`OrgKit-CURRENT.zip`](./OrgKit-CURRENT.zip) |

**GitHub raw (this branch):**

- Store: https://github.com/rajeevketha/orgkit/raw/cursor/highlight-nl-soql-1d8c/extension/releases/OrgKit-store.zip
- Versioned: https://github.com/rajeevketha/orgkit/raw/cursor/highlight-nl-soql-1d8c/extension/releases/OrgKit-1.8.9-store.zip

## Current version: 1.8.9

- `OrgKit-1.8.9-store.zip` — upload to Chrome Web Store
- `OrgKit-1.8.9-for-testing.zip` — Load unpacked / local test

### Rebuild

```bash
bash extension/scripts/pack-release.sh
```

### 1.8.9 notes

- NL → SOQL highlighted as signature feature on Session Workbench
- Example prompt chips on the NL view; NL first in quick launch
- Store listing copy leads with NL → SOQL

### 1.8.8 notes

- Active session appears immediately from the launch org
- Faster org list (cookie presence; no per-org userinfo scan)
