# OrgKit

Chrome extension for Salesforce developers — **NL → SOQL**, Session Workbench, dual-org **Org Compare**, SOQL/Apex/schema tools, and Setup utilities.

## Version

**1.8.9**

## Features

### NL → SOQL (signature)
- Plain English → runnable SOQL for standard, custom, CMDT, and Tooling
- Featured on the Session Workbench home with example prompts

### Session Workbench (home)
- Quick launch: **NL → SOQL** · SOQL · Anon Apex · Describe · **Org Compare** · Metadata · Debug logs · Record/ID
- Continue / pinned SOQL / per-org scratch pad (local storage, no `sid`)

### Org Compare
- A/B org cards + session chooser across all Chrome windows/tabs / cookie sessions
- Multi-category compare: objects/fields, profiles, permission sets, flows, Apex, validation rules, record types, Lightning pages, LWC
- Common-pack presets, category filters, side-by-side diffs
- Remembers last A/B pair by org key only (never `sid`)

### Also included
Describe Browser, Metadata Quick Open, Package.xml Builder, Inactive Flow Cleaner, Flow/Governor/Error/Log tools, Formula builder, Permission investigator, Apex review, Setup links, ID tools, favorites.

## Install (unpacked)

1. Download [`extension/releases/OrgKit-store.zip`](extension/releases/OrgKit-store.zip) (always current) and unzip
2. Chrome → `chrome://extensions` → Developer mode → **Load unpacked**
3. Open logged-in Salesforce tabs
4. Alt+Shift+O (or click the OrgKit icon / on-page launcher)

## Chrome Web Store

- **Default upload zip:** [`extension/releases/OrgKit-store.zip`](extension/releases/OrgKit-store.zip)
- Versioned: [`extension/releases/OrgKit-1.8.9-store.zip`](extension/releases/OrgKit-1.8.9-store.zip)
- Rebuild: `bash extension/scripts/pack-release.sh`
- Listing URLs: [`extension/store/submission/STORE_LISTING_URLS.txt`](extension/store/submission/STORE_LISTING_URLS.txt)
- Permission paste text: [`extension/store/submission/PERMISSION_JUSTIFICATIONS.txt`](extension/store/submission/PERMISSION_JUSTIFICATIONS.txt)

## Public site (OrgKit URLs)

After renaming this GitHub repo to **orgkit** and enabling Pages:

- Site: https://rajeevketha.github.io/orgkit/
- Privacy: https://rajeevketha.github.io/orgkit/privacy.html

## Privacy

- Uses open Salesforce tab / cookie sessions in the browser only
- Never stores `sid`
- Public site: https://rajeevketha.github.io/orgkit/
- Public policy: https://rajeevketha.github.io/orgkit/privacy.html

## License

Use at your own risk in your Salesforce orgs.
