import type { FoodItem, FoodProduct } from "@sari/contracts";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { notify } from "@/components/Toast/notifications";
import PantryPage from "./PantryPage";

vi.mock("@/components/Toast/notifications", () => ({ notify: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());

const item: FoodItem = {
  id: "012345678901234567890123",
  name: "Milk",
  quantity: 0.5,
  unit: "l",
  expiresOn: "2026-11-01",
  revision: 0,
  createdAt: "2026-10-19T00:00:00Z",
  updatedAt: "2026-10-19T00:00:00Z",
};
const other: FoodItem = {
  ...item,
  id: "112345678901234567890123",
  name: "Eggs",
};
const localProduct: FoodProduct = {
  id: "212345678901234567890123",
  barcode: "00012345678905",
  name: "Local oats",
  brand: "Local brand",
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
const serverProduct: FoodProduct = {
  ...localProduct,
  id: "312345678901234567890123",
  barcode: "00000096385074",
  name: "Server oats",
  externalId: "67890",
  sourceUrl: "https://fdc.nal.usda.gov/food-details/67890/nutrients",
};

function stubFoodFetch(
  mutation: (url: string, init?: RequestInit) => Promise<Response>,
  initialItems: FoodItem[] = [item, other],
) {
  let loads = 0;
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      if (
        (!init?.method || init.method === "GET") &&
        url.startsWith("/api/v1/food-items?")
      ) {
        loads++;
        return Promise.resolve(
          Response.json({
            items: initialItems,
            total: initialItems.length,
            start: 0,
            limit: 20,
          }),
        );
      }

      return mutation(url, init);
    }),
  );
  return {
    get loads() {
      return loads;
    },
  };
}

async function addDialog(copy: "mobile" | "desktop" = "mobile") {
  // jsdom does not apply responsive CSS, so both Add controls remain in its DOM.
  await waitFor(() => {
    const buttons = screen.getAllByRole("button", { name: "Add item" });
    expect(buttons).toHaveLength(2);
    buttons.forEach((button) => expect(button).toBeEnabled());
  });
  const buttons = screen.getAllByRole("button", { name: "Add item" });
  const button = buttons[copy === "desktop" ? 1 : 0];
  if (!button) {
    throw new Error("Expected both responsive Add controls");
  }
  fireEvent.click(button);

  return within(screen.getByRole("dialog", { name: "Add item" }));
}

function containingForm(element: HTMLElement) {
  const form = element.closest("form");
  if (!form) {
    throw new Error("Expected the field to be inside a form");
  }

  return form;
}

