# OrgKit (orgcomparision)

Chrome extension for Salesforce developers — Session Workbench home plus dual-org **Org Compare**, SOQL/Apex/schema tools, and Setup utilities.

## Version

**1.8.2** — Session Workbench (1.8.0) + Org Compare UX on top.

## Features

### Session Workbench (home)
- Quick launch: SOQL · Anon Apex · Describe · **Org Compare** · Metadata · Debug logs · Record/ID
- Continue / pinned SOQL / per-org scratch pad (local storage, no `sid`)

### Org Compare
- A/B org cards + session chooser (Set as A/B) across all Chrome windows/tabs / cookie sessions
- **Multi-category compare:** objects/fields, profiles, permission sets, flows, Apex classes/triggers, validation rules, record types, Lightning pages, LWC
- Common-pack presets + per-category filters in results
- Swap A↔B, progress while fetching, clickable summary stats
- Env-aware tab counts (Production / Sandbox labels)
- Side-by-side attribute/field diffs + Only in A / Only in B
- Remembers last A/B pair locally by org key only (never `sid`)
- Copy API names / `package.xml` members (typed by category)

### Also included
Describe Browser, Metadata Quick Open, Package.xml Builder, Inactive Flow Cleaner, NL→SOQL, Flow/Governor/Error/Log tools, Formula builder, Permission investigator, Apex review, Setup links, ID tools, favorites.

## Install (unpacked)

1. Download [`extension/releases/OrgKit-1.8.2-unpacked.zip`](extension/releases/OrgKit-1.8.2-unpacked.zip) and unzip
2. Chrome → `chrome://extensions` → Developer mode → **Load unpacked**
3. Open logged-in Salesforce tabs for the orgs you want to use
4. Alt+Shift+O (or click the OrgKit icon / on-page launcher)

Or load the `extension/` folder directly from this repo.

## Privacy

- Uses open Salesforce tab / cookie sessions in the browser only
- Never stores `sid`
- Policy: [`extension/privacy.html`](extension/privacy.html)

## Project layout

```
extension/
  manifest.json
  app/  background/  content/  lib/  options/  popup/  icons/
  releases/   # testable zip packages
  store/      # Chrome Web Store docs
```

## License

Use at your own risk in your Salesforce orgs.
