# OrgKit — downloadable packages

## Default downloads (always latest)

Use these stable names — they are overwritten on each pack:

| Purpose | File |
|--------|------|
| **Chrome Web Store upload** | [`OrgKit-store.zip`](./OrgKit-store.zip) |
| Same package (alias) | [`OrgKit-CURRENT.zip`](./OrgKit-CURRENT.zip) |

**GitHub raw (this branch):**

- Store upload: https://github.com/rajeevketha/orgkit/raw/cursor/sandbox-session-fix-1d8c/extension/releases/OrgKit-store.zip
- Versioned: https://github.com/rajeevketha/orgkit/raw/cursor/sandbox-session-fix-1d8c/extension/releases/OrgKit-1.8.8-store.zip

## Current version: 1.8.8

- `OrgKit-1.8.8-store.zip` — upload to Chrome Web Store (manifest at zip root)
- `OrgKit-1.8.8-for-testing.zip` — Load unpacked / local test (same payload)

### Rebuild locally

```bash
bash extension/scripts/pack-release.sh
```

This refreshes versioned zips **and** the stable `OrgKit-store.zip` / `OrgKit-CURRENT.zip` defaults, and copies them into `/opt/cursor/artifacts` for the agent Files panel.

### 1.8.8 notes

- Active session appears immediately from the launch org
- Faster org list (cookie presence; no per-org userinfo scan)
- `tabs` permission for multi-window session discovery (justify in CWS)
