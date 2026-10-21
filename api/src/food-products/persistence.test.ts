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
import { FoodItemModel } from "../food-items/model.js";
import {
  BarcodeLookupModel,
  FoodProductModel,
  UsdaBudgetModel,
} from "./model.js";
import { mapUsdaFood } from "./usda.js";

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
const otherAgent = request.agent(app).set("Origin", "http://127.0.0.1:5173");

// This suite writes and clears its test database. Require an explicit URI from
// CI or test:integration instead of using the application's database settings.
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
      FoodItemModel.init(),
    ]);
    const registered = await agent.post("/api/v1/auth/sign-up/email").send({
      firstName: "Barcode",
      lastName: "Tester",
      name: "Barcode Tester",
      email: `barcode-${new mongoose.Types.ObjectId().toHexString()}@example.com`,
      password: "a long barcode test password",
    });
    expect(registered.status).toBe(200);
    expect(
      (
        await otherAgent.post("/api/v1/auth/sign-up/email").send({
          firstName: "Other",
          lastName: "Tester",
          name: "Other Tester",
          email: `other-${new mongoose.Types.ObjectId().toHexString()}@example.com`,
          password: "another long barcode test password",
        })
      ).status,
    ).toBe(200);
  }, 20_000);
  afterEach(async () => {
    vi.unstubAllGlobals();
    await Promise.all([
      FoodProductModel.deleteMany({}),
      BarcodeLookupModel.deleteMany({}),
      UsdaBudgetModel.deleteMany({}),
      FoodItemModel.deleteMany({}),
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
  it("fills legacy cached dual-unit sizes without provider calls or changing pantry values", async () => {
    const checkedAt = new Date("2026-01-01T00:00:00Z");
    const refreshAfter = new Date(Date.now() + 86_400_000);
    const legacyRaw = { ...raw, packageWeight: "296 mL / 10 fl oz" };
    const product = await FoodProductModel.create({
      ...mapUsdaFood(legacyRaw, barcode, checkedAt),
      packageQuantity: null,
      packageUnit: null,
      providerRaw: legacyRaw,
    });
    await BarcodeLookupModel.create({
      barcode,
      productId: product._id,
      checkedAt,
      refreshAfter,
    });
    const saved = await agent.post("/api/v1/food-items").send({
      name: "My sauce",
      quantity: 296,
      unit: "ml",
      productId: product.id,
      barcode,
    });
    expect(saved.status).toBe(201);
    const fetcher = vi
      .fn()
      .mockRejectedValue(new Error("Provider must not be called"));
    vi.stubGlobal("fetch", fetcher);
    const result = await agent.get(`/api/v1/food-products/barcode/${barcode}`);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      stale: false,
      product: {
        packageQuantity: 10,
        packageUnit: "fl oz",
        checkedAt: checkedAt.toISOString(),
      },
    });
    const details = await agent.get(`/api/v1/food-products/${product.id}`);
    expect(details.status).toBe(200);
    expect(details.body).toMatchObject({
      packageQuantity: 10,
      packageUnit: "fl oz",
    });
    expect(details.body).not.toHaveProperty("providerRaw");
    expect(
      (await BarcodeLookupModel.findOne({ barcode }).lean())?.refreshAfter,
    ).toEqual(refreshAfter);
    expect(
      (await FoodProductModel.findById(product.id).lean())?.checkedAt,
    ).toEqual(checkedAt);
    expect(
      await FoodItemModel.findOne({ name: "My sauce" }).lean(),
    ).toMatchObject({ quantity: 296, unit: "ml" });
    expect(fetcher).not.toHaveBeenCalled();
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

  it("keeps names private, validates links, and unlinks without losing pantry values", async () => {
    provider();
    const lookup = await agent.get(`/api/v1/food-products/barcode/${barcode}`);
    const productId = (lookup.body as { product: { id: string } }).product.id;
    const first = await agent
      .post("/api/v1/food-items")
      .send({ name: "My oats", quantity: 250, unit: "g", productId, barcode });
    const second = await otherAgent
      .post("/api/v1/food-items")
      .send({ name: "Breakfast cereal", productId, barcode });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const id = (first.body as { id: string }).id;
    expect(
      (
        await otherAgent
          .patch(`/api/v1/food-items/${id}`)
          .send({ name: "Changed by another user" })
      ).status,
    ).toBe(404);
    expect(
      (
        await agent
          .patch(`/api/v1/food-items/${id}`)
          .send({ barcode: "96385074" })
      ).status,
    ).toBe(400);
    const unlinked = await agent
      .patch(`/api/v1/food-items/${id}`)
      .send({ productId: null });
    expect(unlinked.body).toMatchObject({
      productId: null,
      name: "My oats",
      quantity: 250,
      unit: "g",
    });
    expect((await FoodProductModel.findById(productId).lean())?.name).toBe(
      "USDA oats",
    );
    expect((await agent.get("/api/v1/food-items")).body).not.toHaveProperty(
      "items.1",
    );
    expect((await otherAgent.get("/api/v1/food-items")).body).toMatchObject({
      items: [{ name: "Breakfast cereal" }],
    });
  });

  it("deduplicates same-operation concurrent saves but allows intentional repeats", async () => {
    const input = { name: "Manual oats", barcode };
    const key = "barcode-test-operation-123456";
    const responses = await Promise.all([
      agent.post("/api/v1/food-items").set("Idempotency-Key", key).send(input),
      agent.post("/api/v1/food-items").set("Idempotency-Key", key).send(input),
    ]);
    expect(responses.map((r) => r.status)).toEqual([201, 201]);
    expect(responses[0].body).toEqual(responses[1].body);
    expect(await FoodItemModel.countDocuments()).toBe(1);
    expect(responses[0].body).not.toHaveProperty("creationFingerprint");
    expect(
      (
        await agent
          .post("/api/v1/food-items")
          .set("Idempotency-Key", key)
          .send({ name: "Different values" })
      ).status,
    ).toBe(409);
    expect(
      (
        await agent
          .post("/api/v1/food-items")
          .set("Idempotency-Key", "another-operation-123456")
          .send(input)
      ).status,
    ).toBe(201);
    expect(await FoodItemModel.countDocuments()).toBe(2);
    expect(await FoodProductModel.countDocuments()).toBe(0);
  });
});
