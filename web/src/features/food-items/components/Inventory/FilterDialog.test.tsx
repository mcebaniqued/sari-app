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

  it("opens with one empty editor, applies no filters, and restores that state on Reset or final removal", () => {
    const { dialog, onApply } = setup();
    expect(dialog.getByRole("group", { name: "Filter 1" })).toBeVisible();
    expect(dialog.getByLabelText("Filter by")).toHaveValue("");
    expect(
      dialog.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Choose a field", "Amount", "Expiration date", "Date added"]);
    expect(dialog.queryByLabelText("Condition")).not.toBeInTheDocument();
    expect(
      dialog.queryByRole("button", { name: /Remove|Add another/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(dialog.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith({});
    change(dialog.getByLabelText("Filter by"), "amount");
    expect(dialog.getAllByRole("group")).toHaveLength(1);
    expect(
      dialog.queryByRole("button", { name: "Add another filter" }),
    ).not.toBeInTheDocument();
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

  it("adds only after validity, excludes duplicates, and requires an extra empty editor to be completed or removed", () => {
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
    fireEvent.click(dialog.getByRole("button", { name: "Apply" }));
    expect(onApply).not.toHaveBeenCalled();
    expect(added.getByRole("alert")).toHaveTextContent("Choose a field");
    expect(added.getByLabelText("Filter by")).toHaveFocus();
    expect(added.getByLabelText("Filter by")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    change(added.getByLabelText("Filter by"), "expiresOn");
    change(added.getByLabelText("Condition"), "blank");
    fireEvent.click(dialog.getByRole("button", { name: "Add another filter" }));
    const third = within(dialog.getByRole("group", { name: "Filter 3" }));
    change(third.getByLabelText("Filter by"), "createdAt");
    change(third.getByLabelText("Date"), "2026-10-01");
    expect(
      dialog.queryByRole("button", { name: "Add another filter" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      dialog.getByRole("button", { name: "Remove Expiration date filter" }),
    );
    expect(
      dialog
        .getAllByRole("group")
        .map((group) => group.querySelector("legend")?.textContent),
    ).toEqual(["Filter 1", "Filter 2"]);
    expect(
      within(dialog.getByRole("group", { name: "Filter 2" })).getByLabelText(
        "Filter by",
      ),
    ).toHaveFocus();
    fireEvent.click(dialog.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith({
      quantity: { filterType: "number", type: "equals", filter: 5 },
      unit: { filterType: "text", type: "equals", filter: "item" },
      createdAt: { filterType: "date", type: "equals", dateFrom: "2026-10-01" },
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
