import { isDuplicateKeyError } from "../utils/mongoError.js";
import { UsdaBudgetModel } from "./model.js";
import { LookupError, mapUsdaFood, selectUsdaFood } from "./usda.js";

const HOUR_MS = 3_600_000;
const HOURLY_REQUEST_LIMIT = 900;
const MAX_RESPONSE_CHARACTERS = 2_000_000;
const LOOKUP_TIMEOUT_MS = 10_000;

/** The capped atomic upsert rejects exhausted budgets through the unique _id index. */
async function reserveCall() {
  const hour = Math.floor(Date.now() / HOUR_MS);

  try {
    await UsdaBudgetModel.findOneAndUpdate(
      { _id: `usda-${hour}`, calls: { $lt: HOURLY_REQUEST_LIMIT } },
      {
        $inc: { calls: 1 },
        $setOnInsert: { expiresAt: new Date((hour + 2) * HOUR_MS) },
      },
      { upsert: true },
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new LookupError(
        "LOOKUP_LIMITED",
        "Product lookup limit reached. Continue manually or try again later.",
        429,
      );
    }

    throw error;
  }
}

async function usdaRequest(
  path: string,
  parameters: Record<string, string>,
  signal: AbortSignal,
) {
  const key = process.env.USDA_API_KEY?.trim();
  if (!key) {
    throw new LookupError(
      "LOOKUP_UNAVAILABLE",
      "USDA lookup is not configured. You can still enter item details manually.",
    );
  }

  await reserveCall();
  const url = new URL(`https://api.nal.usda.gov/fdc/v1/${path}`);
  url.search = new URLSearchParams({ ...parameters, api_key: key }).toString();
  const response = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (response.status === 429) {
    throw new LookupError(
      "LOOKUP_LIMITED",
      "USDA lookup limit reached. Continue manually or try again later.",
      429,
    );
  }

  if (!response.ok) {
    throw new LookupError(
      "LOOKUP_UNAVAILABLE",
      "USDA lookup is unavailable. Continue manually or try again.",
    );
  }

  const body = await response.text();
  if (body.length > MAX_RESPONSE_CHARACTERS) {
    throw new LookupError(
      "LOOKUP_UNAVAILABLE",
      "USDA returned too much data. Continue manually.",
    );
  }

  return JSON.parse(body) as unknown;
}

/** Search and verify the exact canonical GTIN under one shared timeout. */
export async function fetchUsdaProduct(barcode: string, now: Date) {
  const signal = AbortSignal.timeout(LOOKUP_TIMEOUT_MS);
  const variants = [
    barcode,
    ...[13, 12, 8]
      .filter((length) => /^0*$/.test(barcode.slice(0, 14 - length)))
      .map((length) => barcode.slice(-length)),
  ];
  const search = await usdaRequest(
    "foods/search",
    {
      query: variants.join(" "),
      dataType: "Branded",
      pageSize: "200",
      requireAllWords: "false",
    },
    signal,
  );
  const id = selectUsdaFood(search, barcode);
  const raw = await usdaRequest(`food/${id}`, {}, signal);
  const mapped = mapUsdaFood(raw, barcode, now);
  if (mapped.externalId !== id) {
    throw new LookupError(
      "LOOKUP_UNAVAILABLE",
      "USDA returned an inconsistent product identity.",
    );
  }

  return { mapped, raw };
}
