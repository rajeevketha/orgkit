# OrgKit — downloadable packages

## Default downloads (always latest)

| Purpose | File |
|--------|------|
| **Chrome Web Store upload** | [`OrgKit-store.zip`](./OrgKit-store.zip) |
| Same package (alias) | [`OrgKit-CURRENT.zip`](./OrgKit-CURRENT.zip) |

**GitHub raw (this branch):**

- Store: https://github.com/rajeevketha/orgkit/raw/cursor/highlight-nl-soql-1d8c/extension/releases/OrgKit-store.zip
- Versioned: https://github.com/rajeevketha/orgkit/raw/cursor/highlight-nl-soql-1d8c/extension/releases/OrgKit-1.12.1-store.zip
- Listing pack (screenshots + promo + paste copy): https://github.com/rajeevketha/orgkit/raw/cursor/highlight-nl-soql-1d8c/extension/releases/OrgKit-CWS-listing.zip

## Current version: 1.12.1

### 1.12.1 notes

- Tab favicon and header use the same abstract K files (new filenames so Chrome drops the old OK cache)
- Toolbar icon is applied on install/startup
- Chrome Web Store screenshots, dark promo tiles, and listing copy for 1.12.1

### 1.12.0 notes

- OrgFlow dark theme (GitHub canvas, white type, muted blue accent)
- Abstract K mark as the extension icon and in-app wordmark
- Same four-tool Home as 1.11.0

### 1.11.0 notes

- One light Lightning / Flow theme across the app, settings, and Salesforce edge tab
- Home states the product in one line and shows four tools: Query, Schema, Compare, Apex
- Scratch pad and privacy sit under folds so the home screen stays simple
- Chrome Web Store screenshots, promo tiles, and listing copy updated for 1.11.0

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
