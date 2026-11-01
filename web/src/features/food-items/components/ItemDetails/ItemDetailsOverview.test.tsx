import type { FoodItem } from "@sari/contracts";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ItemDetailsOverview from "./ItemDetailsOverview";

const item: FoodItem = {
  id: "012345678901234567890123",
  name: "Milk",
  quantity: 1,
  unit: "item",
  expiresOn: "2026-11-04",
  revision: 2,
  createdAt: "2026-10-19T17:45:00Z",
  updatedAt: "2026-10-20T18:30:00Z",
};

describe("Item Details Overview", () => {
  it("shows saved values in order with secondary timestamps", () => {
    render(<ItemDetailsOverview item={item} />);

    expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual(
      ["Quantity", "Recorded date", "Added", "Updated"],
    );
    expect(screen.getByText("Nov 04, 2026")).toHaveAttribute(
      "datetime",
      item.expiresOn,
    );
    expect(screen.getByText("1 item")).toBeVisible();
    expect(screen.getByText(/Oct 19, 2026/)).toHaveAttribute(
      "datetime",
      item.createdAt,
    );
    expect(screen.getByText(/Oct 20, 2026/)).toHaveAttribute(
      "datetime",
      item.updatedAt,
    );
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByText("1 item").closest("dd")).toHaveClass("font-medium");
    expect(screen.getByText(/Oct 19, 2026/).closest("dd")).toHaveClass(
      "text-content-muted",
    );
    expect(
      screen.queryByRole("button", { name: /add date/i }),
    ).not.toBeInTheDocument();
  });

  it("shows a read-only missing-date state", () => {
    render(
      <ItemDetailsOverview item={{ ...item, expiresOn: null, quantity: 2 }} />,
    );

    expect(screen.getByText("No date")).toBeVisible();
    expect(screen.getByText("2 items")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
