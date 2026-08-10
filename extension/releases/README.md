# OrgKit — downloadable packages

## Current (1.8.3)

- `OrgKit-1.8.3-store.zip` — **Chrome Web Store upload package** (manifest at zip root)
- `OrgKit-1.8.3-unpacked.zip` — same payload for local Load unpacked testing
- `OrgKit-CURRENT.zip` / `OrgKit-store.zip` — aliases of the store package

### Local test

1. Unzip `OrgKit-1.8.3-unpacked.zip`
2. Chrome → `chrome://extensions` → Developer mode → Load unpacked

### 1.8.3 notes

- Fix sandbox sessions: Lightning-only sandbox `sid` cookies now call Salesforce APIs on the Lightning host (instead of a rewritten `*.my.salesforce.com` base that returned “Session expired or invalid”).
- Legacy pod sandboxes (`csXX.lightning.force.com`) map to `csXX.salesforce.com`.
- Clearer sandbox / developer / production environment labels.
