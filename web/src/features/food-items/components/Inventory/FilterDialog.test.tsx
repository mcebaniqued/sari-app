import type { FoodItemQuery } from "@sari/contracts";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FilterDialog from "./FilterDialog";

function setup(filters: FoodItemQuery["filters"] = {}) {
  const onApply = vi.fn<(filters: FoodItemQuery["filters"]) => void>();
  render(
    <FilterDialog filters={filters} onApply={onApply} onClose={vi.fn()} />,
  );
  return {
    dialog: within(screen.getByRole("dialog", { name: "Filter items" })),
    onApply,
  };
}

function change(control: HTMLElement, value: string) {
  fireEvent.change(control, { target: { value } });
}

describe("FilterDialog", () => {
  it("focuses and describes only the invalid value control", () => {
    const { dialog, onApply } = setup();
    change(dialog.getByLabelText("Filter by"), "amount");
    change(dialog.getByLabelText("Condition"), "inRange");

    fireEvent.click(dialog.getByRole("button", { name: "Apply" }));
    const from = dialog.getByLabelText("From");
    const to = dialog.getByLabelText("To");
    const unit = dialog.getByLabelText("Unit");
    const alert = dialog.getByRole("alert");
    expect(from).toHaveFocus();
    expect(from).toHaveAttribute("aria-invalid", "true");
    expect(from).toHaveAttribute("aria-describedby", alert.id);
    expect(to).not.toHaveAttribute("aria-invalid");
    expect(to).not.toHaveAttribute("aria-describedby");
    expect(unit).not.toHaveAttribute("aria-invalid");
    expect(unit).not.toHaveAttribute("aria-describedby");
    expect(onApply).not.toHaveBeenCalled();
  });

  it("uses consistent focus styles and red styling only for the invalid control", () => {
    const { dialog } = setup();
    const field = dialog.getByLabelText("Filter by");
    const add = dialog.getByRole("button", { name: "Add another filter" });

    for (const control of [
      field,
      add,
      dialog.getByRole("button", { name: "Reset" }),
      dialog.getByRole("button", { name: "Cancel" }),
      dialog.getByRole("button", { name: "Apply" }),
    ]) {
      expect(control).toHaveClass(
        "rounded-control",
        "focus-visible:outline-2",
        "focus-visible:outline-offset-2",
        "focus-visible:outline-brand",
      );
    }

    change(field, "amount");
    const condition = dialog.getByLabelText("Condition");
    const quantity = dialog.getByLabelText("Quantity");
    const unit = dialog.getByLabelText("Unit");
    const remove = dialog.getByRole("button", {
      name: "Remove Amount filter",
    });
    for (const control of [condition, unit, remove]) {
      expect(control).toHaveClass(
        "rounded-control",
        "focus-visible:outline-2",
        "focus-visible:outline-offset-2",
        "focus-visible:outline-brand",
      );
    }

    fireEvent.click(dialog.getByRole("button", { name: "Apply" }));
    expect(quantity).toHaveClass(
      "border-danger",
      "focus-visible:outline-danger",
    );
    expect(quantity).not.toHaveClass(
      "border-border-control",
      "focus-visible:outline-brand",
    );
    expect(condition).toHaveClass(
      "border-border-control",
      "focus-visible:outline-brand",
    );
  });

  it("opens with one empty editor, applies no filters, and restores that state on Reset or final removal", () => {
    const { dialog, onApply } = setup();
    expect(dialog.getByRole("group", { name: "Filter 1" })).toBeVisible();
    expect(dialog.getByLabelText("Filter by")).toHaveValue("");
    expect(
      dialog.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Choose a field", "Amount", "Expiration date", "Date added"]);
    expect(dialog.queryByLabelText("Condition")).not.toBeInTheDocument();
    expect(
      dialog.queryByRole("button", { name: /Remove/ }),
    ).not.toBeInTheDocument();
    expect(
      dialog.getByRole("button", { name: "Add another filter" }),
    ).toBeEnabled();
    fireEvent.click(dialog.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith({});
    change(dialog.getByLabelText("Filter by"), "amount");
    expect(dialog.getAllByRole("group")).toHaveLength(1);
    expect(
      dialog.getByRole("button", { name: "Add another filter" }),
    ).toBeEnabled();
    fireEvent.click(
      dialog.getByRole("button", { name: "Remove Amount filter" }),
    );
    expect(dialog.getByLabelText("Filter by")).toHaveValue("");
    expect(dialog.getByLabelText("Filter by")).toHaveFocus();
    change(dialog.getByLabelText("Filter by"), "expiresOn");
    fireEvent.click(dialog.getByRole("button", { name: "Reset" }));
    expect(dialog.getByLabelText("Filter by")).toHaveValue("");
    expect(dialog.queryByLabelText("Condition")).not.toBeInTheDocument();
  });

  it("applies an empty set when every visible filter is unused", () => {
    const { dialog, onApply } = setup();
    const add = dialog.getByRole("button", { name: "Add another filter" });
    fireEvent.click(add);
    fireEvent.click(add);

    expect(dialog.getAllByRole("group")).toHaveLength(3);
    fireEvent.click(dialog.getByRole("button", { name: "Apply" }));

    expect(onApply).toHaveBeenCalledWith({});
    expect(dialog.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("maps Amount to a comparison AND an exact unit, preserving compatible values", () => {
    const { dialog, onApply } = setup();
    change(dialog.getByLabelText("Filter by"), "amount");
    expect(
      within(dialog.getByLabelText("Condition"))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([
      "Equals",
      "Not equal",
      "Less than",
      "At most",
      "Greater than",
      "At least",
      "Between",
    ]);
    expect(dialog.getByLabelText("Condition")).toHaveValue("equals");
    expect(dialog.getByLabelText("Unit")).toHaveValue("");
    expect(
      within(dialog.getByLabelText("Unit")).getByRole("option", {
        name: "Items",
      }),
    ).toHaveValue("item");
    change(dialog.getByLabelText("Quantity"), "5");
    fireEvent.click(dialog.getByRole("button", { name: "Apply" }));
    expect(dialog.getByRole("alert")).toHaveTextContent("Choose a unit.");
    expect(dialog.getByLabelText("Unit")).toHaveFocus();
    expect(dialog.getByLabelText("Unit")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(dialog.getByLabelText("Quantity")).not.toHaveAttribute(
      "aria-invalid",
    );
    change(dialog.getByLabelText("Unit"), "item");
    change(dialog.getByLabelText("Condition"), "lessThan");
    expect(dialog.getByLabelText("Quantity")).toHaveValue(5);
    expect(dialog.getByLabelText("Unit")).toHaveValue("item");
    fireEvent.click(dialog.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenLastCalledWith({
      quantity: { filterType: "number", type: "lessThan", filter: 5 },
      unit: { filterType: "text", type: "equals", filter: "item" },
    });
    change(dialog.getByLabelText("Condition"), "inRange");
    expect(dialog.getByLabelText("From")).toHaveValue(5);
    change(dialog.getByLabelText("To"), "2");
    fireEvent.click(dialog.getByRole("button", { name: "Apply" }));
    expect(dialog.getByRole("alert")).toHaveTextContent(
      "ordered numeric range",
    );
    change(dialog.getByLabelText("From"), "-1.5");
    fireEvent.click(dialog.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenLastCalledWith({
      quantity: {
        filterType: "number",
        type: "inRange",
        filter: -1.5,
        filterTo: 2,
      },
      unit: { filterType: "text", type: "equals", filter: "item" },
    });
    change(dialog.getByLabelText("Condition"), "equals");
    fireEvent.click(dialog.getByRole("button", { name: "Apply" }));
    expect(onApply.mock.lastCall?.[0].quantity).toEqual({
      filterType: "number",
      type: "equals",
      filter: -1.5,
    });
  });

  it.each(["expiresOn", "createdAt"])(
    "uses calendar-date conditions for %s and rejects reversed ranges",
    (field) => {
      const { dialog, onApply } = setup();
      change(dialog.getByLabelText("Filter by"), field);
      const expected = [
        "On",
        "Not on",
        "Before",
        "On or before",
        "After",
        "On or after",
        "Between",
      ];
      expect(
        within(dialog.getByLabelText("Condition"))
          .getAllByRole("option")
          .map((option) => option.textContent),
      ).toEqual(
        field === "expiresOn" ? [...expected, "Has date", "No date"] : expected,
      );
      expect(dialog.getByLabelText("Condition")).toHaveValue("equals");
      change(dialog.getByLabelText("Date"), "2028-02-29");
      change(dialog.getByLabelText("Condition"), "inRange");
      expect(dialog.getByLabelText("From")).toHaveValue("2028-02-29");
      fireEvent.click(dialog.getByRole("button", { name: "Apply" }));
      expect(dialog.getByRole("alert")).toHaveTextContent("Choose a To date.");
      expect(dialog.getByLabelText("To")).toHaveFocus();
      expect(dialog.getByLabelText("To")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      expect(dialog.getByLabelText("From")).not.toHaveAttribute("aria-invalid");
      change(dialog.getByLabelText("To"), "2028-02-01");
      fireEvent.click(dialog.getByRole("button", { name: "Apply" }));
      expect(onApply).not.toHaveBeenCalled();
      expect(dialog.getByRole("alert")).toHaveTextContent("ordered date range");
      expect(dialog.getByLabelText("To")).toHaveFocus();
      change(dialog.getByLabelText("To"), "2028-03-01");
      fireEvent.click(dialog.getByRole("button", { name: "Apply" }));
      expect(onApply).toHaveBeenLastCalledWith({
        [field]: {
          filterType: "date",
          type: "inRange",
          dateFrom: "2028-02-29",
          dateTo: "2028-03-01",
        },
      });
    },
  );

  it("omits obsolete dates for Has date and No date", () => {
    const { dialog, onApply } = setup({
      expiresOn: {
        filterType: "date",
        type: "inRange",
        dateFrom: "2028-02-29",
        dateTo: "2028-03-01",
      },
    });
    for (const condition of ["blank", "notBlank"]) {
      change(dialog.getByLabelText("Condition"), condition);
      expect(
        dialog.queryByLabelText(/Date|From|To/, { selector: "input" }),
      ).not.toBeInTheDocument();
      fireEvent.click(dialog.getByRole("button", { name: "Apply" }));
      expect(onApply).toHaveBeenLastCalledWith({
        expiresOn: { filterType: "date", type: condition },
      });
    }
    change(dialog.getByLabelText("Condition"), "equals");
    expect(dialog.getByLabelText("Date")).toHaveValue("");
  });

  it("adds filters without discarding incomplete drafts and hides the action at capacity", () => {
    const { dialog, onApply } = setup({
      quantity: { filterType: "number", type: "equals", filter: 5 },
      unit: { filterType: "text", type: "equals", filter: "item" },
    });
    expect(dialog.getAllByRole("group")).toHaveLength(1);
    fireEvent.click(dialog.getByRole("button", { name: "Add another filter" }));
    const added = within(dialog.getByRole("group", { name: "Filter 2" }));
    expect(added.getByLabelText("Filter by")).toHaveFocus();
    expect(
      within(added.getByLabelText("Filter by")).queryByRole("option", {
        name: "Amount",
      }),
    ).not.toBeInTheDocument();
    change(added.getByLabelText("Filter by"), "expiresOn");
    change(added.getByLabelText("Date"), "2026-09-30");
    fireEvent.click(dialog.getByRole("button", { name: "Add another filter" }));
    expect(added.getByLabelText("Date")).toHaveValue("2026-09-30");
    const third = within(dialog.getByRole("group", { name: "Filter 3" }));
    expect(third.getByLabelText("Filter by")).toHaveFocus();
    expect(third.getByLabelText("Filter by")).toHaveValue("");
    expect(
      within(third.getByLabelText("Filter by"))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Choose a field", "Date added"]);
    expect(
      dialog.queryByRole("button", { name: "Add another filter" }),
    ).not.toBeInTheDocument();
    expect(
      dialog.queryByText("All available filters have been added."),
    ).not.toBeInTheDocument();
    change(third.getByLabelText("Filter by"), "createdAt");
    expect(
      dialog.queryByRole("button", { name: "Add another filter" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      dialog.getByRole("button", { name: "Remove Expiration date filter" }),
    );
    expect(
      dialog.getByRole("button", { name: "Add another filter" }),
    ).toBeVisible();
    expect(
      within(dialog.getByRole("group", { name: "Filter 2" })).getByLabelText(
        "Filter by",
      ),
    ).toHaveValue("createdAt");
    expect(
      within(dialog.getByRole("group", { name: "Filter 2" })).getByLabelText(
        "Date",
      ),
    ).toHaveValue("");
    expect(
      within(
        dialog.getByRole("group", { name: "Filter 2" }),
      ).getByLabelText("Filter by"),
    ).toHaveFocus();
    expect(
      dialog.getAllByRole("group").map((group) =>
        group.querySelector("legend")?.textContent,
      ),
    ).toEqual(["Filter 1", "Filter 2"]);
    fireEvent.click(dialog.getByRole("button", { name: "Apply" }));
    expect(onApply).not.toHaveBeenCalled();
    expect(
      within(dialog.getByRole("group", { name: "Filter 2" })).getByLabelText(
        "Date",
      ),
    ).toHaveFocus();
  });

  it("keeps Add another filter available for an incomplete editor while capacity remains", () => {
    const { dialog } = setup();
    const first = within(dialog.getByRole("group", { name: "Filter 1" }));
    change(first.getByLabelText("Filter by"), "amount");

    expect(
      dialog.getByRole("button", { name: "Add another filter" }),
    ).toBeVisible();
    fireEvent.click(
      dialog.getByRole("button", { name: "Add another filter" }),
    );
    expect(
      within(dialog.getByRole("group", { name: "Filter 2" })).getByLabelText(
        "Filter by",
      ),
    ).toHaveValue("");
    expect(first.getByLabelText("Filter by")).toHaveValue("amount");
  });

  it("validates only after focus leaves a started filter and clears the error when corrected", () => {
    const { dialog } = setup();
    const group = dialog.getByRole("group", { name: "Filter 1" });
    const field = within(group).getByLabelText("Filter by");
    change(field, "amount");
    const condition = within(group).getByLabelText("Condition");

    fireEvent.blur(field, { relatedTarget: condition });
    expect(within(group).queryByRole("alert")).not.toBeInTheDocument();

    const add = dialog.getByRole("button", { name: "Add another filter" });
    fireEvent.blur(condition, { relatedTarget: add });
    expect(within(group).getByRole("alert")).toHaveTextContent(
      "Enter a quantity.",
    );
    expect(within(group).getByLabelText("Quantity")).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    change(within(group).getByLabelText("Quantity"), "3");
    expect(within(group).getByRole("alert")).toHaveTextContent(
      "Choose a unit.",
    );
    change(within(group).getByLabelText("Unit"), "item");
    expect(within(group).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("tracks incomplete filters independently and ignores untouched empty filters on Apply", () => {
    const { dialog, onApply } = setup();
    const first = within(dialog.getByRole("group", { name: "Filter 1" }));
    change(first.getByLabelText("Filter by"), "amount");
    const add = dialog.getByRole("button", { name: "Add another filter" });
    expect(add).toBeEnabled();
    fireEvent.blur(first.getByLabelText("Condition"), { relatedTarget: add });
    fireEvent.click(add);

    const second = within(dialog.getByRole("group", { name: "Filter 2" }));
    expect(second.getByLabelText("Filter by")).toHaveFocus();
    expect(second.queryByRole("alert")).not.toBeInTheDocument();
    change(second.getByLabelText("Filter by"), "expiresOn");
    fireEvent.blur(second.getByLabelText("Condition"), { relatedTarget: add });
    expect(first.getByRole("alert")).toHaveTextContent("Enter a quantity.");
    expect(second.getByRole("alert")).toHaveTextContent("Choose a date.");

    change(first.getByLabelText("Quantity"), "2");
    change(first.getByLabelText("Unit"), "item");
    expect(first.queryByRole("alert")).not.toBeInTheDocument();
    expect(second.getByRole("alert")).toHaveTextContent("Choose a date.");

    fireEvent.click(dialog.getByRole("button", { name: "Apply" }));
    expect(onApply).not.toHaveBeenCalled();
    expect(second.getByLabelText("Date")).toHaveFocus();

    change(second.getByLabelText("Date"), "2026-10-01");
    fireEvent.click(add);
    fireEvent.click(dialog.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith({
      quantity: { filterType: "number", type: "equals", filter: 2 },
      unit: { filterType: "text", type: "equals", filter: "item" },
      expiresOn: {
        filterType: "date",
        type: "equals",
        dateFrom: "2026-10-01",
      },
    });
  });

  it("preserves unsupported existing predicates and keeps them individually removable", () => {
    const original: FoodItemQuery["filters"] = {
      name: { filterType: "text", type: "startsWith", filter: "Rice" },
      quantity: { filterType: "number", type: "greaterThan", filter: 3 },
      unit: { filterType: "text", type: "contains", filter: "g" },
      createdAt: { filterType: "date", type: "notBlank" },
    };
    const { dialog, onApply } = setup(original);
    expect(dialog.getAllByText(/cannot be edited/)).toHaveLength(4);
    fireEvent.click(dialog.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenLastCalledWith(original);
    fireEvent.click(dialog.getByRole("button", { name: "Add another filter" }));
    const added = within(dialog.getByRole("group", { name: "Filter 5" }));
    expect(
      within(added.getByLabelText("Filter by"))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Choose a field", "Expiration date"]);
    change(added.getByLabelText("Filter by"), "expiresOn");
    change(added.getByLabelText("Condition"), "blank");
    fireEvent.click(
      dialog.getByRole("button", { name: "Remove Quantity filter" }),
    );
    fireEvent.click(dialog.getByRole("button", { name: "Apply" }));
    const { quantity: removed, ...remaining } = original;
    expect(removed).toBeDefined();
    expect(onApply).toHaveBeenLastCalledWith({
      ...remaining,
      expiresOn: { filterType: "date", type: "blank" },
    });
  });
});
