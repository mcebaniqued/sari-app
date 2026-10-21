import { afterEach, expect, it, vi } from "vitest";
import { deleteFoodItems } from "./foodItemsApi";

afterEach(() => vi.unstubAllGlobals());

it("stops scheduling bulk deletes after a forbidden response and preserves partial outcomes", async () => {
  const ids = Array.from({ length: 13 }, (_, index) =>
    String(index).padStart(24, "0"),
  );
  const fetch = vi.fn((url: string) =>
    Promise.resolve(
      url.endsWith(ids[1] ?? "")
        ? Response.json(
            { error: { code: "FORBIDDEN", message: "Access denied." } },
            { status: 403 },
          )
        : new Response(null, { status: 204 }),
    ),
  );
  vi.stubGlobal("fetch", fetch);
  const result = await deleteFoodItems(ids);
  expect(fetch).toHaveBeenCalledTimes(10);
  expect(result.deletedIds).toEqual(
    ids.slice(0, 10).filter((id) => id !== ids[1]),
  );
  expect(result.failedIds).toEqual([ids[1], ...ids.slice(10)]);
  expect(result.accessDenied).toMatchObject({ status: 403, code: "FORBIDDEN" });
});
