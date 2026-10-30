import type { FoodItem } from "@sari/contracts";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  FoodItemRecoveryView,
  FoodItemUnavailableView,
} from "./FoodItemRecoveryView";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const saved: FoodItem = {
  id: "012345678901234567890123",
  name: "Saved milk",
  quantity: 1,
  unit: "l",
  expiresOn: "2026-11-01",
  productId: "112345678901234567890123",
  barcode: "00000096385074",
  revision: 2,
  createdAt: "2026-10-19T00:00:00Z",
  updatedAt: "2026-10-19T00:01:00Z",
};

const draft = {
  name: "Draft milk",
  quantity: "1",
  unit: "l",
  expiresOn: "2026-11-01",
  productId: "212345678901234567890123",
  barcode: "00012345678905",
};

it("compares only differing persisted values in a semantic table", () => {
  const onBack = vi.fn();
  const onKeepSaved = vi.fn();
  const onOverwrite = vi.fn();
  render(
    <FoodItemRecoveryView
      kind="conflict"
      draft={draft}
      saved={saved}
      product={null}
      onBack={onBack}
      pending={false}
      onKeepSaved={onKeepSaved}
      onOverwrite={onOverwrite}
    />,
  );

  const table = screen.getByRole("table");
  expect(
    within(table).getByRole("columnheader", { name: "Field" }),
  ).toBeVisible();
  expect(
    within(table).getByRole("columnheader", {
      name: "Your edits",
    }),
  ).toBeVisible();
  expect(
    within(table).getByRole("columnheader", { name: "Latest saved" }),
  ).toBeVisible();
  expect(
    within(table).getByRole("columnheader", {
      name: "Your edits",
    }),
  ).toHaveClass("bg-brand-subtle");
  expect(
    within(table).getByRole("columnheader", { name: "Latest saved" }),
  ).toHaveClass("bg-surface-subtle");
  expect(within(table).getByText("Name")).toBeVisible();
  expect(within(table).getByText("Product link")).toBeVisible();
  expect(within(table).queryByText("Quantity")).not.toBeInTheDocument();
  expect(within(table).queryByText("Unit")).not.toBeInTheDocument();
  expect(within(table).queryByText("Expiration date")).not.toBeInTheDocument();
  expect(table).toHaveTextContent(`Product ID ${draft.productId}`);
  expect(table).toHaveTextContent(`Product ID ${saved.productId ?? ""}`);
  expect(
    screen.getByText(
      "Overwriting replaces all saved item values with your draft, not just the fields you changed.",
    ),
  ).toBeVisible();
  expect(
    screen.queryByText(
      "Compare your unsaved draft with the newer saved version.",
    ),
  ).not.toBeInTheDocument();

  const back = screen.getByRole("button", { name: "Back" });
  const keepSaved = screen.getByRole("button", {
    name: "Keep saved & close",
  });
  const overwrite = screen.getByRole("button", { name: "Overwrite saved" });
  expect(back).not.toHaveClass("bg-brand");
  expect(keepSaved).toHaveClass("border", "bg-surface");
  expect(overwrite).toHaveClass("bg-brand");
  expect(keepSaved).not.toHaveClass("bg-brand");

  fireEvent.click(back);
  fireEvent.click(keepSaved);
  fireEvent.click(overwrite);
  expect(onBack).toHaveBeenCalledOnce();
  expect(onKeepSaved).toHaveBeenCalledOnce();
  expect(onOverwrite).toHaveBeenCalledOnce();
});

