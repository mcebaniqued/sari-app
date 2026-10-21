import { describe, expect, it } from "vitest";

import { testDatabaseUri } from "./database.js";

describe("test database isolation", () => {
  it.each([
    undefined,
    "",
    "mongodb://127.0.0.1:27017",
    "mongodb://127.0.0.1:27017/sari_prod",
    "mongodb://cluster_test",
    "mongodb://127.0.0.1:27017/sari_test/other",
  ])("rejects a URI without an explicit test database: %s", (uri) => {
    expect(() => testDatabaseUri(uri, "barcode")).toThrow("ending in _test");
  });

  it("keeps connection options while isolating each suite", () => {
    const uri = "mongodb://127.0.0.1:27017/sari_test?retryWrites=false";

    expect(testDatabaseUri(uri, "auth")).toBe(
      "mongodb://127.0.0.1:27017/sari_auth_test?retryWrites=false",
    );
    expect(testDatabaseUri(uri, "pantry")).toBe(
      "mongodb://127.0.0.1:27017/sari_pantry_test?retryWrites=false",
    );
    expect(testDatabaseUri(uri, "barcode")).toBe(
      "mongodb://127.0.0.1:27017/sari_barcode_test?retryWrites=false",
    );
  });
});
