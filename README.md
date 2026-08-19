# OrgKit

Chrome extension for Salesforce developers. Work in the org **already open in Chrome** — Query, Schema, Compare, Apex. No extra login. Session id is never stored.

## Version

**1.12.1**

## Daily work

- **Query** — plain English → SOQL, or the SOQL runner
- **Schema** — relationship map + field describe
- **Compare** — UAT vs Prod inventories, live flow versions, or any two flow versions (same org or two orgs)
- **Apex** — anonymous Apex + debug output

Home highlights those four tools. Recent work and a scratch pad stay folded underneath. The Salesforce edge tab opens the same four tools.

## Also included (More)

Inactive flow versions, package.xml, permissions, metadata jump, record/ID tools, and heuristic scans (flow/governor/error/log/formula/Apex). Those stay available; they are not the home screen.

## Install (unpacked)

1. Download [`extension/releases/OrgKit-store.zip`](extension/releases/OrgKit-store.zip) and unzip
2. Chrome → `chrome://extensions` → Developer mode → **Load unpacked**
3. Open a logged-in Salesforce tab
4. Alt+Shift+O, the toolbar icon, or the OrgKit tab on the right edge of the page

## Privacy

- Uses the Salesforce session already in the browser
- Never stores `sid`
- Policy: https://rajeevketha.github.io/orgkit/privacy.html

## Chrome Web Store pack

- Upload zip: [`extension/releases/OrgKit-store.zip`](extension/releases/OrgKit-store.zip)
- Listing copy + screenshots: [`extension/store/submission/`](extension/store/submission/)
- Rebuild: `bash extension/scripts/pack-release.sh`

## License

Use at your own risk in your Salesforce orgs.
