# OrgKit — downloadable packages

## Default downloads (always latest)

| Purpose | File |
|--------|------|
| **Chrome Web Store upload** | [`OrgKit-store.zip`](./OrgKit-store.zip) |
| Same package (alias) | [`OrgKit-CURRENT.zip`](./OrgKit-CURRENT.zip) |

**GitHub raw (this branch):**

- Store: https://github.com/rajeevketha/orgkit/raw/cursor/highlight-nl-soql-1d8c/extension/releases/OrgKit-store.zip
- Versioned: https://github.com/rajeevketha/orgkit/raw/cursor/highlight-nl-soql-1d8c/extension/releases/OrgKit-1.9.0-store.zip

## Current version: 1.9.0

- `OrgKit-1.9.0-store.zip` — upload to Chrome Web Store
- `OrgKit-1.9.0-for-testing.zip` — Load unpacked / local test

### Rebuild

```bash
bash extension/scripts/pack-release.sh
```

### 1.9.0 notes

- **Schema Explorer** — parent/child map for standard, custom (__c), and custom metadata (__mdt)
- Hop navigation, query stubs, jump to Describe / NL → SOQL
- NL → SOQL remains the signature spotlight on home

### 1.8.9 notes

- NL → SOQL highlighted as signature feature on Session Workbench
