import type { FoodItem } from "@sari/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteFoodItems,
  type FoodItemMutationOutcomeError,
  updateFoodItem,
} from "./foodItemsApi";

const item = (index: number): FoodItem => ({
  id: String(index).padStart(24, "0"),
  name: `Item ${index}`,
  quantity: 1,
  unit: "item",
  expiresOn: null,
  revision: index,
  createdAt: "2026-10-19T00:00:00Z",
  updatedAt: "2026-10-19T00:00:00Z",
});

afterEach(() => vi.unstubAllGlobals());

describe("revision-aware food item mutations", () => {
  it("sends the expected revision in the fail-closed PATCH contract", async () => {
    const original = item(2);
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        ...original,
        name: "Updated",
        revision: original.revision + 1,
      }),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      updateFoodItem(original.id, {
        expectedRevision: original.revision,
        changes: { name: "Updated" },
      }),
    ).resolves.toMatchObject({ name: "Updated", revision: 3 });
    expect(fetch).toHaveBeenCalledWith(
      `/api/v1/food-items/${original.id}`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          expectedRevision: original.revision,
          changes: { name: "Updated" },
        }),
      }),
    );
  });

  it("stops scheduling bulk deletes after a forbidden response and preserves partial outcomes", async () => {
    const items = Array.from({ length: 13 }, (_, index) => item(index));
    const forbidden = items[1];
    if (!forbidden) {
      throw new Error("Expected a forbidden test item.");
    }
    const fetch = vi.fn((url: string) =>
      Promise.resolve(
        url.includes(`/${forbidden.id}/`)
          ? Response.json(
              { error: { code: "FORBIDDEN", message: "Access denied." } },
              { status: 403 },
            )
          : new Response(null, { status: 204 }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const result = await deleteFoodItems(items);
    expect(fetch).toHaveBeenCalledTimes(10);
    expect(result.deletedIds).toEqual(
      items
        .slice(0, 10)
        .filter((entry) => entry !== items[1])
        .map(({ id }) => id),
    );
    expect(result.failedIds).toEqual([
      forbidden.id,
      ...items.slice(10).map(({ id }) => id),
    ]);
    expect(result.accessDenied).toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    });
  });

  it("distinguishes a stale delete from an ordinary failure", async () => {
    const target = item(1);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            error: {
              code: "FOOD_ITEM_REVISION_CONFLICT",
              message: "Changed.",
            },
          },
          { status: 409 },
        ),
      ),
    );

    await expect(deleteFoodItems([target])).resolves.toMatchObject({
      conflictedIds: [target.id],
      uncertainIds: [],
      failedIds: [],
    });
  });

  it("preserves confirmed bulk-delete successes when another item conflicts", async () => {
    const current = item(1);
    const stale = item(2);
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          url.includes(`/${stale.id}/`)
            ? Response.json(
                {
                  error: {
                    code: "FOOD_ITEM_REVISION_CONFLICT",
                    message: "Changed.",
                  },
                },
                { status: 409 },
              )
            : new Response(null, { status: 204 }),
        ),
      ),
    );

    await expect(deleteFoodItems([current, stale])).resolves.toMatchObject({
      deletedIds: [current.id],
      conflictedIds: [stale.id],
      uncertainIds: [],
      failedIds: [],
    });
  });

  it("does not repeat an ambiguous delete and verifies current state", async () => {
    const target = item(1);
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          { error: { code: "DATABASE_UNAVAILABLE", message: "Unavailable." } },
          { status: 503 },
        ),
      )
      .mockResolvedValueOnce(Response.json(target));
    vi.stubGlobal("fetch", fetch);

    await expect(deleteFoodItems([target])).resolves.toMatchObject({
      deletedIds: [],
      uncertainIds: [target.id],
      failedIds: [],
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(
      fetch.mock.calls.filter(
        (call) => (call[1] as RequestInit | undefined)?.method === "DELETE",
      ),
    ).toHaveLength(1);
    expect(fetch).toHaveBeenLastCalledWith(
      `/api/v1/food-items/${target.id}`,
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it("verifies a PATCH after an unreadable successful response", async () => {
    const original = item(1);
    const current = { ...original, name: "Updated", revision: 2 };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("{", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(Response.json(current));
    vi.stubGlobal("fetch", fetch);

    await expect(
      updateFoodItem(original.id, {
        expectedRevision: original.revision,
        changes: { name: "Updated" },
      }),
    ).rejects.toMatchObject({
      name: "FoodItemMutationOutcomeError",
      outcome: "uncertain",
      currentItem: current,
    } satisfies Partial<FoodItemMutationOutcomeError>);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(
      fetch.mock.calls.filter(
        (call) => (call[1] as RequestInit | undefined)?.method === "PATCH",
      ),
    ).toHaveLength(1);
  });

  it("verifies a PATCH after a schema-invalid successful response", async () => {
    const original = item(1);
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ ...original, revision: "2" }))
      .mockResolvedValueOnce(Response.json(original));
    vi.stubGlobal("fetch", fetch);

    await expect(
      updateFoodItem(original.id, {
        expectedRevision: original.revision,
        changes: { name: "Updated" },
      }),
    ).rejects.toMatchObject({
      name: "FoodItemMutationOutcomeError",
      outcome: "uncertain",
      currentItem: original,
    } satisfies Partial<FoodItemMutationOutcomeError>);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("verifies a DELETE after an unreadable successful response", async () => {
    const target = item(1);
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("not JSON", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(Response.json(target));
    vi.stubGlobal("fetch", fetch);

    await expect(deleteFoodItems([target])).resolves.toMatchObject({
      deletedIds: [],
      uncertainIds: [target.id],
      failedIds: [],
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(
      fetch.mock.calls.filter(
        (call) => (call[1] as RequestInit | undefined)?.method === "DELETE",
      ),
    ).toHaveLength(1);
  });

  it("keeps an outcome uncertain when verification also cannot be read", async () => {
    const original = item(1);
    const unreadable = () =>
      new Response("{", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(unreadable())
      .mockResolvedValueOnce(unreadable());
    vi.stubGlobal("fetch", fetch);

    await expect(
      updateFoodItem(original.id, {
        expectedRevision: original.revision,
        changes: { name: "Updated" },
      }),
    ).rejects.toMatchObject({
      name: "FoodItemMutationOutcomeError",
      outcome: "uncertain",
      currentItem: undefined,
    } satisfies Partial<FoodItemMutationOutcomeError>);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
