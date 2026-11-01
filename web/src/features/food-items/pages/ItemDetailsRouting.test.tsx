import type { FoodItem } from "@sari/contracts";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  createMemoryRouter,
  type InitialEntry,
  RouterProvider,
} from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { getSession } from "@/features/auth/api/authApi";

vi.mock("@/features/auth/api/authApi", () => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
}));

const item: FoodItem = {
  id: "012345678901234567890123",
  name: "Milk",
  quantity: 1,
  unit: "l",
  expiresOn: "2026-11-04",
  revision: 1,
  createdAt: "2026-10-19T17:45:00Z",
  updatedAt: "2026-10-20T18:30:00Z",
};

function renderApp(entry: InitialEntry) {
  const router = createMemoryRouter([{ path: "*", element: <App /> }], {
    initialEntries: [entry],
  });

  return { router, ...render(<RouterProvider router={router} />) };
}

beforeEach(() => {
  vi.mocked(getSession).mockResolvedValue({
    user: {
      id: "routing-user",
      firstName: "Alex",
      lastName: "Tester",
      email: "alex@example.com",
    },
    session: { expiresAt: new Date("2099-01-01") },
  });
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {
        return undefined;
      }
      disconnect() {
        return undefined;
      }
    },
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {
        return undefined;
      }
      disconnect() {
        return undefined;
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("route-backed Item Details", () => {
  it("keeps Pantry mounted through contextual Back and Forward navigation", async () => {
    let listRequests = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.startsWith("/api/v1/food-items?")) {
          listRequests++;
          return Promise.resolve(
            Response.json({ items: [item], total: 1, start: 0, limit: 20 }),
          );
        }
        if (url === `/api/v1/food-items/${item.id}`) {
          return Promise.resolve(Response.json({ ...item, revision: 2 }));
        }

        throw new Error(`Unexpected request: ${url}`);
      }),
    );
    const { router } = renderApp("/pantry");
    const table = await screen.findByRole("table", { name: "Food inventory" });
    const opener = await within(table).findByRole("button", {
      name: item.name,
    });
    const selection = within(table).getByRole("checkbox", {
      name: `Select ${item.name}`,
    });
    const scroll = screen.getByTestId("desktop-inventory-scroll");
    fireEvent.click(selection);
    scroll.scrollTop = 137;
    opener.focus();
    fireEvent.click(opener);

    expect(router.state.location.pathname).toBe(`/pantry/items/${item.id}`);
    expect(
      await screen.findByRole("dialog", { name: item.name }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "My Pantry" })).toBeVisible();
    expect(listRequests).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "Close modal" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/pantry");
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(selection).toBeChecked();
    expect(scroll.scrollTop).toBe(137);
    expect(opener).toHaveFocus();

    await router.navigate(1);
    expect(
      await screen.findByRole("dialog", { name: item.name }),
    ).toBeVisible();
    expect(listRequests).toBe(1);
    await router.navigate(-1);
  });

  it("keeps mobile selection and action controls independent from details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.startsWith("/api/v1/food-items?")) {
          return Promise.resolve(
            Response.json({ items: [item], total: 1, start: 0, limit: 20 }),
          );
        }

        throw new Error(`Unexpected request: ${url}`);
      }),
    );
    const { router } = renderApp("/pantry");
    const list = await screen.findByRole("list", { name: "Food inventory" });
    await within(list).findByRole("button", {
      name: `View details for ${item.name}`,
    });
    const action = within(list).getByRole("button", {
      name: `Actions for ${item.name}`,
    });

    fireEvent.click(action);
    expect(router.state.location.pathname).toBe("/pantry");
    expect(
      within(list).getByRole("button", { name: `Edit ${item.name}` }),
    ).toBeVisible();
    fireEvent.click(action);
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(
      within(list).getByRole("button", {
        name: `Toggle selection for ${item.name}`,
      }),
    );

    expect(router.state.location.pathname).toBe("/pantry");
    expect(
      within(list).getByRole("checkbox", { name: `Select ${item.name}` }),
    ).toBeChecked();
  });

  it("renders direct and refreshed history entries as standalone details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === `/api/v1/food-items/${item.id}`) {
          return Promise.resolve(Response.json(item));
        }

        throw new Error(`Unexpected request: ${url}`);
      }),
    );
    renderApp({
      pathname: `/pantry/items/${item.id}`,
      state: {
        pantryContextId: "persisted-but-inactive",
        pantryLocation: { pathname: "/pantry" },
        seedItem: item,
      },
    });

    const heading = await screen.findByRole("heading", { name: item.name });
    expect(heading).toBeVisible();
    expect(heading).toHaveFocus();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "My Pantry" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to pantry" }),
    ).toHaveAttribute("href", "/pantry");
  });

  it("shows invalid and unavailable routes without disclosing ownership", async () => {
    const fetch = vi.fn((url: string) => {
      if (url.endsWith(`/${item.id}`)) {
        return Promise.resolve(
          Response.json(
            { error: { code: "FOOD_ITEM_NOT_FOUND", message: "Not found." } },
            { status: 404 },
          ),
        );
      }

      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetch);
    const invalid = renderApp("/pantry/items/not-an-id");
    expect(await screen.findByText("This item link is invalid.")).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
    invalid.unmount();

    renderApp(`/pantry/items/${item.id}`);
    expect(
      await screen.findByRole("heading", { name: "Item unavailable" }),
    ).toBeVisible();
    expect(screen.getByText(/deleted or is not available/i)).toBeVisible();
  });
});
