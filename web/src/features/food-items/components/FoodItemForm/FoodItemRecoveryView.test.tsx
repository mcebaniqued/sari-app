import type { FoodItem } from "@sari/contracts";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  FoodItemRecoveryView,
  FoodItemUnavailableView,
} from "./FoodItemRecoveryView";

afterEach(() => vi.unstubAllGlobals());

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
  const onKeepDraft = vi.fn();
  render(
    <FoodItemRecoveryView
      kind="conflict"
      draft={draft}
      saved={saved}
      product={null}
      onBack={vi.fn()}
      onUseSaved={vi.fn()}
      onKeepDraft={onKeepDraft}
    />,
  );

  const table = screen.getByRole("table");
  expect(
    within(table).getByRole("columnheader", { name: "Field" }),
  ).toBeVisible();
  expect(
    within(table).getByRole("columnheader", { name: "Your draft" }),
  ).toBeVisible();
  expect(
    within(table).getByRole("columnheader", { name: "Saved version" }),
  ).toBeVisible();
  expect(within(table).getByText("Name")).toBeVisible();
  expect(within(table).getByText("Product link")).toBeVisible();
  expect(within(table).queryByText("Quantity")).not.toBeInTheDocument();
  expect(within(table).queryByText("Unit")).not.toBeInTheDocument();
  expect(within(table).queryByText("Expiration date")).not.toBeInTheDocument();
  expect(table).toHaveTextContent(`Product ID ${draft.productId}`);
  expect(table).toHaveTextContent(`Product ID ${saved.productId ?? ""}`);

  fireEvent.click(screen.getByRole("button", { name: "Keep my draft" }));
  expect(onKeepDraft).toHaveBeenCalledOnce();
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
      onBack={vi.fn()}
      onUseSaved={vi.fn()}
      onKeepDraft={vi.fn()}
    />,
  );

  expect(
    screen.getByText(
      "No differences were found between your draft and the saved version.",
    ),
  ).toBeVisible();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Keep my draft" })).toBeVisible();
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
      onBack={vi.fn()}
      onUseSaved={vi.fn()}
      onKeepDraft={vi.fn()}
    />,
  );

  const table = screen.getByRole("table");
  expect(within(table).getByText("Quantity")).toBeVisible();
  expect(within(table).getByText("Unit")).toBeVisible();
  expect(within(table).getByText("Expiration date")).toBeVisible();
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
});
