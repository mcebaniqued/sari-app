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

// Real grid layout, sorting, filtering, and selection run in Playwright.
// This fixture isolates the page's modal and persistence behavior from jsdom layout.
vi.mock(
  "@/features/food-items/components/FoodItemsTable/FoodItemsTable",
  () => ({
    default: ({
      revision,
      disabled,
      onAdd,
      onEdit,
      onDelete,
    }: {
      revision: number;
      disabled: boolean;
      onAdd: () => void;
      onEdit: (item: FoodItem) => void;
      onDelete: (items: FoodItem[]) => void;
    }) => (
      <div>
        <span data-testid="revision">{revision}</span>
        <button disabled={disabled} onClick={onAdd}>
          Add item
        </button>
        <button
          disabled={disabled}
          onClick={() => {
            onEdit(item);
          }}
        >
          Edit Milk
        </button>
        <button
          disabled={disabled}
          onClick={() => {
            onDelete([item, other]);
          }}
        >
          Delete selected
        </button>
      </div>
    ),
  }),
);
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

async function addDialog() {
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Add item" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Add item" }));
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
    vi.stubGlobal("fetch", fetch);
    render(
      <MemoryRouter>
        <PantryPage />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const dialog = await addDialog();
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
    expect(screen.getByTestId("revision")).toHaveTextContent("1");
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
    vi.stubGlobal("fetch", fetch);
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
    vi.stubGlobal("fetch", fetch);
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
    vi.stubGlobal("fetch", fetch);
    render(
      <MemoryRouter>
        <PantryPage />
      </MemoryRouter>,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Delete selected" }),
    );
    expect(fetch).not.toHaveBeenCalled();
    let dialog = within(
      screen.getByRole("dialog", { name: "Delete 2 items?" }),
    );
    fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));
    dialog = within(screen.getByRole("dialog", { name: "Delete 2 items?" }));
    fireEvent.click(dialog.getByRole("button", { name: "Confirm delete" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "1 item could not be deleted",
    );
    expect(screen.getByTestId("revision")).toHaveTextContent("1");
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
