# OrgKit — downloadable packages

## Current (1.8.8)

- `OrgKit-1.8.8-for-testing.zip` — share/test (Load unpacked)

### 1.8.8 notes

- Active session appears immediately from the launch org (no long blank wait).
- Org list no longer runs per-org userinfo validation (cookie presence only).
- Faster session lookup: parallel cookie probes, short in-memory cache.

### 1.8.7 notes

- Active session dropdown seeds current/launch org; Setup cookie sessions included.
- Added `tabs` permission for reliable multi-window session discovery.

### 1.8.6 notes

- Active session dropdown now defaults to the Salesforce org you launched from.
- Previous org selection no longer sticks incorrectly on open.
