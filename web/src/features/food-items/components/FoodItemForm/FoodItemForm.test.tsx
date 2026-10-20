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
function manual() {
  fireEvent.click(
    screen.getByRole("button", { name: "Enter details manually" }),
  );
}
function barcode() {
  fireEvent.click(
    screen.getByRole("button", { name: "Input barcode instead" }),
  );
}
function search(value = "012345678905") {
  barcode();
  fireEvent.change(screen.getByLabelText("Barcode number"), {
    target: { value },
  });
  fireEvent.click(screen.getByRole("button", { name: "Find item" }));
}
function found() {
  return screen.findByText("USDA oats");
}
function match() {
  const fetcher = vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve(Response.json({ product, stale: false })),
    );
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
function failure(code: string, status: number) {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          Response.json(
            { error: { code, message: "Technical provider message." } },
            { status },
          ),
        ),
      ),
  );
}

describe("barcode-assisted pantry form", () => {
  it("starts with manual entry and only renders the selected entry method", () => {
    const fetcher = match();
    setup();
    expect(screen.getByLabelText(/^Food name/)).toHaveFocus();
    expect(screen.queryByLabelText("Barcode number")).not.toBeInTheDocument();
    barcode();
    expect(screen.getByLabelText("Barcode number")).toHaveFocus();
    expect(screen.queryByLabelText(/^Food name/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add item" }),
    ).not.toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("preserves the entire manual draft and barcode when switching views", () => {
    setup();
    fireEvent.change(screen.getByLabelText(/^Food name/), {
      target: { value: "Breakfast" },
    });
    fireEvent.change(screen.getByLabelText(/^Quantity/), {
      target: { value: "2.5" },
    });
    fireEvent.change(screen.getByLabelText("Unit", { exact: true }), {
      target: { value: "kg" },
    });
    fireEvent.change(screen.getByLabelText(/Expiration date/), {
      target: { value: "2028-02-29" },
    });
    barcode();
    fireEvent.change(screen.getByLabelText("Barcode number"), {
      target: { value: "0049000042559" },
    });
    manual();
    expect(screen.getByLabelText(/^Food name/)).toHaveValue("Breakfast");
    expect(screen.getByLabelText(/^Quantity/)).toHaveValue(2.5);
    expect(screen.getByLabelText("Unit", { exact: true })).toHaveValue("kg");
    expect(screen.getByLabelText(/Expiration date/)).toHaveValue("2028-02-29");
    barcode();
    expect(screen.getByLabelText("Barcode number")).toHaveValue(
      "0049000042559",
    );
  });

  it("returns to prefilled details after a match without saving", async () => {
    match();
    const onSave = setup();
    search();
    await found();
    expect(screen.queryByLabelText("Barcode number")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Food name/)).toHaveFocus();
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

  it("keeps edited quantity and unit together until replacement is confirmed", async () => {
    match();
    setup();
    fireEvent.change(screen.getByLabelText(/^Quantity/), {
      target: { value: "2" },
    });
    search();
    await found();
    expect(screen.getByLabelText(/^Quantity/)).toHaveValue(2);
    expect(screen.getByLabelText("Unit", { exact: true })).toHaveValue("item");
    fireEvent.click(
      screen.getByRole("button", { name: "Replace entered fields" }),
    );
    expect(screen.getByLabelText(/^Quantity/)).toHaveValue(500);
    expect(screen.getByLabelText("Unit", { exact: true })).toHaveValue("g");
  });

  it("preserves custom names and expiration dates while prefilling available fields", async () => {
    match();
    setup();
    fireEvent.change(screen.getByLabelText(/^Food name/), {
      target: { value: "My breakfast" },
    });
    fireEvent.change(screen.getByLabelText(/Expiration date/), {
      target: { value: "2028-02-29" },
    });
    search();
    await found();
    expect(screen.getByLabelText(/^Food name/)).toHaveValue("My breakfast");
    expect(screen.getByLabelText(/Expiration date/)).toHaveValue("2028-02-29");
    fireEvent.click(screen.getByRole("button", { name: "Keep my entries" }));
    expect(
      screen.queryByRole("button", { name: "Replace entered fields" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Quantity/)).toHaveValue(500);
  });

  it("preserves an edited amount when searching another barcode", async () => {
    match();
    setup();
    search();
    await found();
    fireEvent.change(screen.getByLabelText(/^Quantity/), {
      target: { value: "250" },
    });
    barcode();
    fireEvent.change(screen.getByLabelText("Barcode number"), {
      target: { value: "96385074" },
    });
    manual();
    expect(screen.getByLabelText(/^Quantity/)).toHaveValue(250);
    expect(screen.getByLabelText("Unit", { exact: true })).toHaveValue("g");
    expect(screen.getByLabelText(/^Food name/)).toHaveValue("");
  });

  it("preserves matched values when opening camera and returning to manual entry", async () => {
    match();
    setup();
    search();
    await found();
    barcode();
    fireEvent.click(screen.getByRole("button", { name: "Scan with camera" }));
    await screen.findByText(/Camera scanning needs a secure connection/);
    expect(screen.queryByLabelText("Barcode number")).not.toBeInTheDocument();
    manual();
    expect(screen.getByLabelText(/^Food name/)).toHaveValue("USDA oats");
    expect(screen.getByLabelText(/^Quantity/)).toHaveValue(500);
    await found();
  });

  it("removes the product link without losing the suggested values", async () => {
    match();
    const onSave = setup();
    search();
    await found();
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

  it("offers one not-found prompt and saves manual details with no product link", async () => {
    failure("PRODUCT_NOT_FOUND", 404);
    const onSave = setup();
    search();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Barcode not found. Enter the item details manually.",
    );
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(
      screen.queryByText(/No USDA product linked/),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Enter details manually" }),
    );
    expect(screen.getByLabelText(/^Food name/)).toHaveFocus();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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

  it("replaces a failed lookup with one invalid-barcode prompt without another request", async () => {
    failure("PRODUCT_NOT_FOUND", 404);
    setup();
    search();
    await screen.findByRole("alert");
    fireEvent.change(screen.getByLabelText("Barcode number"), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find item" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Invalid barcode. Enter the item details manually.",
    );
    expect(screen.getByLabelText("Barcode number")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("keeps service failures distinct from an unknown barcode", async () => {
    failure("LOOKUP_UNAVAILABLE", 503);
    setup();
    search();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not look up the barcode. Enter the item details manually.",
    );
    expect(
      screen.queryByText(/Technical provider message/),
    ).not.toBeInTheDocument();
  });

  it("shows one friendly save error and keeps the draft for retry", async () => {
    const onSave = setup();
    onSave.mockRejectedValueOnce(new Error("Internal provider detail."));
    fireEvent.change(screen.getByLabelText(/^Food name/), {
      target: { value: "Rice" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add item" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not save this item. Try again. Your entries have been kept.",
    );
    expect(
      screen.queryByText(/Internal provider detail/),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Food name/)).toHaveValue("Rice");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Add item" }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(2);
    });
  });

  it("explains invalid quantities without exposing schema messages", async () => {
    const onSave = setup();
    fireEvent.change(screen.getByLabelText(/^Food name/), {
      target: { value: "Rice" },
    });
    fireEvent.change(screen.getByLabelText(/^Quantity/), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add item" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enter a quantity greater than zero and no more than 1,000,000.",
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it.each(["manual", "barcode"])(
    "ignores late results after changing %s input",
    async (change) => {
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
      search();
      if (change === "manual") {
        manual();
        fireEvent.change(screen.getByLabelText(/^Food name/), {
          target: { value: "My breakfast" },
        });
      } else {
        fireEvent.change(screen.getByLabelText("Barcode number"), {
          target: { value: "96385074" },
        });
      }
      await act(async () => {
        complete?.(Response.json({ product, stale: false }));
        await Promise.resolve();
      });
      if (change === "barcode") {
        manual();
      }
      expect(screen.getByLabelText(/^Food name/)).toHaveValue(
        change === "manual" ? "My breakfast" : "",
      );
      expect(screen.queryByText("USDA oats")).not.toBeInTheDocument();
    },
  );
});
