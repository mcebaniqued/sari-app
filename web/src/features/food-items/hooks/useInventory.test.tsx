import type { FoodItem } from "@sari/contracts";
import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listFoodItems } from "../api/foodItemsApi";
import { useInventory } from "./useInventory";

vi.mock("../api/foodItemsApi", () => ({ listFoodItems: vi.fn() }));
vi.mock("@/components/Toast/notifications", () => ({ notify: vi.fn() }));

const items: FoodItem[] = Array.from({ length: 25 }, (_, index) => ({
  id: index.toString(16).padStart(24, "0"),
  name: `Food ${index + 1}`,
  quantity: 1,
  unit: "item",
  expiresOn: null,
  createdAt: "2026-10-19T00:00:00Z",
  updatedAt: "2026-10-19T00:00:00Z",
}));

function itemAt(index: number): FoodItem {
  const item = items[index];
  if (!item) {
    throw new Error(`Missing fixture item ${index}`);
  }

  return item;
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

beforeEach(() => {
  vi.mocked(listFoodItems).mockReset();
});

describe("inventory result lifecycle", () => {
  it("loads server batches, deduplicates IDs, and retains selection across batches", async () => {
    vi.mocked(listFoodItems).mockImplementation((query) =>
      Promise.resolve({
        items:
          query.start === 0
            ? items.slice(0, 20)
            : [itemAt(19), ...items.slice(21)],
        total: 25,
        start: query.start,
        limit: query.limit,
      }),
    );
    const { result } = renderHook(() => useInventory(), { wrapper });
    await waitFor(() => {
      expect(result.current.items).toHaveLength(20);
    });
    act(() => {
      result.current.setSelectedIds(new Set([itemAt(0).id]));
    });
    await act(() => result.current.loadMore());
    expect(
      vi.mocked(listFoodItems).mock.calls.map(([query]) => query.start),
    ).toEqual([0, 20]);
    expect(result.current.items.map((item) => item.id)).toEqual([
      ...items.slice(0, 20).map((item) => item.id),
      ...items.slice(21).map((item) => item.id),
    ]);
    expect(result.current.selected.map((item) => item.id)).toEqual([
      itemAt(0).id,
    ]);
    expect(result.current.hasMore).toBe(false);
  });

  it("ignores stale results and clears selection when an applied query changes", async () => {
    let finishFirst:
      ((value: Awaited<ReturnType<typeof listFoodItems>>) => void) | undefined;
    vi.mocked(listFoodItems).mockImplementation((query) => {
      if (!query.search) {
        return new Promise((resolve) => {
          finishFirst = resolve;
        });
      }
      return Promise.resolve({
        items: [itemAt(1)],
        total: 1,
        start: 0,
        limit: 20,
      });
    });
    const { result } = renderHook(() => useInventory(), { wrapper });
    await waitFor(() => {
      expect(listFoodItems).toHaveBeenCalledTimes(1);
    });
    act(() => {
      result.current.setSelectedIds(new Set([itemAt(0).id]));
      result.current.applyQuery({ ...result.current.query, search: "Food 2" });
    });
    await waitFor(() => {
      expect(result.current.items.map((item) => item.name)).toEqual(["Food 2"]);
    });
    act(() => {
      finishFirst?.({ items: [itemAt(0)], total: 1, start: 0, limit: 20 });
    });
    expect(result.current.items.map((item) => item.name)).toEqual(["Food 2"]);
    expect(result.current.selected).toEqual([]);
    expect(
      vi.mocked(listFoodItems).mock.calls.map(([query]) => query.search),
    ).toEqual(["", "Food 2"]);
  });

  it("keeps loaded rows after a failed next batch and retries the same offset", async () => {
    vi.mocked(listFoodItems)
      .mockResolvedValueOnce({
        items: items.slice(0, 20),
        total: 25,
        start: 0,
        limit: 20,
      })
      .mockRejectedValueOnce(new Error("Network failure"))
      .mockResolvedValueOnce({
        items: items.slice(20),
        total: 25,
        start: 20,
        limit: 20,
      });
    const { result } = renderHook(() => useInventory(), { wrapper });
    await waitFor(() => {
      expect(result.current.items).toHaveLength(20);
    });
    await act(() => result.current.loadMore());
    expect(result.current.items).toHaveLength(20);
    expect(result.current.error).toBeTruthy();
    act(() => {
      result.current.retryLoad();
    });
    await waitFor(() => {
      expect(result.current.items).toHaveLength(25);
    });
    expect(
      vi.mocked(listFoodItems).mock.calls.map(([query]) => query.start),
    ).toEqual([0, 20, 20]);
  });

  it("invalidates after a mutation while preserving the applied query", async () => {
    vi.mocked(listFoodItems).mockImplementation((query) =>
      Promise.resolve({
        items: query.start === 0 ? items.slice(0, 20) : items.slice(20),
        total: 25,
        start: query.start,
        limit: 20,
      }),
    );
    const { result } = renderHook(() => useInventory(), { wrapper });
    await waitFor(() => {
      expect(result.current.items).toHaveLength(20);
    });
    act(() => {
      result.current.applyQuery({
        ...result.current.query,
        sort: [{ colId: "name", sort: "asc" }],
      });
    });
    await waitFor(() => {
      expect(vi.mocked(listFoodItems)).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(result.current.items).toHaveLength(20);
    });
    await act(() => result.current.loadMore());
    act(() => {
      result.current.setSelectedIds(new Set([itemAt(0).id]));
    });
    act(() => {
      result.current.invalidate();
    });
    await waitFor(() => {
      expect(vi.mocked(listFoodItems)).toHaveBeenCalledTimes(4);
    });
    expect(vi.mocked(listFoodItems).mock.calls.at(-1)?.[0]).toMatchObject({
      start: 0,
      sort: [{ colId: "name", sort: "asc" }],
    });
    expect(result.current.selected).toEqual([]);
    expect(result.current.items).toHaveLength(20);
  });
});
