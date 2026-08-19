# OrgKit

Chrome extension for Salesforce developers — Session Workbench, dual-org **Org Compare**, SOQL/Apex/schema tools, and Setup utilities.

## Version

**1.8.2**

## Features

### Session Workbench (home)
- Quick launch: SOQL · Anon Apex · Describe · **Org Compare** · Metadata · Debug logs · Record/ID
- Continue / pinned SOQL / per-org scratch pad (local storage, no `sid`)

### Org Compare
- A/B org cards + session chooser across all Chrome windows/tabs / cookie sessions
- Multi-category compare: objects/fields, profiles, permission sets, flows, Apex, validation rules, record types, Lightning pages, LWC
- Common-pack presets, category filters, side-by-side diffs
- Remembers last A/B pair by org key only (never `sid`)

### Also included
Describe Browser, Metadata Quick Open, Package.xml Builder, Inactive Flow Cleaner, NL→SOQL, Flow/Governor/Error/Log tools, Formula builder, Permission investigator, Apex review, Setup links, ID tools, favorites.

## Install (unpacked)

1. Download [`extension/releases/OrgKit-1.8.2-unpacked.zip`](extension/releases/OrgKit-1.8.2-unpacked.zip) and unzip
2. Chrome → `chrome://extensions` → Developer mode → **Load unpacked**
3. Open logged-in Salesforce tabs
4. Alt+Shift+O (or click the OrgKit icon / on-page launcher)

## Chrome Web Store

- Upload package: [`extension/releases/OrgKit-1.8.2-store.zip`](extension/releases/OrgKit-1.8.2-store.zip)
- Full listing pack: [`extension/releases/OrgKit-1.8.2-CWS-submission.zip`](extension/releases/OrgKit-1.8.2-CWS-submission.zip)
- Listing URLs: [`extension/store/submission/STORE_LISTING_URLS.txt`](extension/store/submission/STORE_LISTING_URLS.txt)

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
