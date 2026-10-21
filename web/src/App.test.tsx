import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSession } from "@/features/auth/api/authApi";

import App from "./App";

vi.mock("@/features/auth/api/authApi", () => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
}));
const user = {
  id: "routing-user",
  firstName: "Alex",
  lastName: "Tester",
  email: "alex@example.com",
};
beforeEach(() => {
  vi.mocked(getSession).mockResolvedValue({
    user,
    session: { expiresAt: new Date("2099-01-01") },
  });
});

describe("application routing", () => {
  it("renders a recovery link for an unknown route", async () => {
    render(
      <MemoryRouter initialEntries={["/missing"]}>
        <App />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Page not found" }),
      ).toHaveFocus(),
    );
    expect(document.title).toBe("Page not found | Sari");
    expect(
      screen.getByRole("link", { name: "Back to pantry" }),
    ).toHaveAttribute("href", "/pantry");
  });
  it("renders an access denied page", async () => {
    render(
      <MemoryRouter initialEntries={["/access-denied"]}>
        <App />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole("heading", { name: "Access denied" }),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Access denied" }),
      ).toHaveFocus(),
    );
    expect(document.title).toBe("Access denied | Sari");
    expect(
      screen.getByRole("link", { name: "Back to pantry" }),
    ).toHaveAttribute("href", "/pantry");
  });

  it.each(["/", "/pantry", "/missing", "/access-denied"])(
    "redirects signed-out visitors from %s to login",
    async (path) => {
      vi.mocked(getSession).mockResolvedValue(null);
      render(
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>,
      );
      expect(
        await screen.findByRole("heading", { name: "Log in" }),
      ).toBeVisible();
      expect(
        screen.queryByRole("heading", { name: "My Pantry" }),
      ).not.toBeInTheDocument();
    },
  );

  it("keeps registration public with exactly the requested fields", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    render(
      <MemoryRouter initialEntries={["/register"]}>
        <App />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole("heading", { name: "Create an account" }),
    ).toBeVisible();

    for (const name of ["First name", "Last name", "Email", "Password"]) {
      expect(screen.getByLabelText(name, { exact: true })).toBeRequired();
    }
  });

  it("does not show protected content while the session is loading", () => {
    vi.mocked(getSession).mockReturnValue(new Promise(() => undefined));
    render(
      <MemoryRouter initialEntries={["/pantry"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Checking your session",
    );
    expect(
      screen.queryByRole("heading", { name: "My Pantry" }),
    ).not.toBeInTheDocument();
  });
});
