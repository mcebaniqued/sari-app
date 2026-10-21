import { describe, expect, it } from "vitest";
import { barcodeSchema, normalizeBarcode } from "./barcodes.js";

describe("barcode identities", () => {
  it("preserves leading zeros and equates UPC-A, EAN-13, and GTIN-14", () => {
    expect(normalizeBarcode(" 012345678905 ")).toBe("00012345678905");
    expect(normalizeBarcode("0012345678905")).toBe("00012345678905");
    expect(normalizeBarcode("00012345678905")).toBe("00012345678905");
    expect(normalizeBarcode("96385074")).toBe("00000096385074");
  });
  it.each([
    "012345678906",
    "123",
    "01234567890x",
    "012-345678905",
    "123456789012345",
  ])("rejects invalid input %s", (value) => {
    expect(barcodeSchema.safeParse(value).success).toBe(false);
  });
});
