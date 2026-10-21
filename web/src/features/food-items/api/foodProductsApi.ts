import { barcodeLookupSchema, foodProductSchema } from "@sari/contracts";
import { apiFetch } from "@/api/apiFetch";

export async function lookupBarcode(barcode: string, signal: AbortSignal) {
  const response = await apiFetch<unknown>(
    `/food-products/barcode/${encodeURIComponent(barcode)}`,
    {
      signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
      retry: false,
    },
  );

  return barcodeLookupSchema.parse(response);
}

export async function getFoodProduct(id: string, signal: AbortSignal) {
  const response = await apiFetch<unknown>(
    `/food-products/${encodeURIComponent(id)}`,
    {
      signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
      retry: false,
    },
  );

  return foodProductSchema.parse(response);
}
