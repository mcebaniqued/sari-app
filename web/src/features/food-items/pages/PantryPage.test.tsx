import type { FoodItem } from "@sari/contracts";
import {
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
  createdAt: "2026-10-19T00:00:00Z",
  updatedAt: "2026-10-19T00:00:00Z",
};
const other: FoodItem = {
  ...item,
  id: "112345678901234567890123",
  name: "Eggs",
};

function stubFoodFetch(
  mutation: (url: string, init?: RequestInit) => Promise<Response>,
) {
  let loads = 0;
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false })),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      if (!init?.method || init.method === "GET") {
        loads++;
        return Promise.resolve(
          Response.json({
            items: [item, other],
            total: 2,
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
    expect(await dialog.findByRole("alert")).toHaveTextContent(
      "Could not save this item. Try again.",
    );
    expect(dialog.getByLabelText(/^Food name/)).toHaveValue("Oat milk");
    expect(fetch).toHaveBeenLastCalledWith(
      `/api/v1/food-items/${item.id}`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          name: "Oat milk",
          quantity: 0.5,
          unit: "l",
          expiresOn: null,
        }),
      }),
    );
    fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Milk" })).toBeVisible();
    expect(fetch).toHaveBeenCalledTimes(1);
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

  it("requires confirmation and retries only failed rows after a partial bulk deletion", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        Response.json(
          { error: { code: "DATABASE_UNAVAILABLE", message: "Unavailable" } },
          { status: 503 },
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
        ([url]) => url === `/api/v1/food-items/${item.id}`,
      ),
    ).toHaveLength(1);
    expect(
      fetch.mock.calls.filter(
        ([url]) => url === `/api/v1/food-items/${other.id}`,
      ),
    ).toHaveLength(2);
  });
});
