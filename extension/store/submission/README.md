# OrgKit Chrome Web Store submission pack (v1.8.8)

| Item | File |
|---|---|
| **Upload zip (default)** | `../releases/OrgKit-store.zip` |
| Versioned upload zip | `../releases/OrgKit-1.8.8-store.zip` |
| Checklist | `SUBMIT_CHECKLIST.md` |
| Listing copy | `LISTING_COPY.txt` |
| Permission justifications | `PERMISSION_JUSTIFICATIONS.txt` |
| Privacy questionnaire | `PRIVACY_QUESTIONNAIRE.txt` |
| Privacy page (also hosted) | `privacy.html` + https://rajeevketha.github.io/orgkit/privacy.html |
| Reviewer notes | `proofs/REVIEWER_NOTES.txt` |
| Screenshots | `screenshots/*-1280x800.png` |
| Promo | `promo/` |
| Store icon | `icons/icon-128.png` |
| Public URLs (Homepage / Support / Privacy) | `STORE_LISTING_URLS.txt` |

Rebuild packages: `bash extension/scripts/pack-release.sh`

Start with `SUBMIT_CHECKLIST.md`.

## Important

- Upload **`OrgKit-store.zip`** (or `OrgKit-1.8.8-store.zip`) only — `manifest.json` at the **root** of the zip.
- Do **not** upload the whole repo or a zip that contains a nested `extension/` folder.
- Privacy policy must be a **public HTTPS** URL that opens in Incognito.
- Public listing must say **OrgKit** — use URLs from `STORE_LISTING_URLS.txt` (not internal repo names).
- Paste updated **`tabs`** justification from `PERMISSION_JUSTIFICATIONS.txt` (new since 1.8.7).
