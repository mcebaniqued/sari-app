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
    expect(
      screen.getByRole("heading", { name: "Page not found" }),
    ).toHaveFocus();
    expect(document.title).toBe("Page not found | Sari");
    expect(
      screen.getByRole("link", { name: "Back to pantry" }),
    ).toHaveAttribute("href", "/pantry");
  });
  it("renders an access denied page", () => {
    render(
      <MemoryRouter initialEntries={["/access-denied"]}>
        <App />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { name: "Access denied" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Access denied" }),
    ).toHaveFocus();
    expect(document.title).toBe("Access denied | Sari");
    expect(
      screen.getByRole("link", { name: "Back to pantry" }),
    ).toHaveAttribute("href", "/pantry");
  });
});
