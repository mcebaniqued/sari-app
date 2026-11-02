import type { FoodItem } from "@sari/contracts";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/apiFetch";
import { getFoodItem } from "../api/foodItemsApi";
import { useItemDetails } from "./useItemDetails";

vi.mock("../api/foodItemsApi", () => ({ getFoodItem: vi.fn() }));

const item = (id: string, revision = 1): FoodItem => ({
  id,
  name: `Item ${revision}`,
  quantity: 1,
  unit: "item",
  expiresOn: null,
  revision,
  createdAt: "2026-10-19T00:00:00Z",
  updatedAt: `2026-10-${String(19 + revision).padStart(2, "0")}T00:00:00Z`,
});
const firstId = "012345678901234567890123";
const secondId = "112345678901234567890123";

beforeEach(() => vi.mocked(getFoodItem).mockReset());

describe("item details loading", () => {
  it("uses a valid seed without verification when requested", () => {
    const cached = item(firstId, 1);

    const { result } = renderHook(() =>
      useItemDetails(firstId, cached, undefined, { verifySeed: false }),
    );

    expect(result.current.item).toEqual(cached);
    expect(result.current.loading).toBe(false);
    expect(result.current.verifying).toBe(false);
    expect(getFoodItem).not.toHaveBeenCalled();
  });

  it("rejects an invalid seed revision and loads the item instead", async () => {
    const invalidSeed = { ...item(firstId, 1), revision: -1 };
    const loaded = item(firstId, 2);
    vi.mocked(getFoodItem).mockResolvedValue(loaded);

    const { result } = renderHook(() =>
      useItemDetails(firstId, invalidSeed, undefined, { verifySeed: false }),
    );

    expect(result.current.item).toBeNull();
    expect(result.current.loading).toBe(true);
    await waitFor(() => {
      expect(result.current.item).toEqual(loaded);
    });
    expect(getFoodItem).toHaveBeenCalledTimes(1);
  });

  it("shows a trusted seed while verification updates it", async () => {
    const cached = item(firstId, 1);
    const verified = item(firstId, 2);
    vi.mocked(getFoodItem).mockResolvedValue(verified);

    const { result } = renderHook(() => useItemDetails(firstId, cached));

    expect(result.current.item).toEqual(cached);
    expect(result.current.verifying).toBe(true);
    await waitFor(() => {
      expect(result.current.verifying).toBe(false);
    });
    expect(result.current.item).toEqual(verified);
  });

  it("keeps newer displayed data when an older response arrives", async () => {
    const cached = item(firstId, 3);
    vi.mocked(getFoodItem).mockResolvedValue(item(firstId, 2));

    const { result } = renderHook(() => useItemDetails(firstId, cached));
    await waitFor(() => {
      expect(result.current.verifying).toBe(false);
    });

    expect(result.current.item).toEqual(cached);
  });

  it("ignores an out-of-order response after the route item changes", async () => {
    let resolveFirst: ((value: FoodItem) => void) | undefined;
    vi.mocked(getFoodItem).mockImplementation((id) => {
      if (id === firstId) {
        return new Promise((resolve) => {
          resolveFirst = resolve;
        });
      }

      return Promise.resolve(item(secondId, 2));
    });
    const { result, rerender } = renderHook(({ id }) => useItemDetails(id), {
      initialProps: { id: firstId },
    });

    rerender({ id: secondId });
    await waitFor(() => {
      expect(result.current.item?.id).toBe(secondId);
    });
    act(() => {
      resolveFirst?.(item(firstId, 4));
    });
    expect(result.current.item?.id).toBe(secondId);
  });

  it("keeps cached data on a temporary failure and retries explicitly", async () => {
    const cached = item(firstId, 1);
    vi.mocked(getFoodItem)
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(item(firstId, 2));
    const { result } = renderHook(() => useItemDetails(firstId, cached));

    await waitFor(() => {
      expect(result.current.verificationError).not.toBe("");
    });
    expect(result.current.item).toEqual(cached);
    act(() => {
      result.current.retry();
    });
    await waitFor(() => {
      expect(result.current.item?.revision).toBe(2);
    });
    expect(getFoodItem).toHaveBeenCalledTimes(2);
  });

  it("separates invalid, unavailable, and retryable initial states", async () => {
    const invalid = renderHook(() => useItemDetails("invalid"));
    expect(invalid.result.current.invalid).toBe(true);
    expect(getFoodItem).not.toHaveBeenCalled();
    invalid.unmount();

    vi.mocked(getFoodItem).mockRejectedValueOnce(
      new ApiError("Not found", 404, "FOOD_ITEM_NOT_FOUND"),
    );
    const unavailable = renderHook(() => useItemDetails(firstId));
    await waitFor(() => {
      expect(unavailable.result.current.unavailable).toBe(true);
    });
    expect(unavailable.result.current.initialError).toBe("");
    unavailable.unmount();

    vi.mocked(getFoodItem).mockRejectedValueOnce(new TypeError("offline"));
    const failed = renderHook(() => useItemDetails(firstId));
    await waitFor(() => {
      expect(failed.result.current.initialError).not.toBe("");
    });
    expect(failed.result.current.unavailable).toBe(false);
  });
});
