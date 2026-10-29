import type { CreateFoodItem, FoodItem } from "@sari/contracts";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { createMemoryRouter, Link, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import UnsavedChangesProvider from "@/contexts/UnsavedChangesContext";
import FoodItemEditorDialog from "./FoodItemEditorDialog";

const item: FoodItem = {
  id: "012345678901234567890123",
  name: "Milk",
  quantity: 0.5,
  unit: "l",
  expiresOn: "2026-11-01",
  revision: 2,
  createdAt: "2026-10-19T00:00:00Z",
  updatedAt: "2026-10-19T00:00:00Z",
};

afterEach(() => vi.unstubAllGlobals());

function EditorHarness({ editorItem = item }: { editorItem?: FoodItem }) {
  const [open, setOpen] = useState(true);

  return (
    <UnsavedChangesProvider>
      <Link to="/away">Leave pantry</Link>
      {open && (
        <FoodItemEditorDialog
          item={editorItem}
          busy={false}
          onSave={vi.fn()}
          onKeepSavedAndClose={vi.fn()}
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </UnsavedChangesProvider>
  );
}

function DismissalHarness({
  onSave,
}: {
  onSave: (values: CreateFoodItem) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <UnsavedChangesProvider>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Edit Milk
      </button>
      {open && (
        <FoodItemEditorDialog
          item={item}
          busy={false}
          onSave={onSave}
          onKeepSavedAndClose={vi.fn()}
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </UnsavedChangesProvider>
  );
}

function setup(
  initialEntries = ["/pantry"],
  editorItem = item,
  initialIndex?: number,
) {
  const router = createMemoryRouter(
    [
      {
        path: "/pantry",
        element: <EditorHarness editorItem={editorItem} />,
      },
      { path: "/away", element: <h1>Another page</h1> },
    ],
    { initialEntries, ...(initialIndex === undefined ? {} : { initialIndex }) },
  );
  render(<RouterProvider router={router} />);

  return router;
}

function setupDismissal() {
  const onSave = vi
    .fn<(values: CreateFoodItem) => Promise<void>>()
    .mockResolvedValue(undefined);
  const router = createMemoryRouter(
    [
      {
        path: "/pantry",
        element: <DismissalHarness onSave={onSave} />,
      },
    ],
    { initialEntries: ["/pantry"] },
  );
  render(<RouterProvider router={router} />);
  const editButton = screen.getByRole("button", { name: "Edit Milk" });
  editButton.focus();
  fireEvent.click(editButton);

  return { editButton, onSave };
}

describe("protected food item edits", () => {
  it("closes an unchanged edit from the Close modal button without confirmation", async () => {
    const { editButton } = setupDismissal();
    const closeButton = screen.getByRole("button", { name: "Close modal" });

    closeButton.focus();
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(
      screen.queryByRole("dialog", { name: "Discard changes?" }),
    ).not.toBeInTheDocument();
    expect(editButton).toHaveFocus();
  });

  it("keeps a changed draft and restores Close modal focus after continuing", async () => {
    setupDismissal();
    const name = screen.getByLabelText(/^Food name/);
    fireEvent.change(name, { target: { value: "Oat milk" } });
    await waitFor(() => expect(name).toHaveValue("Oat milk"));

    const closeButton = screen.getByRole("button", { name: "Close modal" });
    closeButton.focus();
    fireEvent.click(closeButton);
    expect(
      screen.getByRole("dialog", {
        name: "Discard changes?",
      }),
    ).toBeVisible();
    expect(name).toHaveValue("Oat milk");

    fireEvent.click(screen.getByRole("button", { name: "Continue editing" }));

    expect(screen.getByRole("dialog", { name: "Edit item" })).toBeVisible();
    expect(name).toHaveValue("Oat milk");
    expect(screen.getByRole("button", { name: "Close modal" })).toHaveFocus();
    expect(
      screen.queryByRole("dialog", { name: "Discard changes?" }),
    ).not.toBeInTheDocument();
  });

  it("discards a changed draft from Close modal without saving and restores its invoker", async () => {
    const { editButton, onSave } = setupDismissal();
    fireEvent.change(screen.getByLabelText(/^Food name/), {
      target: { value: "Oat milk" },
    });
    await waitFor(() =>
      expect(screen.getByLabelText(/^Food name/)).toHaveValue("Oat milk"),
    );

    const closeButton = screen.getByRole("button", { name: "Close modal" });
    closeButton.focus();
    fireEvent.click(closeButton);
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(onSave).not.toHaveBeenCalled();
    expect(editButton).toHaveFocus();
  });

  it("still closes an unchanged edit through Cancel, Escape, and backdrop dismissal", () => {
    const { editButton } = setupDismissal();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(editButton);
    fireEvent(
      screen.getByRole("dialog"),
      new Event("cancel", { bubbles: false, cancelable: true }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(editButton);
    const dialog = screen.getByRole("dialog");
    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
      bottom: 200,
      height: 100,
      left: 100,
      right: 200,
      top: 100,
      width: 100,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    });
    fireEvent.click(dialog, { clientX: 50, clientY: 50 });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "Discard changes?" }),
    ).not.toBeInTheDocument();
  });

  it("closes a clean edit immediately and treats normalized values as unchanged", async () => {
    setup();
    fireEvent.change(screen.getByLabelText(/^Food name/), {
      target: { value: " Milk " },
    });
    fireEvent.change(screen.getByLabelText(/^Quantity/), {
      target: { value: "0.50" },
    });
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("becomes clean again after every edited value is reverted", async () => {
    setup();
    const name = screen.getByLabelText(/^Food name/);
    const expiration = screen.getByLabelText(/Expiration date/);
    fireEvent.change(name, { target: { value: "Oat milk" } });
    fireEvent.change(expiration, { target: { value: "" } });
    fireEvent.change(name, { target: { value: item.name } });
    fireEvent.change(expiration, { target: { value: item.expiresOn } });
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("preserves the complete draft and logical focus after Escape is declined", async () => {
    setup();
    const name = screen.getByLabelText(/^Food name/);
    const quantity = screen.getByLabelText(/^Quantity/);
    fireEvent.change(name, { target: { value: "Oat milk" } });
    quantity.focus();
    await waitFor(() => expect(name).toHaveValue("Oat milk"));

    fireEvent(
      screen.getByRole("dialog"),
      new Event("cancel", { bubbles: false, cancelable: true }),
    );
    expect(
      screen.getByRole("dialog", { name: "Discard changes?" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Continue editing" }),
    ).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Continue editing" }));
    expect(screen.getByRole("dialog", { name: "Edit item" })).toBeVisible();
    expect(name).toHaveValue("Oat milk");
    expect(quantity).toHaveFocus();
  });

  it("guards Cancel and allowed backdrop dismissal, then discards", async () => {
    setup();
    fireEvent.change(screen.getByLabelText(/^Food name/), {
      target: { value: "Oat milk" },
    });
    await waitFor(() =>
      expect(screen.getByLabelText(/^Food name/)).toHaveValue("Oat milk"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue editing" }));

    const dialog = screen.getByRole("dialog", { name: "Edit item" });
    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
      bottom: 200,
      height: 100,
      left: 100,
      right: 200,
      top: 100,
      width: 100,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    });
    fireEvent.click(dialog, { clientX: 50, clientY: 50 });
    expect(
      screen.getByRole("dialog", { name: "Discard changes?" }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("blocks app navigation until the user explicitly discards", async () => {
    const router = setup();
    fireEvent.change(screen.getByLabelText(/^Food name/), {
      target: { value: "Oat milk" },
    });
    await waitFor(() =>
      expect(screen.getByLabelText(/^Food name/)).toHaveValue("Oat milk"),
    );

    fireEvent.click(screen.getByRole("link", { name: "Leave pantry" }));
    expect(router.state.location.pathname).toBe("/pantry");
    expect(
      screen.getByRole("dialog", { name: "Discard changes?" }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    await screen.findByRole("heading", { name: "Another page" });
    expect(router.state.location.pathname).toBe("/away");

    const afterUnmount = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(afterUnmount);
    expect(afterUnmount.defaultPrevented).toBe(false);
  });

  it("blocks browser history navigation and enables the native unload warning", async () => {
    const router = setup(["/away", "/pantry"]);
    fireEvent.change(screen.getByLabelText(/^Food name/), {
      target: { value: "Oat milk" },
    });
    await waitFor(() =>
      expect(screen.getByLabelText(/^Food name/)).toHaveValue("Oat milk"),
    );

    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);

    await act(async () => {
      await router.navigate(-1);
    });
    expect(router.state.location.pathname).toBe("/pantry");
    expect(
      await screen.findByRole("dialog", { name: "Discard changes?" }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    await screen.findByRole("heading", { name: "Another page" });
    expect(router.state.location.pathname).toBe("/away");
  });

  it("also guards forward browser history navigation", async () => {
    const router = setup(["/pantry", "/away"], item, 0);
    fireEvent.change(screen.getByLabelText(/^Food name/), {
      target: { value: "Oat milk" },
    });
    await waitFor(() =>
      expect(screen.getByLabelText(/^Food name/)).toHaveValue("Oat milk"),
    );

    await act(async () => {
      await router.navigate(1);
    });
    expect(router.state.location.pathname).toBe("/pantry");
    expect(
      await screen.findByRole("dialog", { name: "Discard changes?" }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    await screen.findByRole("heading", { name: "Another page" });
  });

  it("treats unlinking a saved product as a meaningful edit", () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    setup(["/pantry"], {
      ...item,
      productId: "112345678901234567890123",
      barcode: "00012345678905",
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Remove product link" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      screen.getByRole("dialog", { name: "Discard changes?" }),
    ).toBeVisible();
  });
});
