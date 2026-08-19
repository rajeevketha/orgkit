# OrgKit — Chrome Web Store submit checklist (v1.12.1)

Upload graphics from `screenshots/` and `promo/` in this folder. Do **not** upload anything in `screenshots/archive-do-not-upload/` (old light theme / old logo).

## 1. Upload package (required)

- [ ] Upload **`OrgKit-store.zip`** (or `OrgKit-1.12.1-store.zip`) — manifest at zip root
- [ ] Confirm version **1.12.1**
- [ ] Confirm permissions: **cookies** + **storage** + **tabs** (+ Salesforce hosts; OpenAI optional)
- [ ] Confirm UI entry is `app/index.html`
- [ ] Dark OrgFlow theme + abstract K icon (`icons/orgkit-128.png`)

## 2. Store listing (required)

- [ ] Item name: **OrgKit**
- [ ] Paste short + detailed description from `LISTING_COPY.txt`
- [ ] Category: **Productivity** · Language: **English (United States)**
- [ ] Paste “What’s new in this version” from `LISTING_COPY.txt` (Store users see this on the listing; Chrome still auto-updates the installed copy)
- [ ] Homepage / Support / Privacy URLs from `STORE_LISTING_URLS.txt`
- [ ] Privacy policy URL: `https://rajeevketha.github.io/orgkit/privacy.html`
- [ ] Icon: `extension/icons/orgkit-128.png` (abstract K on dark tile — not the old blue OK)
- [ ] Screenshots (1280×800), in this order:
  1. `screenshots/home-1280x800.png`
  2. `screenshots/query-1280x800.png`
  3. `screenshots/schema-1280x800.png`
  4. `screenshots/compare-1280x800.png`
  5. optional: `screenshots/launcher-1280x800.png` (dark edge tab)
- [ ] Promo (replace any leftover light Lightning tiles):
  - `promo/small-promo-440x280.png`
  - `promo/marquee-promo-1400x560.png`

## 3. Permissions / privacy (required)

- [ ] Paste from `PERMISSION_JUSTIFICATIONS.txt` (cookies, storage, tabs, hosts, optional OpenAI)
- [ ] Single purpose from `LISTING_COPY.txt`
- [ ] Privacy practices from `PRIVACY_QUESTIONNAIRE.txt`
- [ ] Reviewer notes: `proofs/REVIEWER_NOTES.txt`

## 4. Pre-flight before “Submit for review”

- [ ] Homepage https://rajeevketha.github.io/orgkit/ opens in Incognito and says Query / Schema / Compare / Apex (not Session Workbench)
- [ ] Privacy URL opens in Incognito
- [ ] Load `OrgKit-store.zip` unpacked locally → session connected on a Salesforce tab
- [ ] Home shows four tools; Query generates SOQL; Schema map loads; Compare lists sessions
- [ ] Opens as `chrome-extension://…/app/index.html`
- [ ] Submit for review
