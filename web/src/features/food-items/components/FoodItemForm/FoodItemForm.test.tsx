import type { FoodProduct } from "@sari/contracts";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import FoodItemForm from "./FoodItemForm";

const product: FoodProduct = {
  id: "012345678901234567890123",
  barcode: "00012345678905",
  name: "USDA oats",
  brand: "Oat brand",
  packageDescription: "500 g",
  packageQuantity: 500,
  packageUnit: "g",
  provider: "usda",
  externalId: "12345",
  marketCountry: "United States",
  sourceUrl: "https://fdc.nal.usda.gov/food-details/12345/nutrients",
  sourceModifiedAt: null,
  sourcePublishedAt: "2026-01-01",
  checkedAt: "2026-10-20T00:00:00Z",
};
afterEach(() => vi.unstubAllGlobals());

function setup() {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(
    <MemoryRouter>
      <FoodItemForm
        item={null}
        disabled={false}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    </MemoryRouter>,
  );
  return onSave;
}
function typeBarcode() {
  fireEvent.click(
    screen.getByRole("button", { name: "Scan or enter barcode" }),
  );
  fireEvent.change(screen.getByLabelText("Barcode number"), {
    target: { value: "012345678905" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Look up barcode" }));
}

describe("barcode-assisted pantry form", () => {
  it("preserves the draft and association when switching to camera input", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ product, stale: false })),
    );
    setup();
    typeBarcode();
    await screen.findByText("Linked product: USDA oats");
    fireEvent.click(screen.getByRole("button", { name: "Use camera" }));
    await screen.findByText(/Camera access is unavailable/);
    expect(screen.getByLabelText(/^Food name/)).toHaveValue("USDA oats");
    expect(screen.getByText("Linked product: USDA oats")).toBeInTheDocument();
  });
  it("preserves an edited amount and its unit when searching a different barcode", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ product, stale: false })),
    );
    setup();
    typeBarcode();
    await screen.findByText("Linked product: USDA oats");
    fireEvent.change(screen.getByLabelText(/^Quantity/), {
      target: { value: "250" },
    });
    fireEvent.change(screen.getByLabelText("Barcode number"), {
      target: { value: "96385074" },
    });
    expect(screen.getByLabelText(/^Quantity/)).toHaveValue(250);
    expect(screen.getByLabelText("Unit", { exact: true })).toHaveValue("g");
  });
  it("keeps quantity and unit together when the user already entered an amount", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ product, stale: false })),
    );
    setup();
    fireEvent.change(screen.getByLabelText(/^Quantity/), {
      target: { value: "2" },
    });
    typeBarcode();
    await screen.findByText("Linked product: USDA oats");
    expect(screen.getByLabelText(/^Quantity/)).toHaveValue(2);
    expect(screen.getByLabelText("Unit", { exact: true })).toHaveValue("item");
    expect(
      screen.getByRole("button", { name: "Replace entered fields" }),
    ).toBeInTheDocument();
  });
  it("keeps manual entry as the default and reviews a USDA match before save", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ product, stale: false }));
    vi.stubGlobal("fetch", fetcher);
    const onSave = setup();
    expect(screen.queryByLabelText("Barcode number")).not.toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
    typeBarcode();
    await screen.findByText("Linked product: USDA oats");
    expect(screen.getByLabelText(/^Food name/)).toHaveValue("USDA oats");
    expect(screen.getByLabelText(/^Quantity/)).toHaveValue(500);
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Add item" }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "USDA oats",
          quantity: 500,
          unit: "g",
          productId: product.id,
          barcode: product.barcode,
        }),
      );
    });
  });
  it("protects newer input while lookup is pending, then permits explicit replacement", async () => {
    let complete: ((response: Response) => void) | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            complete = resolve;
          }),
      ),
    );
    setup();
    typeBarcode();
    fireEvent.change(screen.getByLabelText(/^Food name/), {
      target: { value: "My breakfast" },
    });
    await act(async () => {
      complete?.(Response.json({ product, stale: false }));
      await Promise.resolve();
    });
    await screen.findByText("Linked product: USDA oats");
    expect(screen.getByLabelText(/^Food name/)).toHaveValue("My breakfast");
    fireEvent.click(
      screen.getByRole("button", { name: "Replace entered fields" }),
    );
    expect(screen.getByLabelText(/^Food name/)).toHaveValue("USDA oats");
  });
  it("removes associations without losing the suggested pantry values", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ product, stale: false })),
    );
    const onSave = setup();
    typeBarcode();
    await screen.findByText("Linked product: USDA oats");
    fireEvent.click(
      screen.getByRole("button", { name: "Remove product link" }),
    );
    expect(screen.getByLabelText(/^Food name/)).toHaveValue("USDA oats");
    expect(screen.getByLabelText(/^Quantity/)).toHaveValue(500);
    fireEvent.click(screen.getByRole("button", { name: "Add item" }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        name: "USDA oats",
        quantity: 500,
        unit: "g",
        expiresOn: null,
      });
    });
  });
  it("saves unmatched barcode details privately without a product reference", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            error: {
              code: "PRODUCT_NOT_FOUND",
              message: "Product not found. Enter details manually.",
            },
          },
          { status: 404 },
        ),
      ),
    );
    const onSave = setup();
    typeBarcode();
    await screen.findByText("Product not found. Enter details manually.");
    fireEvent.change(screen.getByLabelText(/^Food name/), {
      target: { value: "Local cereal" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add item" }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Local cereal",
          quantity: 1,
          unit: "item",
          barcode: product.barcode,
          productId: null,
        }),
      );
    });
  });
  it("ignores a result after the barcode input changes", async () => {
    let complete: ((response: Response) => void) | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            complete = resolve;
          }),
      ),
    );
    setup();
    typeBarcode();
    fireEvent.change(screen.getByLabelText("Barcode number"), {
      target: { value: "96385074" },
    });
    await act(async () => {
      complete?.(Response.json({ product, stale: false }));
      await Promise.resolve();
    });
    expect(screen.getByLabelText(/^Food name/)).toHaveValue("");
    expect(
      screen.queryByText("Linked product: USDA oats"),
    ).not.toBeInTheDocument();
  });
});
