import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("application routing", () => {
  it("renders a recovery link for an unknown route", () => {
    render(
      <MemoryRouter initialEntries={["/missing"]}>
        <App />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to Sari" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
