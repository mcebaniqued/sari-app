# Barcode-assisted Add item

Scope: [#81](https://github.com/mcebaniqued/sari-app/issues/81). Manual entry remains the default. USDA FoodData Central is the only external product provider; product images, nutrition UI, additional providers, and saved rulesets are deferred.

## Setup

1. Obtain a free registered key from [FoodData Central](https://fdc.nal.usda.gov/api-guide/).
2. Set `USDA_API_KEY` in `api/.env` alongside the existing MongoDB/auth configuration. Never use a `VITE_` variable for this key.
3. Restart with `npm run dev`, log in, and open Add item.

Manual entry works without the USDA key. A missing key produces an actionable lookup message. A temporary failed-lookup cooldown can last up to one minute after changing configuration.

For phone camera testing, serve the frontend over HTTPS with an allowed auth origin and a reachable API. Plain HTTP on a LAN address does not provide browser camera access. Desktop localhost/127.0.0.1 is suitable for a local camera test. Do not expose development credentials or databases to obtain camera access.

## Manual acceptance checks

- Open Add item: food name is focused; no camera permission is requested. Save a normal manual entry.
- Choose Scan or enter barcode. Type `016000275287`, then Look up barcode. A live USDA smoke check identified this as Cheerios Cereal with an `18 ONZ` package, mapped to `18 oz`; provider data can change.
- Check name, brand, package description, USDA source, and editable suggestions. Saving requires Add item; expiration remains manual.
- Enter a custom name before lookup, or while a lookup is pending. Confirm it survives. Try Keep my entries and explicit Replace entered fields.
- Change the barcode while a request is pending; the old result must not fill the form. Try invalid input, a valid unmatched grocery barcode, offline lookup, and missing provider configuration. Complete an unmatched item manually.
- Change package quantity to the amount you actually have. A serving is never used as the package quantity. Ambiguous package descriptions remain manual with the initial `1 item` fallback.
- Rename a linked item, save, reload, and edit it. Its personal name remains separate from Linked product. Remove product link, save, and reload; name/amount/unit/expiration remain intact.
- Add the same product deliberately a second time with a different expiration. Both entries are allowed. Repeated clicks or a retry of the same failed save must not create accidental duplicates.
- Use two accounts: the same shared product can have different private names and quantities. Neither account can see or change the other's pantry data.
- Choose Use camera: verify permission handling, readable UPC-A/EAN-13/EAN-8/GTIN-14 codes, positioning, rear-camera preference where available, and a single accepted detection.
- Leave scanning unsuccessful for about 10 seconds, then 25 seconds. Guidance should suggest typing, with Keep scanning still available.
- Deny camera permission, switch to typing, close the barcode panel, cancel the form, save, and navigate away. Camera tracks must stop; delayed permissions/detections must not reopen or alter a closed form.
- Check phone layout and keyboard navigation. The decoded number is sent for lookup; camera images remain on the device.

UPC-E, store-specific variable-weight labels, GS1 application-identifier parsing, multipack arithmetic, and automatic mass/volume conversions are not supported in this iteration.

## Data and cache behavior

`FoodItem` remains the owner-scoped pantry instance. Optional `productId` and `barcode` preserve associations; old records remain valid. `FoodProduct` stores shared USDA identity and source information. Original USDA payloads (including any nutrition) remain backend-only. Unmatched user-entered details are not added to the shared catalog or reused as personal rules.

Successful matches are fresh for 30 days and rechecked on next use. Genuine lookup misses are remembered for 24 hours; failures are cooled down separately for one minute. Stale data can be used during a failed refresh without advancing its successful-check date. Provider changes never rewrite private pantry amounts or names. Authenticated lookup responses are not browser/CDN cached.

The API validates exact barcode matches, handles historical/ambiguous USDA records conservatively, and bounds provider traffic with a shared request budget and short lookup leases. Source attribution does not imply independent verification of every label value.

## Automated verification

- `npm run check`: format, lint, types, unused code, unit/component tests, and production build.
- `npm run test:integration`: disposable MongoDB API/persistence tests plus Playwright. Never uses personal database credentials.
- Provider fixtures cover matching, missing and ambiguous data, cache lifecycle, ownership, and idempotent saves. Browser fixtures cover typed lookup/review/save/unlink and manual fallback. Camera lifecycle tests use controlled streams; real-device camera decoding still needs the manual checks above.

Verification on this branch passed `npm run check`, all 113 API tests with disposable MongoDB, 78 frontend tests, and all 29 Playwright scenarios with four workers. An initial default eight-worker run had three auth failures caused by loss of connectivity to its test API; the follow-up investigation is recorded in `TODO.md`. A separate live public-demo-key smoke check resolved Cheerios to `18 oz`, persisted one shared product in disposable MongoDB, and served the second lookup without additional provider calls. No personal database or credentials were used for these checks.
