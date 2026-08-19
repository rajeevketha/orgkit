# OrgKit Chrome Web Store submission pack (v1.12.0)

| Item | File |
|---|---|
| **Upload zip (default)** | `../releases/OrgKit-store.zip` |
| Versioned upload zip | `../releases/OrgKit-1.12.0-store.zip` |
| Checklist | `SUBMIT_CHECKLIST.md` |
| Listing copy | `LISTING_COPY.txt` |
| Permission justifications | `PERMISSION_JUSTIFICATIONS.txt` |
| Privacy questionnaire | `PRIVACY_QUESTIONNAIRE.txt` |
| Privacy page (also hosted) | `privacy.html` + https://rajeevketha.github.io/orgkit/privacy.html |
| Reviewer notes | `proofs/REVIEWER_NOTES.txt` |
| Screenshots | `screenshots/home-1280x800.png`, `query-1280x800.png`, `schema-1280x800.png` |
| Promo | `promo/small-promo-440x280.png`, `promo/marquee-promo-1400x560.png` |
| Store icon | `../../icons/icon128.png` |
| Public URLs (Homepage / Support / Privacy) | `STORE_LISTING_URLS.txt` |

Rebuild packages: `bash extension/scripts/pack-release.sh`

Start with `SUBMIT_CHECKLIST.md`.

## Important

- Upload **`OrgKit-store.zip`** (or `OrgKit-1.12.0-store.zip`) only — `manifest.json` at the **root** of the zip.
- Do **not** upload the whole repo or a zip that contains a nested `extension/` folder.
- Privacy policy must be a **public HTTPS** URL that opens in Incognito.
- Public listing must say **OrgKit** — use URLs from `STORE_LISTING_URLS.txt`.
- UI is the OrgFlow dark theme with the abstract K icon. Confirm screenshots match the zip.