describe("pantry modals and persistence", () => {
  it("opens a blank add modal, waits for persistence, then closes it", async () => {
    let complete: ((value: Response) => void) | undefined;
    const fetch = vi.fn().mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          complete = resolve;
        }),
    );
    const api = stubFoodFetch(fetch);
    render(
      <MemoryRouter>
        <PantryPage />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const dialog = await addDialog("desktop");
    fireEvent.change(dialog.getByLabelText(/^Food name/), {
      target: { value: "  Milk  " },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Add item" }));
    expect(dialog.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(dialog.getByRole("button", { name: "Close modal" })).toBeDisabled();
    expect(fetch).toHaveBeenLastCalledWith(
      "/api/v1/food-items",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Milk",
          quantity: 1,
          unit: "item",
          expiresOn: null,
        }),
      }),
    );
    complete?.(
      Response.json(
        { ...item, quantity: 1, unit: "item", expiresOn: null },
        { status: 201 },
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(notify).toHaveBeenCalledWith(
      "success",
      "Milk added to your pantry.",
    );
    await waitFor(() => {
      expect(api.loads).toBe(2);
    });
    expect(screen.getByRole("button", { name: "Edit Milk" })).toBeVisible();
  });

  it("keeps failed edits in the modal and lets the draft be canceled", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(
      Response.json(
        {
          error: {
            code: "DATABASE_UNAVAILABLE",
            message: "Please try again shortly.",
          },
        },
        { status: 503 },
      ),
    );
    stubFoodFetch(fetch);
    render(
      <MemoryRouter>
        <PantryPage />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Edit Milk" }));
    const dialog = within(screen.getByRole("dialog", { name: "Edit item" }));
    expect(dialog.getByLabelText(/^Food name/)).toHaveValue("Milk");
    expect(dialog.getByLabelText(/^Quantity/)).toHaveValue(0.5);
    fireEvent.change(dialog.getByLabelText(/^Food name/), {
      target: { value: "Oat milk" },
    });
    fireEvent.change(dialog.getByLabelText(/Expiration date/), {
      target: { value: "" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));
    expect(
      await dialog.findByRole("heading", {
        name: "We couldn't confirm your save",
      }),
    ).toHaveFocus();
    expect(dialog.getByLabelText(/^Food name/)).toHaveValue("Oat milk");
    expect(fetch).toHaveBeenCalledWith(
      `/api/v1/food-items/${item.id}`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          expectedRevision: item.revision,
          changes: {
            name: "Oat milk",
            quantity: 0.5,
            unit: "l",
            expiresOn: null,
          },
        }),
      }),
    );
    fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Milk" })).toBeVisible();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("keeps a stale edit draft and identifies the revision conflict", async () => {
    const current = { ...item, name: "Whole milk", revision: 1 };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          {
            error: {
              code: "FOOD_ITEM_REVISION_CONFLICT",
              message: "Changed.",
            },
          },
          { status: 409 },
        ),
      )
      .mockResolvedValueOnce(Response.json(current))
      .mockResolvedValueOnce(
        Response.json({ ...current, name: "Oat milk", revision: 2 }),
      );
    stubFoodFetch(fetch);
    render(
      <MemoryRouter>
        <PantryPage />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Edit Milk" }));
    const dialog = within(screen.getByRole("dialog", { name: "Edit item" }));
    fireEvent.change(dialog.getByLabelText(/^Food name/), {
      target: { value: "Oat milk" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));

    const recoveryHeading = await dialog.findByRole("heading", {
      name: "A newer version is available",
    });
    expect(recoveryHeading).toHaveFocus();
    const recoveryNotice = recoveryHeading.closest("section");
    expect(recoveryNotice).toHaveClass(
      "border-info-border",
      "border-l-4",
      "bg-info-subtle",
    );
    expect(recoveryNotice?.querySelector("svg")).not.toBeNull();
    expect(
      dialog.getByText(
        "This item changed elsewhere. Your edits are still here but haven't been saved.",
      ),
    ).toBeVisible();
    expect(dialog.getByLabelText(/^Food name/)).toHaveValue("Oat milk");
    expect(fetch).toHaveBeenCalledTimes(1);

    fireEvent.submit(containingForm(dialog.getByLabelText(/^Food name/)));
    expect(fetch).toHaveBeenCalledTimes(1);

    fireEvent.click(dialog.getByRole("button", { name: "Review changes" }));
    const review = within(
      await screen.findByRole("dialog", { name: "Review changes" }),
    );
    expect(
      review.getByText("Compare your edits with the latest saved version."),
    ).toBeVisible();
    expect(await review.findAllByText("Whole milk")).not.toHaveLength(0);
    expect(review.getAllByText("Oat milk")).not.toHaveLength(0);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(
      fetch.mock.calls.filter(
        ([, init]) => (init as RequestInit | undefined)?.method === "PATCH",
      ),
    ).toHaveLength(1);

    fireEvent.click(
      review.getByRole("button", {
        name: "Keep my draft",
      }),
    );
    await waitFor(() => {
      expect(
        dialog.getByRole("button", { name: "Save and replace" }),
      ).toHaveFocus();
    });
    fireEvent.click(dialog.getByRole("button", { name: "Save and replace" }));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(3);
    });
    expect(fetch).toHaveBeenLastCalledWith(
      `/api/v1/food-items/${item.id}`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          expectedRevision: current.revision,
          changes: {
            name: "Oat milk",
            quantity: 0.5,
            unit: "l",
            expiresOn: "2026-11-01",
          },
        }),
      }),
    );
  });

  it("ignores a conflict review that resolves after recovery is dismissed", async () => {
    let completeReview: ((response: Response) => void) | undefined;
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          {
            error: {
              code: "FOOD_ITEM_REVISION_CONFLICT",
              message: "Changed.",
            },
          },
          { status: 409 },
        ),
      )
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            completeReview = resolve;
          }),
      );
    stubFoodFetch(fetch);
    render(
      <MemoryRouter>
        <PantryPage />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Edit Milk" }));
    const dialog = within(screen.getByRole("dialog", { name: "Edit item" }));
    fireEvent.change(dialog.getByLabelText(/^Food name/), {
      target: { value: "Oat milk" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));
    await dialog.findByText("A newer version is available");

    fireEvent.click(dialog.getByRole("button", { name: "Review changes" }));
    expect(
      dialog.getByRole("button", { name: "Checking saved version…" }),
    ).toBeDisabled();
    fireEvent.submit(containingForm(dialog.getByLabelText(/^Food name/)));
    expect(
      fetch.mock.calls.filter(
        ([, init]) => (init as RequestInit | undefined)?.method === "PATCH",
      ),
    ).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    fireEvent.click(dialog.getByRole("button", { name: "Close modal" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await act(async () => {
      completeReview?.(
        Response.json({ ...item, name: "Whole milk", revision: 1 }),
      );
      await Promise.resolve();
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("discloses product identity and requires an explicit full-draft overwrite", async () => {
    const localItem = {
      ...item,
      productId: localProduct.id,
      barcode: localProduct.barcode,
    };
    const current = {
      ...localItem,
      name: "Server milk",
      quantity: 3,
      expiresOn: "2026-12-01",
      productId: serverProduct.id,
      barcode: serverProduct.barcode,
      revision: 1,
    };
    const patchBodies: unknown[] = [];
    const fetch = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes("/food-products/")) {
        return Promise.resolve(
          Response.json(
            url.endsWith(serverProduct.id) ? serverProduct : localProduct,
          ),
        );
      }
      if (init?.method === "PATCH") {
        if (typeof init.body !== "string") {
          throw new Error("Expected a JSON PATCH body.");
        }
        const body = JSON.parse(init.body) as {
          expectedRevision: number;
          changes: Partial<FoodItem>;
        };
        patchBodies.push(body);
        if (patchBodies.length === 1) {
          return Promise.resolve(
            Response.json(
              {
                error: {
                  code: "FOOD_ITEM_REVISION_CONFLICT",
                  message: "Changed.",
                },
              },
              { status: 409 },
            ),
          );
        }

        return Promise.resolve(
          Response.json({
            ...current,
            ...body.changes,
            revision: current.revision + 1,
          }),
        );
      }

      return Promise.resolve(Response.json(current));
    });
    stubFoodFetch(fetch, [localItem]);
    render(
      <MemoryRouter>
        <PantryPage />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Edit Milk" }));
    const dialog = within(screen.getByRole("dialog", { name: "Edit item" }));
    fireEvent.change(dialog.getByLabelText(/^Food name/), {
      target: { value: "My oat milk" },
    });
    fireEvent.change(dialog.getByLabelText(/^Quantity/), {
      target: { value: "4" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));
    await dialog.findByText("A newer version is available");
    fireEvent.click(dialog.getByRole("button", { name: "Review changes" }));

    const recovery = within(
      await screen.findByRole("dialog", { name: "Review changes" }),
    );
    expect(
      recovery.getAllByText(`Barcode ${localProduct.barcode}`, {
        exact: false,
      }),
    ).not.toHaveLength(0);
    expect(
      recovery.getAllByText(`Product ID ${localProduct.id}`, { exact: false }),
    ).not.toHaveLength(0);
    expect(
      recovery.getAllByText(`Barcode ${serverProduct.barcode}`, {
        exact: false,
      }),
    ).not.toHaveLength(0);
    expect(
      recovery.getAllByText(`Product ID ${serverProduct.id}`, { exact: false }),
    ).not.toHaveLength(0);
    expect(
      recovery.getByText(
        "Keeping your draft won't save it yet. Save and replace will overwrite the saved item with your full draft.",
      ),
    ).toBeVisible();
    expect(recovery.getAllByText("My oat milk")).not.toHaveLength(0);

    fireEvent.click(
      recovery.getByRole("button", {
        name: "Keep my draft",
      }),
    );
    await waitFor(() => {
      expect(
        dialog.getByRole("button", { name: "Save and replace" }),
      ).toHaveFocus();
    });
    expect(dialog.getByLabelText(/^Food name/)).toHaveValue("My oat milk");
    fireEvent.click(dialog.getByRole("button", { name: "Save and replace" }));

    await waitFor(() => {
      expect(patchBodies).toHaveLength(2);
    });
    expect(patchBodies[1]).toEqual({
      expectedRevision: current.revision,
      changes: {
        name: "My oat milk",
        quantity: 4,
        unit: localItem.unit,
        expiresOn: localItem.expiresOn,
        productId: localProduct.id,
        barcode: localProduct.barcode,
      },
    });
  });

  it("loads the reviewed server version and restores focus without another PATCH", async () => {
    const localItem = {
      ...item,
      productId: localProduct.id,
      barcode: localProduct.barcode,
    };
    const current = {
      ...localItem,
      name: "Server milk",
      quantity: 3,
      productId: serverProduct.id,
      barcode: serverProduct.barcode,
      revision: 1,
    };
    let patchCount = 0;
    const fetch = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes("/food-products/")) {
        return Promise.resolve(
          Response.json(
            url.endsWith(serverProduct.id) ? serverProduct : localProduct,
          ),
        );
      }
      if (init?.method === "PATCH") {
        patchCount++;

        return Promise.resolve(
          Response.json(
            {
              error: {
                code: "FOOD_ITEM_REVISION_CONFLICT",
                message: "Changed.",
              },
            },
            { status: 409 },
          ),
        );
      }

      return Promise.resolve(Response.json(current));
    });
    stubFoodFetch(fetch, [localItem]);
    render(
      <MemoryRouter>
        <PantryPage />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Edit Milk" }));
    const dialog = within(screen.getByRole("dialog", { name: "Edit item" }));
    fireEvent.change(dialog.getByLabelText(/^Food name/), {
      target: { value: "My oat milk" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));
    await dialog.findByText("A newer version is available");
    fireEvent.click(dialog.getByRole("button", { name: "Review changes" }));
    fireEvent.click(
      await dialog.findByRole("button", { name: "Use saved version" }),
    );

    expect(dialog.getByLabelText(/^Food name/)).toHaveValue("Server milk");
    await waitFor(() => {
      expect(dialog.getByLabelText(/^Food name/)).toHaveFocus();
    });
    expect(dialog.getByLabelText(/^Quantity/)).toHaveValue(3);
    expect(patchCount).toBe(1);
    fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("returns from review to the unresolved notice without adopting its revision", async () => {
    const current = { ...item, name: "Whole milk", revision: 1 };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          {
            error: { code: "FOOD_ITEM_REVISION_CONFLICT", message: "Changed." },
          },
          { status: 409 },
        ),
      )
      .mockResolvedValueOnce(Response.json(current));
    stubFoodFetch(fetch);
    render(
      <MemoryRouter>
        <PantryPage />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Edit Milk" }));
    const dialog = within(screen.getByRole("dialog", { name: "Edit item" }));
    fireEvent.change(dialog.getByLabelText(/^Food name/), {
      target: { value: "Oat milk" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));
    fireEvent.click(
      await dialog.findByRole("button", { name: "Review changes" }),
    );
    fireEvent.click(
      await dialog.findByRole("button", { name: "Back to editing" }),
    );

    expect(dialog.getByText("A newer version is available")).toBeVisible();
    expect(dialog.getByLabelText(/^Food name/)).toHaveValue("Oat milk");
    await waitFor(() => {
      expect(
        dialog.getByRole("button", { name: "Review changes" }),
      ).toHaveFocus();
    });
    expect(
      dialog.queryByRole("button", { name: "Save and replace" }),
    ).not.toBeInTheDocument();
    fireEvent.submit(containingForm(dialog.getByLabelText(/^Food name/)));
    expect(
      fetch.mock.calls.filter(
        ([, init]) => (init as RequestInit | undefined)?.method === "PATCH",
      ),
    ).toHaveLength(1);
  });

  it("requires another review when loading the saved version fails", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          {
            error: { code: "FOOD_ITEM_REVISION_CONFLICT", message: "Changed." },
          },
          { status: 409 },
        ),
      )
      .mockResolvedValueOnce(
        Response.json(
          { error: { code: "DATABASE_UNAVAILABLE", message: "Try later." } },
          { status: 503, headers: { "Retry-After": "10" } },
        ),
      )
      .mockResolvedValueOnce(
        Response.json(
          { error: { code: "DATABASE_UNAVAILABLE", message: "Try later." } },
          { status: 503, headers: { "Retry-After": "10" } },
        ),
      );
    stubFoodFetch(fetch);
    render(
      <MemoryRouter>
        <PantryPage />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Edit Milk" }));
    const dialog = within(screen.getByRole("dialog", { name: "Edit item" }));
    fireEvent.change(dialog.getByLabelText(/^Food name/), {
      target: { value: "Oat milk" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));
    fireEvent.click(
      await dialog.findByRole("button", { name: "Review changes" }),
    );

    const failedRead = await dialog.findByText(/could not be loaded/);
    expect(failedRead).toBeVisible();
    expect(failedRead).toHaveFocus();
    expect(dialog.getByLabelText(/^Food name/)).toHaveValue("Oat milk");
    fireEvent.click(dialog.getByRole("button", { name: "Try again" }));
    await waitFor(() => {
      expect(failedRead).toHaveFocus();
    });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(
      dialog.queryByRole("button", { name: "Save and replace" }),
    ).not.toBeInTheDocument();
  });

  it("conflicts again when the saved item changes after overwrite authorization", async () => {
    const reviewed = { ...item, name: "Whole milk", revision: 1 };
    const patchBodies: { expectedRevision: number }[] = [];
    const fetch = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        if (typeof init.body !== "string") {
          throw new Error("Expected a JSON PATCH body.");
        }
        const body = JSON.parse(init.body) as {
          expectedRevision: number;
        };
        patchBodies.push(body);

        return Promise.resolve(
          Response.json(
            {
              error: {
                code: "FOOD_ITEM_REVISION_CONFLICT",
                message: "Changed.",
              },
            },
            { status: 409 },
          ),
        );
      }

      return Promise.resolve(Response.json(reviewed));
    });
    stubFoodFetch(fetch);
    render(
      <MemoryRouter>
        <PantryPage />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Edit Milk" }));
    const dialog = within(screen.getByRole("dialog", { name: "Edit item" }));
    fireEvent.change(dialog.getByLabelText(/^Food name/), {
      target: { value: "Oat milk" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));
    fireEvent.click(
      await dialog.findByRole("button", { name: "Review changes" }),
    );
    fireEvent.click(
      await dialog.findByRole("button", { name: "Keep my draft" }),
    );
    fireEvent.click(dialog.getByRole("button", { name: "Save and replace" }));

    expect(
      await dialog.findByText("A newer version is available"),
    ).toBeVisible();
    expect(patchBodies).toHaveLength(2);
    expect(patchBodies[1]?.expectedRevision).toBe(reviewed.revision);
    expect(dialog.getByLabelText(/^Food name/)).toHaveValue("Oat milk");
  });

  it("keeps an edit draft after an unreadable successful response", async () => {
    const current = { ...item, name: "Whole milk", revision: 1 };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("{", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(Response.json(current))
      .mockResolvedValueOnce(Response.json(current));
    stubFoodFetch(fetch);
    render(
      <MemoryRouter>
        <PantryPage />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Edit Milk" }));
    const dialog = within(screen.getByRole("dialog", { name: "Edit item" }));
    fireEvent.change(dialog.getByLabelText(/^Food name/), {
      target: { value: "Oat milk" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));

    expect(
      await dialog.findByRole("heading", {
        name: "We couldn't confirm your save",
      }),
    ).toHaveFocus();
    expect(dialog.getByLabelText(/^Food name/)).toHaveValue("Oat milk");
    expect(
      dialog.queryByRole("button", { name: "Save changes" }),
    ).not.toBeInTheDocument();
    expect(
      dialog.getByRole("button", { name: "Check saved version" }),
    ).toBeVisible();
    expect(fetch).toHaveBeenCalledTimes(2);

    fireEvent.submit(containingForm(dialog.getByLabelText(/^Food name/)));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(
      fetch.mock.calls.filter(
        ([, init]) => (init as RequestInit | undefined)?.method === "PATCH",
      ),
    ).toHaveLength(1);
    expect(notify).not.toHaveBeenCalledWith(
      "success",
      expect.stringContaining("updated"),
    );
  });

  it("keeps the draft but prevents another save when the item is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const fetch = vi.fn().mockResolvedValueOnce(
      Response.json(
        {
          error: {
            code: "FOOD_ITEM_NOT_FOUND",
            message: "Food item not found.",
          },
        },
        { status: 404 },
      ),
    );
    stubFoodFetch(fetch);
    render(
      <MemoryRouter>
        <PantryPage />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Edit Milk" }));
    const dialog = within(screen.getByRole("dialog", { name: "Edit item" }));
    fireEvent.change(dialog.getByLabelText(/^Food name/), {
      target: { value: "Oat milk" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));

    const unavailable = within(
      await screen.findByRole("dialog", { name: "Item unavailable" }),
    );
    expect(
      unavailable.getByRole("heading", { name: "Item unavailable" }),
    ).toHaveFocus();
    expect(
      unavailable.getByText(/removed or is no longer accessible/),
    ).toBeVisible();
    expect(unavailable.getByText("Oat milk")).toBeVisible();
    expect(
      unavailable.queryByRole("button", { name: /Save/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(unavailable.getByRole("button", { name: "Close modal" }));
    expect(
      screen.getByRole("dialog", { name: "Discard changes?" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Continue editing" }));
    expect(
      screen.getByRole("dialog", { name: "Item unavailable" }),
    ).toBeVisible();
    fireEvent.click(unavailable.getByRole("button", { name: "Copy details" }));
    expect(
      await unavailable.findByRole("button", { name: "Copied" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(unavailable.queryByText("Details copied")).not.toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("Name: Oat milk"),
    );
    fireEvent.click(
      unavailable.getByRole("button", { name: "Discard and close" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("rejects whitespace names before making a save request", async () => {
    const fetch = vi.fn();
    stubFoodFetch(fetch);
    render(
      <MemoryRouter>
        <PantryPage />
      </MemoryRouter>,
    );
    const dialog = await addDialog();
    fireEvent.change(dialog.getByLabelText(/^Food name/), {
      target: { value: "   " },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Add item" }));
    expect(await dialog.findByRole("alert")).toHaveTextContent(
      "Enter a food name with 120 characters or fewer.",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("defensively retries only unresolved rows after an unexpected non-ambiguous delete failure", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        Response.json(
          {
            error: {
              code: "UNEXPECTED_DELETE_FAILURE",
              message: "Unexpected delete failure.",
            },
          },
          { status: 422 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const api = stubFoodFetch(fetch);
    render(
      <MemoryRouter>
        <PantryPage />
      </MemoryRouter>,
    );
    const table = within(screen.getByRole("table"));
    await table.findByRole("checkbox", { name: "Select Milk" });
    fireEvent.click(table.getByRole("checkbox", { name: "Select Milk" }));
    fireEvent.click(table.getByRole("checkbox", { name: "Select Eggs" }));
    const desktopActions = screen.getAllByRole("toolbar", {
      name: "Selected items",
    })[0];
    if (!desktopActions) {
      throw new Error("Missing desktop bulk actions");
    }
    const bulkActions = within(desktopActions);
    fireEvent.click(bulkActions.getByRole("button", { name: "Delete (2)" }));
    expect(fetch).not.toHaveBeenCalled();
    let dialog = within(
      screen.getByRole("dialog", { name: "Delete 2 items?" }),
    );
    fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(bulkActions.getByRole("button", { name: "Delete (2)" }));
    dialog = within(screen.getByRole("dialog", { name: "Delete 2 items?" }));
    fireEvent.click(dialog.getByRole("button", { name: "Confirm delete" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "1 item could not be deleted",
    );
    expect(notify).toHaveBeenCalledWith(
      "success",
      "1 item deleted from your pantry.",
    );
    await waitFor(() => {
      expect(api.loads).toBe(2);
    });
    dialog = within(screen.getByRole("dialog", { name: "Delete item?" }));
    expect(dialog.queryByText("Milk")).not.toBeInTheDocument();
    expect(dialog.getByText("Eggs")).toBeVisible();
    fireEvent.click(dialog.getByRole("button", { name: "Confirm delete" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(
      fetch.mock.calls.filter(
        ([url]) =>
          url === `/api/v1/food-items/${item.id}/revisions/${item.revision}`,
      ),
    ).toHaveLength(1);
    expect(
      fetch.mock.calls.filter(
        ([url]) =>
          url === `/api/v1/food-items/${other.id}/revisions/${other.revision}`,
      ),
    ).toHaveLength(2);
  });
});
