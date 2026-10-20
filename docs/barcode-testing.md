# Barcode-assisted Add item

Scope: [#81](https://github.com/mcebaniqued/sari-app/issues/81). Manual entry remains the default. USDA FoodData Central is the only external product provider; product images, nutrition UI, additional providers, and saved rulesets are deferred.

## Setup

1. Obtain a free registered key from [FoodData Central](https://fdc.nal.usda.gov/api-guide/).
2. Set `USDA_API_KEY` in `api/.env` alongside the existing MongoDB/auth configuration. Never use a `VITE_` variable for this key.
3. Restart with `npm run dev`, log in, and open Add item.

Manual entry works without the USDA key. A missing key produces an actionable lookup message. A temporary failed-lookup cooldown can last up to one minute after changing configuration.

For phone camera testing, serve the frontend over HTTPS with an allowed auth origin and a reachable API. Plain HTTP on a LAN address does not provide browser camera access. Desktop localhost/127.0.0.1 is suitable for a local camera test. Do not expose development credentials or databases to obtain camera access.

## Manual acceptance checks

- Open Add item: manual entry is shown and food name is focused. Barcode fields and camera permission are absent. Input barcode instead appears at the bottom right above the footer. Save a normal manual entry.
- Choose Input barcode instead. Only barcode entry is shown; Add item is absent. A small guide highlights every printed digit. Enter details manually is always available at the bottom right above the footer. Switch back and forth: name, quantity, unit, expiration, and typed barcode must survive.
- Type `016000275287`, then Find item (or press Enter). A match returns directly to the prefilled manual form with Item found; it never saves automatically. A live USDA smoke check identified this as Cheerios Cereal with an `18 ONZ` package, mapped to `18 oz`; provider data can change.
- Review name, brand, and editable suggestions. Expand More product details for the original package label, barcode, USDA source link, and last-checked date. The package label is the sole quantity/unit reference in product metadata; autofill reads that label without displaying a separate listed size. Saving requires Add item; expiration remains manual.
- Check a label such as `10 fl oz/296 mL`, `296 mL/10 fl oz`, or `10 fl oz (296 mL)`: quantity/unit should prefill as `10 fl oz`. Consistent dual-unit labels prefer the printed U.S. customary measurement regardless of order. Metric-only sizes keep their printed units; choosing a measurement system is deferred to user preferences. Labels with inconsistent values, mixed weight/volume, or multipack expressions stay manual.
- Enter a custom name or amount before lookup. Confirm it survives and quantity/unit stay together. Try Keep my entries and explicit Replace entered fields. Expiration is never filled from product data.
- Change the barcode while a request is pending, or choose Enter details manually and type something new: the old result must not fill the form or switch views. Try invalid input, an unmatched barcode, offline lookup, and missing provider configuration. Each failure has one plain message; Enter details manually returns focus to food name and preserves the draft.
- Change quantity to the amount you actually have. A serving is never used as the package quantity. Ambiguous package descriptions remain manual with the initial `1 item` fallback. A provider's listed size may describe one container in a multipack; verify the amount yourself. Multipack totals need separate work in #26 (see TODO.md).
- Rename a linked item, save, reload, and edit it. Its personal name stays separate from the matched product. Remove product link, save, and reload; name/amount/unit/expiration remain intact. Editing does not introduce the Add item entry-method switch.
- Add the same product deliberately a second time with a different expiration. Both entries are allowed. Repeated clicks or a retry of the same failed save must not create accidental duplicates.
- Use two accounts: the same shared product can have different private names and quantities. Neither account can see or change the other's pantry data.
- Choose the Scan with camera ghost button directly below the barcode number field: the number field is replaced by the scanner. Verify permission handling, readable UPC-A/EAN-13/EAN-8/GTIN-14 codes, positioning, rear-camera preference where available, and a single accepted detection. After a match the camera stops and the editable manual form is shown.
- Leave scanning unsuccessful for about 10 seconds, then 25 seconds. Guidance should suggest typing, with Keep scanning still available.
- Deny camera permission, use an insecure phone connection, and try a device without a camera: each should explain its own problem and offer typed barcode entry. HTTP LAN access cannot trigger a permission prompt; use trusted HTTPS for a real phone camera test.
- Switch to typing or choose Enter details manually, cancel the modal, or navigate away during scanning. Camera tracks must stop; delayed permissions/detections must not reopen or alter a closed form. Enter barcode manually returns focus to the number field.
- Check phone layout and keyboard navigation. The decoded number is sent for lookup; camera images remain on the device.

UPC-E, store-specific variable-weight labels, GS1 application-identifier parsing, multipack arithmetic, and automatic mass/volume conversions are not supported in this iteration.

## Data and cache behavior

`FoodItem` remains the owner-scoped pantry instance. Optional `productId` and `barcode` preserve associations; old records remain valid. `FoodProduct` stores shared USDA identity and source information. Original USDA payloads (including any nutrition) remain backend-only. Unmatched user-entered details are not added to the shared catalog or reused as personal rules.

Successful matches are fresh for 30 days and rechecked on next use. Genuine lookup misses are remembered for 24 hours; failures are cooled down separately for one minute. Stale data can be used during a failed refresh without advancing its successful-check date. Provider changes never rewrite private pantry amounts or names. Authenticated lookup responses are not browser/CDN cached.

For older cached products whose quantity/unit were not recognized, API responses derive missing suggestions from the saved package label using the current parser. Rescanning benefits immediately without a provider request, deleting cache entries, changing freshness dates, or rewriting previously saved pantry amounts. The original label remains available in More product details.

The API validates exact barcode matches, handles historical/ambiguous USDA records conservatively, and bounds provider traffic with a shared request budget and short lookup leases. Source attribution does not imply independent verification of every label value.

## Automated verification

- `npm run check`: format, lint, types, unused code, unit/component tests, and production build.
- `npm run test:integration`: disposable MongoDB API/persistence tests plus Playwright. Never uses personal database credentials.
- Provider fixtures cover matching, missing and ambiguous data, cache lifecycle, ownership, and idempotent saves. Browser fixtures cover typed lookup/review/save/unlink and manual fallback. Camera lifecycle tests use controlled streams; real-device camera decoding still needs the manual checks above.

The current modal adds component coverage for mutually exclusive views, preserved drafts, explicit replacement, late lookup cancellation, singular failure prompts, and save retries. Camera tests cover permission denial, insecure connections, missing hardware, elapsed guidance, and stream cleanup. Browser coverage checks lookup/review/save/unlink, manual fallback, keyboard focus, accessibility, and a 390 px phone layout. Real-device camera decoding still needs manual verification.

Verification for this modal update passed `npm run check` and `npm run test:integration`: all 113 API tests with disposable MongoDB, 87 frontend tests, and all 30 Playwright scenarios at the default eight workers. The full check required local-network access for API test servers. No personal database was used. The existing production bundle-size warning remains tracked separately in `TODO.md`.

The follow-up replacing the entry tabs with subtle actions passed lint, frontend type checking, all 87 frontend tests, and the four focused browser scenarios for barcode lookup, manual fallback, phone layout, and keyboard navigation. Phone screenshots were inspected for action placement and clipping.

The imperial-first dual-unit parser and cached-label fallback passed `npm run check` and `npm run test:integration`: 129 API tests with disposable MongoDB, 88 frontend tests, and 30 browser scenarios. Cache coverage verifies both barcode lookup and linked-product responses, no provider calls for a fresh cached match, unchanged source/cache dates, and unchanged saved pantry amounts.

The earlier default eight-worker integration run intermittently lost connectivity to its test API; the follow-up investigation is recorded in `TODO.md`. UPC `049000042559` and EAN `0049000042559` normalize to the same identity and produced no USDA search result during a direct check. UPC `049000042849` resolved to record 2596995 (stored by USDA as EAN `0049000042849`). Not found is a coverage outcome, not an invalid-barcode error. Provider coverage can change.
