# OrgKit — downloadable packages

## Default downloads (always latest)

| Purpose | File |
|--------|------|
| **Chrome Web Store upload** | [`OrgKit-store.zip`](./OrgKit-store.zip) |
| Same package (alias) | [`OrgKit-CURRENT.zip`](./OrgKit-CURRENT.zip) |

**GitHub raw (this branch):**

- Store: https://github.com/rajeevketha/orgkit/raw/cursor/highlight-nl-soql-1d8c/extension/releases/OrgKit-store.zip
- Versioned: https://github.com/rajeevketha/orgkit/raw/cursor/highlight-nl-soql-1d8c/extension/releases/OrgKit-1.10.0-store.zip

## Current version: 1.10.0

### 1.10.0 notes

- Daily-work layout: Home, Query, Schema, Compare, Apex, More
- Occasional paste tools stay under More (not deleted)
- Salesforce edge tab opens Query / Schema / Compare / Apex

### 1.9.8 notes

- Org Compare → **Two flow versions**: pick any versions in the same org or across two orgs
- Diffs header + elements (screens, gets, decisions, etc.); canvas layout is ignored

### 1.9.7 notes

- Org Compare can diff **which flow version is live** in two orgs (UAT vs Prod)
- Preset: Active flow versions — same A/B sessions, no extra login

### 1.9.6 notes

- Schema map lines attach to tiles (no floating “belongs here” labels in empty space)
- Simple mode shows a small connected map; extra related types are hidden on purpose
- Hover a line to read it; change events / shares / history are deprioritized

### Rebuild

```bash
bash extension/scripts/pack-release.sh
```
