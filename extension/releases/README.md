# OrgKit — downloadable packages

## Default downloads (always latest)

| Purpose | File |
|--------|------|
| **Chrome Web Store upload** | [`OrgKit-store.zip`](./OrgKit-store.zip) |
| Same package (alias) | [`OrgKit-CURRENT.zip`](./OrgKit-CURRENT.zip) |

**GitHub raw (this branch):**

- Store: https://github.com/rajeevketha/orgkit/raw/cursor/highlight-nl-soql-1d8c/extension/releases/OrgKit-store.zip
- Versioned: https://github.com/rajeevketha/orgkit/raw/cursor/highlight-nl-soql-1d8c/extension/releases/OrgKit-1.9.6-store.zip

## Current version: 1.9.6

### 1.9.6 notes

- Schema map lines attach to tiles (no floating “belongs here” labels in empty space)
- Simple mode shows a small connected map; extra related types are hidden on purpose
- Hover a line to read it; change events / shares / history are deprioritized

### Rebuild

```bash
bash extension/scripts/pack-release.sh
```
