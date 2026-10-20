import mongoose from "mongoose";
import request from "supertest";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import app from "../app.js";
import { connectDatabase } from "../db.js";
import {
  BarcodeLookupModel,
  FoodProductModel,
  UsdaBudgetModel,
} from "./model.js";

const testUri = process.env.TEST_MONGODB_URI;
const barcode = "00012345678905";
const raw = {
  fdcId: 12345,
  dataType: "Branded",
  gtinUpc: "012345678905",
  description: "USDA oats",
  packageWeight: "500 g",
  marketCountry: "United States",
  publicationDate: "2026-01-01",
  foodNutrients: [{ nutrient: { name: "Protein" }, amount: 12 }],
};
const agent = request.agent(app).set("Origin", "http://127.0.0.1:5173");

describe.skipIf(!testUri)("USDA lookup persistence", () => {
  beforeAll(async () => {
    if (!testUri || !/_test(?:\?|$)/.test(testUri)) {
      throw new Error("Disposable _test database required.");
    }
    vi.stubEnv(
      "MONGODB_URI",
      testUri.replace(/_test(?=\?|$)/, "_barcode_test"),
    );
    vi.stubEnv(
      "BETTER_AUTH_SECRET",
      "test-only-barcode-secret-long-enough-123456789",
    );
    vi.stubEnv("BETTER_AUTH_URL", "http://127.0.0.1:5173");
    vi.stubEnv("USDA_API_KEY", "test-key");
    await connectDatabase();
    await Promise.all([
      FoodProductModel.init(),
      BarcodeLookupModel.init(),
      UsdaBudgetModel.init(),
    ]);
    const registered = await agent.post("/api/v1/auth/sign-up/email").send({
      firstName: "Barcode",
      lastName: "Tester",
      name: "Barcode Tester",
      email: `barcode-${new mongoose.Types.ObjectId().toHexString()}@example.com`,
      password: "a long barcode test password",
    });
    expect(registered.status).toBe(200);
  }, 20_000);
  afterEach(async () => {
    vi.unstubAllGlobals();
    await Promise.all([
      FoodProductModel.deleteMany({}),
      BarcodeLookupModel.deleteMany({}),
      UsdaBudgetModel.deleteMany({}),
    ]);
  });
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    vi.unstubAllEnvs();
  });

  function provider() {
    const fetcher = vi.fn((url: URL | string) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            String(url).includes("foods/search")
              ? { foods: [raw], totalHits: 1 }
              : raw,
          ),
        ),
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    return fetcher;
  }

  it("requires auth; caches exact matches and never returns raw nutrition", async () => {
    expect(
      (await request(app).get(`/api/v1/food-products/barcode/${barcode}`))
        .status,
    ).toBe(401);
    const fetcher = provider();
    const result = await agent.get(`/api/v1/food-products/barcode/${barcode}`);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      stale: false,
      product: {
        name: "USDA oats",
        packageQuantity: 500,
        packageUnit: "g",
        provider: "usda",
      },
    });
    expect(result.body).not.toHaveProperty("product.providerRaw");
    expect(
      await FoodProductModel.findOne().select("+providerRaw").lean(),
    ).toHaveProperty("providerRaw.foodNutrients");
    expect(
      (await agent.get("/api/v1/food-products/barcode/012345678905")).status,
    ).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(await FoodProductModel.countDocuments()).toBe(1);
  });
  it("deduplicates simultaneous lookups", async () => {
    const fetcher = provider();
    const responses = await Promise.all([
      agent.get(`/api/v1/food-products/barcode/${barcode}`),
      agent.get(`/api/v1/food-products/barcode/${barcode}`),
    ]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(await FoodProductModel.countDocuments()).toBe(1);
  });
  it("caches actual misses, but does not label provider outages not found", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ foods: [], totalHits: 0 })),
      );
    vi.stubGlobal("fetch", fetcher);
    expect(
      (await agent.get(`/api/v1/food-products/barcode/${barcode}`)).status,
    ).toBe(404);
    expect(
      (await agent.get(`/api/v1/food-products/barcode/${barcode}`)).status,
    ).toBe(404);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await BarcodeLookupModel.deleteMany({});
    fetcher.mockResolvedValue(new Response("Unavailable", { status: 503 }));
    expect(
      (await agent.get(`/api/v1/food-products/barcode/${barcode}`)).status,
    ).toBe(503);
    expect(await BarcodeLookupModel.findOne().lean()).toMatchObject({
      checkedAt: null,
      refreshAfter: null,
    });
  });
  it("returns stale data after refresh failure without advancing successful-check dates", async () => {
    provider();
    await agent.get(`/api/v1/food-products/barcode/${barcode}`);
    await BarcodeLookupModel.updateOne(
      { barcode },
      { $set: { refreshAfter: new Date(0) } },
    );
    const before = await FoodProductModel.findOne().lean();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Offline")));
    const result = await agent.get(`/api/v1/food-products/barcode/${barcode}`);
    expect(result.status).toBe(200);
    expect(result.body).toHaveProperty("stale", true);
    expect((await FoodProductModel.findOne().lean())?.checkedAt).toEqual(
      before?.checkedAt,
    );
  });
  it("rejects invalid barcodes before making provider requests", async () => {
    const fetcher = provider();
    expect((await agent.get("/api/v1/food-products/barcode/123")).status).toBe(
      400,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
});
