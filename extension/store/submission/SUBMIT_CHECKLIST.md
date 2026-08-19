# OrgKit — Chrome Web Store submit checklist (v1.12.0)

## 1. Upload package (required)

- [ ] Upload **`OrgKit-store.zip`** (or `OrgKit-1.12.0-store.zip`) — manifest at zip root
- [ ] Confirm version **1.12.0**
- [ ] Confirm permissions: **cookies** + **storage** + **tabs** (+ Salesforce hosts; OpenAI optional)
- [ ] Confirm UI entry is `app/index.html`
- [ ] Dark OrgFlow theme + abstract K icon

## 2. Store listing (required)

- [ ] Item name: **OrgKit**
- [ ] Paste short + detailed description from `LISTING_COPY.txt`
- [ ] Category: **Productivity** · Language: **English (United States)**
- [ ] Homepage / Support / Privacy URLs from `STORE_LISTING_URLS.txt` (OrgKit-branded)
- [ ] Privacy policy URL: `https://rajeevketha.github.io/orgkit/privacy.html`
- [ ] Icon: `extension/icons/icon128.png`
- [ ] Screenshots (1280×800): `screenshots/home-1280x800.png`, `query-1280x800.png`, `schema-1280x800.png`
- [ ] Optional promo: `promo/small-promo-440x280.png`, `promo/marquee-promo-1400x560.png`

## 3. Permissions / privacy (required)

- [ ] Paste from `PERMISSION_JUSTIFICATIONS.txt` (cookies, storage, tabs, hosts, optional OpenAI)
- [ ] Single purpose from `LISTING_COPY.txt`
- [ ] Privacy practices from `PRIVACY_QUESTIONNAIRE.txt`
- [ ] Reviewer notes: `proofs/REVIEWER_NOTES.txt`

## 4. Pre-flight before “Submit for review”

- [ ] Privacy URL opens in Incognito
- [ ] Load `OrgKit-store.zip` unpacked locally → session connected on a Salesforce tab
- [ ] Home shows four tools (Query, Schema, Compare, Apex); Query generates SOQL; Schema map loads; Compare lists sessions
- [ ] Opens as `chrome-extension://…/app/index.html`
- [ ] Submit for review
