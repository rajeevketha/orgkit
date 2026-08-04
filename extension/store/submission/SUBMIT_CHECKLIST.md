# OrgKit — Chrome Web Store submit checklist (v1.8.2)

## 1. Upload package (required)

- [ ] Upload **`OrgKit-1.8.2-store.zip`** (manifest at zip root — do **not** zip a parent folder)
- [ ] Confirm version **1.8.2**
- [ ] Confirm permissions: **cookies** + **storage** only (+ Salesforce hosts; OpenAI optional)
- [ ] Confirm UI entry is `app/index.html`

## 2. Store listing (required)

- [ ] Item name: **OrgKit**
- [ ] Paste short + detailed description from `LISTING_COPY.txt`
- [ ] Category: **Productivity** · Language: **English (United States)**
- [ ] Homepage / Support / Privacy URLs from `STORE_LISTING_URLS.txt` (OrgKit-branded; not orgcomparision)
- [ ] Privacy policy URL: `https://rajeevketha.github.io/orgkit/privacy.html`
- [ ] Icon: `icons/icon-128.png`
- [ ] Screenshots: at least one `screenshots/*-1280x800.png` (prefer 1280×800 or 640×400)
- [ ] Optional promo: `promo/small-promo-440x280.png`, `promo/marquee-promo-1400x560.png`

## 3. Permissions / privacy (required)

- [ ] Paste from `PERMISSION_JUSTIFICATIONS.txt` (cookies, storage, hosts, optional OpenAI)
- [ ] Single purpose from `LISTING_COPY.txt`
- [ ] Privacy practices from `PRIVACY_QUESTIONNAIRE.txt`
- [ ] Reviewer notes: `proofs/REVIEWER_NOTES.txt` (optional but helpful)

## 4. Pre-flight before “Submit for review”

- [ ] Privacy URL opens in Incognito
- [ ] Load `OrgKit-1.8.2-store.zip` unpacked locally → Session connected on a Salesforce tab
- [ ] Workbench home loads; Org Compare lists sessions; SOQL runs; Describe works
- [ ] Opens as `chrome-extension://…/app/index.html`
- [ ] Submit for review