it("keeps uncertain-save meaning concise without claiming the save failed", () => {
  render(
    <FoodItemRecoveryView
      kind="uncertain"
      draft={draft}
      saved={saved}
      product={null}
      pending={false}
      onBack={vi.fn()}
      onKeepSaved={vi.fn()}
      onOverwrite={vi.fn()}
    />,
  );

  expect(
    screen.getByText(
      "Matching values do not confirm whether the earlier save finished. Overwriting replaces all saved item values with your draft, not just the fields you changed.",
    ),
  ).toBeVisible();
  expect(
    screen.queryByText(/earlier save (?:did not|didn't) finish/i),
  ).not.toBeInTheDocument();
});

it("normalizes equivalent persisted values before comparing versions", () => {
  const equivalentSaved = { ...saved, expiresOn: null };

  render(
    <FoodItemRecoveryView
      kind="uncertain"
      draft={{
        name: `  ${equivalentSaved.name}  `,
        quantity: "1.00",
        unit: equivalentSaved.unit,
        expiresOn: "",
        productId: equivalentSaved.productId ?? null,
        barcode: equivalentSaved.barcode ?? null,
      }}
      saved={equivalentSaved}
      product={null}
      pending={false}
      onBack={vi.fn()}
      onKeepSaved={vi.fn()}
      onOverwrite={vi.fn()}
    />,
  );

  expect(
    screen.getByText(
      "No differences were found between your draft and the saved version.",
    ),
  ).toBeVisible();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Keep saved & close" }),
  ).toBeVisible();
});

it("keeps meaningful normalized field differences visible", () => {
  render(
    <FoodItemRecoveryView
      kind="conflict"
      draft={{
        name: saved.name,
        quantity: "2",
        unit: "kg",
        expiresOn: "",
        productId: saved.productId ?? null,
        barcode: saved.barcode ?? null,
      }}
      saved={saved}
      product={null}
      pending={false}
      onBack={vi.fn()}
      onKeepSaved={vi.fn()}
      onOverwrite={vi.fn()}
    />,
  );

  const table = screen.getByRole("table");
  expect(within(table).getByText("Quantity")).toBeVisible();
  expect(within(table).getByText("Unit")).toBeVisible();
  expect(within(table).getByText("Expiration date")).toBeVisible();
});

it("keeps recovery actions focused and prevents activation while overwrite is pending", () => {
  const onBack = vi.fn();
  const onKeepSaved = vi.fn();
  const onOverwrite = vi.fn();
  render(
    <FoodItemRecoveryView
      kind="conflict"
      draft={draft}
      saved={saved}
      product={null}
      pending
      onBack={onBack}
      onKeepSaved={onKeepSaved}
      onOverwrite={onOverwrite}
    />,
  );

  const overwrite = screen.getByRole("button", { name: "Overwrite saved" });
  overwrite.focus();
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  fireEvent.click(screen.getByRole("button", { name: "Keep saved & close" }));
  fireEvent.click(overwrite);

  expect(overwrite).toHaveFocus();
  expect(overwrite).toHaveAttribute("aria-busy", "true");
  expect(screen.getByRole("status")).toHaveTextContent("Saving your draft…");
  expect(onBack).not.toHaveBeenCalled();
  expect(onKeepSaved).not.toHaveBeenCalled();
  expect(onOverwrite).not.toHaveBeenCalled();
});

it("confirms a successful copy inside the button and restores it after two seconds", async () => {
  vi.useFakeTimers();
  let resolveCopy: (() => void) | undefined;
  const writeText = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        resolveCopy = resolve;
      }),
  );
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  render(
    <FoodItemUnavailableView
      draft={draft}
      product={null}
      onDiscard={vi.fn()}
    />,
  );

  const copyButton = screen.getByRole("button", { name: "Copy details" });
  fireEvent.click(copyButton);
  fireEvent.click(copyButton);

  expect(writeText).toHaveBeenCalledOnce();
  expect(copyButton).toHaveAttribute("aria-disabled", "true");
  expect(copyButton).toHaveTextContent("Copy details");

  await act(async () => {
    resolveCopy?.();
    await Promise.resolve();
  });

  expect(screen.getByRole("button", { name: "Copied" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  expect(screen.queryByText("Details copied")).not.toBeInTheDocument();

  await act(async () => vi.advanceTimersByTimeAsync(1_999));
  expect(screen.getByRole("button", { name: "Copied" })).toBeVisible();

  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(screen.getByRole("button", { name: "Copy details" })).toHaveAttribute(
    "aria-disabled",
    "false",
  );
  expect(writeText).toHaveBeenCalledWith(
    expect.stringContaining("Name: Draft milk"),
  );
});

it("cleans up the copy confirmation timer when unmounted", async () => {
  vi.useFakeTimers();
  const clearTimeout = vi.spyOn(globalThis, "clearTimeout");
  vi.stubGlobal("navigator", {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
  const { unmount } = render(
    <FoodItemUnavailableView
      draft={draft}
      product={null}
      onDiscard={vi.fn()}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Copy details" }));
  await act(async () => Promise.resolve());
  expect(screen.getByRole("button", { name: "Copied" })).toBeVisible();

  unmount();

  expect(clearTimeout).toHaveBeenCalledOnce();
});

it("keeps labeled draft text selectable when clipboard access fails", async () => {
  vi.stubGlobal("navigator", {
    clipboard: { writeText: vi.fn().mockRejectedValue(new Error("blocked")) },
  });
  render(
    <FoodItemUnavailableView
      draft={draft}
      product={null}
      onDiscard={vi.fn()}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Copy details" }));

  expect(await screen.findByRole("status")).toHaveTextContent(
    "Copy failed. Select the text in the manual-copy field and copy it manually.",
  );
  expect(
    screen.getByRole<HTMLTextAreaElement>("textbox", {
      name: "Draft details for manual copying",
    }).value,
  ).toContain("Name: Draft milk");
  expect(screen.getByRole("button", { name: "Copy details" })).toHaveAttribute(
    "aria-disabled",
    "false",
  );
});
