import { foodItemListSchema, foodItemSchema } from "@sari/contracts";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import app from "../app.js";
import { connectDatabase } from "../db.js";
import { FoodItemModel } from "./model.js";

// Never load api/.env here. Integration tests need an explicitly selected test DB.
const testUri = process.env.TEST_MONGODB_URI;

describe.skipIf(!testUri)("MongoDB food persistence", () => {
  const createdIds: string[] = [];
  const agent = request.agent(app).set("Origin", "http://127.0.0.1:5173");
  let userId: string;

  beforeAll(async () => {
    if (!testUri || !/\/_?[\w-]+_test(?:\?|$)/.test(testUri)) {
      throw new Error(
        "TEST_MONGODB_URI must explicitly name a database ending in _test.",
      );
    }
    vi.stubEnv("MONGODB_URI", testUri.replace(/_test(?=\?|$)/, "_pantry_test"));
    vi.stubEnv(
      "BETTER_AUTH_SECRET",
      "test-only-secret-for-pantry-persistence-12345",
    );
    vi.stubEnv("BETTER_AUTH_URL", "http://127.0.0.1:5173");
    await connectDatabase();
    const registered = await agent.post("/api/v1/auth/sign-up/email").send({
      firstName: "Pantry",
      lastName: "Tester",
      name: "Pantry Tester",
      email: `pantry-${new mongoose.Types.ObjectId().toHexString()}@example.com`,
      password: "a long pantry test password",
    });
    expect(registered.status).toBe(200);
    userId = (registered.body as { user: { id: string } }).user.id;
  }, 20_000);

  afterAll(async () => {
    try {
      if (createdIds.length) {
        await FoodItemModel.deleteMany({ _id: { $in: createdIds } });
      }
    } finally {
      if (userId) {
        const db = mongoose.connection.db;
        const id = new mongoose.Types.ObjectId(userId);
        await db?.collection("session").deleteMany({ userId: id });
        await db?.collection("account").deleteMany({ userId: id });
        await db?.collection("user").deleteOne({ _id: id });
      }
      await mongoose.disconnect();
      vi.unstubAllEnvs();
    }
  });

  it("writes to MongoDB and returns the same record on a subsequent list request", async () => {
    const response = await agent.post("/api/v1/food-items").send({
      name: "  Integration test rice  ",
      quantity: 0.5,
      unit: "kg",
      expiresOn: "2028-02-29",
    });
    createdIds.push(foodItemSchema.parse(response.body).id);
    expect(response.status).toBe(201);
    const item = foodItemSchema.parse(response.body);
    expect(item).toMatchObject({
      name: "Integration test rice",
      quantity: 0.5,
      unit: "kg",
      expiresOn: "2028-02-29",
    });
    const stored = await FoodItemModel.findById(item.id).lean();
    expect(stored).toMatchObject({
      name: item.name,
      quantity: 0.5,
      expiresOn: "2028-02-29",
    });
    const listed = await agent.get("/api/v1/food-items");
    expect(listed.status).toBe(200);
    expect(foodItemListSchema.parse(listed.body).items).toContainEqual(item);
    expect(item).not.toHaveProperty("_id");
    expect(item).not.toHaveProperty("__v");
  });

  it("persists defaults for a name-only request and lists the newest item first", async () => {
    const response = await agent
      .post("/api/v1/food-items")
      .send({ name: "Integration test eggs" });
    createdIds.push(foodItemSchema.parse(response.body).id);
    expect(response.status).toBe(201);
    const item = foodItemSchema.parse(response.body);
    expect(item).toMatchObject({ quantity: 1, unit: "item", expiresOn: null });
    const listed = await agent.get("/api/v1/food-items");
    expect(foodItemListSchema.parse(listed.body).items[0]).toEqual(item);
  });

  it("persists customary units on create and update without converting quantity", async () => {
    const created = await agent.post("/api/v1/food-items").send({
      name: "Integration test customary units",
      quantity: 1.5,
      unit: "lb",
    });
    const original = foodItemSchema.parse(created.body);
    createdIds.push(original.id);
    expect(created.status).toBe(201);
    expect(await FoodItemModel.findById(original.id).lean()).toMatchObject({
      quantity: 1.5,
      unit: "lb",
    });
    const updated = await agent
      .patch(`/api/v1/food-items/${original.id}`)
      .send({ unit: "fl oz" });
    expect(updated.status).toBe(200);
    expect(foodItemSchema.parse(updated.body)).toMatchObject({
      quantity: 1.5,
      unit: "fl oz",
    });
    expect(await FoodItemModel.findById(original.id).lean()).toMatchObject({
      quantity: 1.5,
      unit: "fl oz",
    });
  });

  it("keeps internal write errors out of API responses", async () => {
    const create = vi
      .spyOn(FoodItemModel, "create")
      .mockRejectedValueOnce(new Error("private database details"));
    try {
      const response = await agent
        .post("/api/v1/food-items")
        .send({ name: "Rice" });
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred.",
        },
      });
    } finally {
      create.mockRestore();
    }
  });

  it("updates only provided fields, clears a date, and preserves ID and creation time", async () => {
    const created = await agent.post("/api/v1/food-items").send({
      name: "Integration test oats",
      quantity: 2,
      unit: "kg",
      expiresOn: "2028-02-29",
    });
    createdIds.push(foodItemSchema.parse(created.body).id);
    expect(created.status).toBe(201);
    const original = foodItemSchema.parse(created.body);

    const updated = await agent
      .patch(`/api/v1/food-items/${original.id}`)
      .send({ name: "  Rolled oats  ", expiresOn: null });
    expect(updated.status).toBe(200);
    const item = foodItemSchema.parse(updated.body);
    expect(item).toEqual({
      ...original,
      name: "Rolled oats",
      expiresOn: null,
      updatedAt: item.updatedAt,
    });
    expect(new Date(item.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(original.updatedAt).getTime(),
    );
    const stored = await FoodItemModel.findById(original.id).lean();
    expect(stored).toMatchObject({
      name: "Rolled oats",
      quantity: 2,
      unit: "kg",
      expiresOn: null,
    });

    const fetched = await agent.get(`/api/v1/food-items/${item.id}`);
    expect(fetched.status).toBe(200);
    expect(foodItemSchema.parse(fetched.body)).toEqual(item);
    const listed = await agent.get("/api/v1/food-items");
    expect(foodItemListSchema.parse(listed.body).items).toContainEqual(item);

    const invalid = await agent
      .patch(`/api/v1/food-items/${item.id}`)
      .send({ quantity: -3 });
    expect(invalid.status).toBe(400);
    expect((await FoodItemModel.findById(item.id))?.quantity).toBe(2);
  });

  it("deletes only the selected item and reports missing records consistently", async () => {
    const created = await agent
      .post("/api/v1/food-items")
      .send({ name: "Integration test remove me" });
    createdIds.push(foodItemSchema.parse(created.body).id);
    expect(created.status).toBe(201);
    const item = foodItemSchema.parse(created.body);
    const before = await agent.get("/api/v1/food-items");
    const beforeIds = foodItemListSchema
      .parse(before.body)
      .items.map((entry) => entry.id);
    const removed = await agent.delete(`/api/v1/food-items/${item.id}`);
    expect(removed.status).toBe(204);
    expect(removed.text).toBe("");
    expect(await FoodItemModel.findById(item.id)).toBeNull();
    const listed = await agent.get("/api/v1/food-items");
    expect(
      foodItemListSchema.parse(listed.body).items.map((entry) => entry.id),
    ).toEqual(beforeIds.filter((id) => id !== item.id));

    for (const method of ["get", "patch", "delete"] as const) {
      const client = agent;
      const response = await client[method](
        `/api/v1/food-items/${item.id}`,
      ).send({ quantity: 3 });
      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: { code: "FOOD_ITEM_NOT_FOUND", message: "Food item not found." },
      });
    }
  });

  it("paginates, counts, searches literally, and applies filters and sorting in MongoDB", async () => {
    const prefix = `Page-${new mongoose.Types.ObjectId().toHexString()}`;
    const documents = await FoodItemModel.insertMany(
      Array.from({ length: 35 }, (_, index) => ({
        userId,
        name: `${prefix} food ${index + 1}`,
        quantity: index + 1,
        unit: "item",
        expiresOn: index % 2 === 0 ? "2028-02-29" : null,
      })),
    );
    createdIds.push(...documents.map((document) => document._id.toHexString()));
    const sort = JSON.stringify([{ colId: "quantity", sort: "asc" }]);
    const first = await agent
      .get("/api/v1/food-items")
      .query({ start: 0, limit: 10, search: prefix, sort });
    expect(first.status).toBe(200);
    const page = foodItemListSchema.parse(first.body);
    expect(page).toMatchObject({ total: 35, start: 0, limit: 10 });
    expect(page.items.map((item) => item.quantity)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    const second = await agent
      .get("/api/v1/food-items")
      .query({ start: 10, limit: 10, search: prefix, sort });
    expect(
      foodItemListSchema.parse(second.body).items.map((item) => item.quantity),
    ).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    const last = await agent
      .get("/api/v1/food-items")
      .query({ start: 30, limit: 10, search: prefix, sort });
    expect(foodItemListSchema.parse(last.body).items).toHaveLength(5);
    const beyond = await agent
      .get("/api/v1/food-items")
      .query({ start: 40, limit: 10, search: prefix, sort });
    expect(foodItemListSchema.parse(beyond.body)).toMatchObject({
      items: [],
      total: 35,
    });
    const filtered = await agent.get("/api/v1/food-items").query({
      search: prefix,
      sort,
      filters: JSON.stringify({
        quantity: { filterType: "number", type: "greaterThan", filter: 30 },
        expiresOn: { filterType: "date", type: "blank" },
      }),
    });
    expect(
      foodItemListSchema
        .parse(filtered.body)
        .items.map((item) => item.quantity),
    ).toEqual([32, 34]);
    expect(foodItemListSchema.parse(filtered.body).total).toBe(2);
    const dated = await agent.get("/api/v1/food-items").query({
      search: prefix,
      filters: JSON.stringify({
        expiresOn: {
          filterType: "date",
          type: "equals",
          dateFrom: "2028-02-29 00:00:00",
        },
      }),
    });
    expect(foodItemListSchema.parse(dated.body).total).toBe(18);
    const literalName = `${prefix} [rice].*`;
    const literal = await FoodItemModel.create({
      userId,
      name: literalName,
      quantity: 1,
      unit: "kg",
    });
    createdIds.push(literal._id.toHexString());
    const escaped = await agent
      .get("/api/v1/food-items")
      .query({ search: literalName });
    expect(
      foodItemListSchema.parse(escaped.body).items.map((item) => item.name),
    ).toEqual([literalName]);
    const tieSort = JSON.stringify([
      { colId: "unit", sort: "asc" },
      { colId: "quantity", sort: "asc" },
    ]);
    const ties = await agent
      .get("/api/v1/food-items")
      .query({ search: prefix, limit: 100, sort: tieSort });
    expect(foodItemListSchema.parse(ties.body).items.at(-1)?.id).toBe(
      literal._id.toHexString(),
    );
  });
});
