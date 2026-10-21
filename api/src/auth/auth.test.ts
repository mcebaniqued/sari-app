import {
  authSessionSchema,
  authUserSchema,
  foodItemListSchema,
} from "@sari/contracts";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import app from "../app.js";
import { connectDatabase } from "../db.js";
import { FoodItemModel } from "../food-items/model.js";

const testUri = process.env.TEST_MONGODB_URI;
const origin = "http://127.0.0.1:5173";
const password = "  password  ";

// Real persistence needs an explicit _test database; CI and test:integration
// provide it, while ordinary local unit runs need no database credentials.
describe.skipIf(!testUri)("real authentication and pantry isolation", () => {
  const alice = request.agent(app).set("Origin", origin);
  const bob = request.agent(app).set("Origin", origin);
  const users: string[] = [];
  const items: string[] = [];
  const email = `alice-${new mongoose.Types.ObjectId().toHexString()}@example.com`;

  beforeAll(async () => {
    if (!testUri || !/\/_?[\w-]+_test(?:\?|$)/.test(testUri)) {
      throw new Error("Use an explicitly named _test database.");
    }
    vi.stubEnv("MONGODB_URI", testUri.replace(/_test(?=\?|$)/, "_auth_test"));
    vi.stubEnv(
      "BETTER_AUTH_SECRET",
      "auth-integration-test-secret-at-least-32-chars",
    );
    vi.stubEnv("BETTER_AUTH_URL", origin);
    await connectDatabase();
  }, 20_000);

  afterAll(async () => {
    try {
      await FoodItemModel.deleteMany({ _id: { $in: items } });
      const ids = users.map((id) => new mongoose.Types.ObjectId(id));
      const db = mongoose.connection.db;
      await db?.collection("session").deleteMany({ userId: { $in: ids } });
      await db?.collection("account").deleteMany({ userId: { $in: ids } });
      await db?.collection("user").deleteMany({ _id: { $in: ids } });
    } finally {
      await mongoose.disconnect();
      vi.unstubAllEnvs();
    }
  });

  it("registers separate names, normalizes email, hashes passwords, and restores the session", async () => {
    const response = await alice.post("/api/v1/auth/sign-up/email").send({
      name: "Ignored",
      firstName: " Alice ",
      lastName: " Nguyễn ",
      email: email.toUpperCase(),
      password,
    });
    expect(response.status).toBe(200);
    const user = authUserSchema.parse(
      (response.body as { user: unknown }).user,
    );
    users.push(user.id);
    expect(user).toMatchObject({
      firstName: "Alice",
      lastName: "Nguyễn",
      email,
    });
    expect(response.headers["set-cookie"]).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/sari.session_token=.*HttpOnly.*SameSite=Lax/i),
      ]),
    );
    const stored = await mongoose.connection.db
      ?.collection("account")
      .findOne({ userId: new mongoose.Types.ObjectId(user.id) });
    expect(stored?.password).toEqual(expect.any(String));
    expect(stored?.password).not.toBe(password);
    expect(response.text).not.toContain(String(stored?.password));
    const session = await alice.get("/api/v1/auth/get-session");
    expect(session.status).toBe(200);
    expect(authSessionSchema.parse(session.body)?.user).toEqual(user);
    const listed = await alice.get("/api/v1/food-items");
    expect(listed.status).toBe(200);
    expect(foodItemListSchema.parse(listed.body).total).toBe(0);
  });

  it("rejects duplicate email, invalid names, and short passwords", async () => {
    const input = {
      name: "Alice",
      firstName: "Alice",
      lastName: "Tester",
      email,
      password,
    };
    const duplicate = await request(app)
      .post("/api/v1/auth/sign-up/email")
      .set("Origin", origin)
      .send(input);
    expect(duplicate.status).toBe(422);
    expect(duplicate.body).toMatchObject({
      code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
    });
    for (const invalid of [{ firstName: " " }, { password: "a".repeat(11) }]) {
      const response = await request(app)
        .post("/api/v1/auth/sign-up/email")
        .set("Origin", origin)
        .send({ ...input, email: `invalid-${email}`, ...invalid });
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ code: "VALIDATION_ERROR" });
      if ("password" in invalid) {
        expect(response.body).toMatchObject({
          message: "Use at least 12 characters for your password.",
        });
      }
    }
  });

  it("scopes reads, counts, updates, and deletes to the session owner and hides legacy records", async () => {
    const registered = await bob.post("/api/v1/auth/sign-up/email").send({
      name: "Bob Tester",
      firstName: "Bob",
      lastName: "Tester",
      email: `bob-${email}`,
      password,
    });
    expect(registered.status).toBe(200);
    users.push(
      authUserSchema.parse((registered.body as { user: unknown }).user).id,
    );
    const created = await alice
      .post("/api/v1/food-items")
      .send({ name: "Alice rice" });
    expect(created.status).toBe(201);
    const id = (created.body as { id: string }).id;
    items.push(id);
    const legacy = await FoodItemModel.collection.insertOne({
      name: "Legacy rice",
      quantity: 1,
      unit: "kg",
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresOn: null,
    });
    items.push(legacy.insertedId.toHexString());
    const listed = await bob
      .get("/api/v1/food-items")
      .query({ search: "rice" });
    expect(foodItemListSchema.parse(listed.body)).toMatchObject({
      items: [],
      total: 0,
    });
    for (const method of ["get", "patch", "delete"] as const) {
      const response = await bob[method](`/api/v1/food-items/${id}`).send({
        name: "Stolen rice",
      });
      expect(response.status).toBe(404);
    }
    expect((await FoodItemModel.findById(id))?.name).toBe("Alice rice");
    const own = await alice.get("/api/v1/food-items");
    expect(
      foodItemListSchema.parse(own.body).items.map((item) => item.id),
    ).toEqual([id]);
    const spoofed = await bob
      .post("/api/v1/food-items")
      .send({ name: "Rice", userId: users[0] });
    expect(spoofed.status).toBe(400);
  });

  it("rejects cross-origin writes and keeps the original data", async () => {
    const response = await alice
      .post("/api/v1/food-items")
      .set("Origin", "https://attacker.example")
      .send({ name: "Injected rice" });
    expect(response.status).toBe(403);
    const logout = await alice
      .post("/api/v1/auth/sign-out")
      .set("Origin", "https://attacker.example")
      .send({});
    expect(logout.status).toBe(403);
    expect((await alice.get("/api/v1/food-items")).status).toBe(200);
  });

  it("rejects wrong credentials, logs out on the server, and accepts the exact original password", async () => {
    const wrong = await request(app)
      .post("/api/v1/auth/sign-in/email")
      .set("Origin", origin)
      .send({ email, password: password.trim() });
    expect(wrong.status).toBe(401);
    const before = await alice.get("/api/v1/auth/get-session");
    const token = (before.body as { session: { token: string } }).session.token;
    const logout = await alice.post("/api/v1/auth/sign-out").send({});
    expect(logout.status).toBe(200);
    expect((await alice.get("/api/v1/food-items")).status).toBe(401);
    expect(
      await mongoose.connection.db?.collection("session").findOne({ token }),
    ).toBeNull();
    const login = await alice
      .post("/api/v1/auth/sign-in/email")
      .send({ email: email.toUpperCase(), password });
    expect(login.status).toBe(200);
    expect((await alice.get("/api/v1/food-items")).status).toBe(200);
  });

  it("rejects expired and tampered sessions", async () => {
    const id = users[1];
    await mongoose.connection.db
      ?.collection("session")
      .updateMany(
        { userId: new mongoose.Types.ObjectId(id) },
        { $set: { expiresAt: new Date(0) } },
      );
    expect((await bob.get("/api/v1/food-items")).status).toBe(401);
    expect(
      authSessionSchema.parse((await bob.get("/api/v1/auth/get-session")).body),
    ).toBeNull();
    const invalid = await request(app)
      .get("/api/v1/food-items")
      .set("Cookie", "sari.session_token=tampered");
    expect(invalid.status).toBe(401);
  });

  it("limits registration attempts using shared database counters", async () => {
    const response = await request(app)
      .post("/api/v1/auth/sign-up/email")
      .set("Origin", origin)
      .send({
        name: "Limited Tester",
        firstName: "Limited",
        lastName: "Tester",
        email: `limited-${email}`,
        password,
      });
    expect(response.status).toBe(429);
    expect(response.headers["x-retry-after"]).toBeDefined();
  });
});
