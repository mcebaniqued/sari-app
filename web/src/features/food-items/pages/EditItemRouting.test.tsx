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

let constrained = false;
const viewportListeners = new Set<(event: MediaQueryListEvent) => void>();

function setConstrained(next: boolean) {
  constrained = next;
  const event = { matches: next } as MediaQueryListEvent;
  viewportListeners.forEach((listener) => {
    listener(event);
  });
}

function renderApp(entry: InitialEntry) {
  const router = createMemoryRouter([{ path: "*", element: <App /> }], {
    initialEntries: [entry],
  });

  return { router, ...render(<RouterProvider router={router} />) };
}

function foodApi() {
  let current = item;
  const patches: unknown[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      if (url.startsWith("/api/v1/food-items?")) {
        return Promise.resolve(
          Response.json({ items: [current], total: 1, start: 0, limit: 20 }),
        );
      }
      if (
        url === `/api/v1/food-items/${item.id}` &&
        (!init?.method || init.method === "GET")
      ) {
        return Promise.resolve(Response.json(current));
      }
      if (url === `/api/v1/food-items/${item.id}` && init?.method === "PATCH") {
        const body = JSON.parse(
          typeof init.body === "string" ? init.body : "",
        ) as {
          changes: Partial<FoodItem>;
          expectedRevision: number;
        };
        patches.push(body);
        current = {
          ...current,
          ...body.changes,
          revision: current.revision + 1,
          updatedAt: "2026-11-01T20:00:00Z",
        };

        return Promise.resolve(Response.json(current));
      }

      throw new Error(`Unexpected request: ${url}`);
    }),
  );

  return { patches };
}

beforeEach(() => {
  constrained = false;
  viewportListeners.clear();
  vi.mocked(getSession).mockResolvedValue({
    user: {
      id: "edit-routing-user",
      firstName: "Alex",
      lastName: "Tester",
      email: "alex@example.com",
    },
    session: { expiresAt: new Date("2099-01-01") },
  });
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches:
        query.includes("max-width: 40rem") ||
        query.includes("max-height: 32rem")
          ? constrained
          : false,
      addEventListener: (
        _type: string,
        listener: (event: MediaQueryListEvent) => void,
      ) => {
        viewportListeners.add(listener);
      },
      removeEventListener: (
        _type: string,
        listener: (event: MediaQueryListEvent) => void,
      ) => {
        viewportListeners.delete(listener);
      },
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
  viewportListeners.clear();
  vi.unstubAllGlobals();
});

describe("route-backed Pantry Edit", () => {
  it("uses the desktop modal and saves to updated contextual Details", async () => {
    const api = foodApi();
    const { router } = renderApp("/pantry");
    fireEvent.click(await screen.findByRole("button", { name: "Edit Milk" }));

    const name = await screen.findByLabelText(/^Food name/);
    const dialog = name.closest("dialog");

    if (!dialog) {
      throw new Error("Expected the desktop editor to use a dialog.");
    }
    expect(router.state.location.pathname).toBe(
      `/pantry/items/${item.id}/edit`,
    );
    fireEvent.change(name, { target: { value: "Fresh milk" } });
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Save changes",
      }),
    );

    await screen.findByRole("button", { name: "Saving…" });
    await waitFor(() => {
      expect(api.patches).toHaveLength(1);
    });
    await screen.findByRole("button", { name: "Save changes" });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(await screen.findByText("Fresh milk updated.")).toBeVisible();
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/pantry/items/${item.id}`);
    });
    expect(
      await screen.findByRole("dialog", { name: "Fresh milk" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "My Pantry" })).toBeVisible();
    expect(api.patches[0]).toMatchObject({
      expectedRevision: item.revision,
      changes: { name: "Fresh milk" },
    });
  });

  it("uses a page on constrained viewports and preserves the draft across transitions", async () => {
    setConstrained(true);
    foodApi();
    renderApp("/pantry");
    fireEvent.click(await screen.findByRole("button", { name: "Edit Milk" }));

    const name = await screen.findByLabelText(/^Food name/);
    expect(screen.getByRole("heading", { name: "Edit item" })).toHaveFocus();
    expect(screen.queryByRole("dialog", { name: "Edit item" })).toBeNull();
    expect(
      document.querySelector<HTMLElement>("[data-route-background]")?.inert,
    ).toBe(true);
    fireEvent.change(name, { target: { value: "Phone draft" } });
    name.focus();

    setConstrained(false);
    const dialog = await screen.findByRole("dialog", { name: "Edit item" });
    const desktopName = within(dialog).getByLabelText(/^Food name/);
    expect(desktopName).toHaveValue("Phone draft");
    await waitFor(() => {
      expect(desktopName).toHaveFocus();
    });

    setConstrained(true);
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Edit item" })).toBeNull();
    });
    expect(screen.getByLabelText(/^Food name/)).toHaveValue("Phone draft");
    await waitFor(() => {
      expect(screen.getByLabelText(/^Food name/)).toHaveFocus();
    });
  });

  it("treats mobile Escape as guarded Cancel", async () => {
    setConstrained(true);
    foodApi();
    const { router } = renderApp("/pantry");
    fireEvent.click(await screen.findByRole("button", { name: "Edit Milk" }));
    const name = await screen.findByLabelText(/^Food name/);
    fireEvent.change(name, { target: { value: "Escape draft" } });
    name.focus();
    fireEvent.keyDown(name, { key: "Escape" });

    const confirmation = await screen.findByRole("dialog", {
      name: "Discard changes?",
    });
    expect(
      within(confirmation).getByRole("button", { name: "Continue editing" }),
    ).toHaveFocus();
    fireEvent.click(
      within(confirmation).getByRole("button", { name: "Continue editing" }),
    );
    expect(screen.getByLabelText(/^Food name/)).toHaveValue("Escape draft");
    expect(screen.getByLabelText(/^Food name/)).toHaveFocus();

    fireEvent.keyDown(screen.getByLabelText(/^Food name/), { key: "Escape" });
    fireEvent.click(
      within(
        await screen.findByRole("dialog", { name: "Discard changes?" }),
      ).getByRole("button", { name: "Discard changes" }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/pantry");
    });
  });

  it("returns a Details-origin save to updated Details and protects Forward", async () => {
    foodApi();
    const { router } = renderApp("/pantry");
    fireEvent.click(await screen.findByRole("button", { name: "Milk" }));
    const details = await screen.findByRole("dialog", { name: "Milk" });
    fireEvent.click(
      await within(details).findByRole("button", { name: "Edit" }),
    );
    const name = await screen.findByLabelText(/^Food name/);
    fireEvent.change(name, { target: { value: "Forward-safe milk" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByRole("dialog", { name: "Forward-safe milk" }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe(`/pantry/items/${item.id}`);

    await router.navigate(1);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/pantry/items/${item.id}`);
      expect(
        screen.getByRole("dialog", { name: "Forward-safe milk" }),
      ).toBeVisible();
    });
    expect(screen.queryByRole("dialog", { name: "Edit item" })).toBeNull();
  });

  it("returns from Details and protects a dirty Back navigation", async () => {
    foodApi();
    const { router } = renderApp("/pantry");
    fireEvent.click(await screen.findByRole("button", { name: "Milk" }));
    const details = await screen.findByRole("dialog", { name: "Milk" });
    fireEvent.click(
      await within(details).findByRole("button", { name: "Edit" }),
    );
    const name = await screen.findByLabelText(/^Food name/);
    fireEvent.change(name, { target: { value: "Draft milk" } });

    await router.navigate(-1);
    const confirmation = await screen.findByRole("dialog", {
      name: "Discard changes?",
    });
    fireEvent.click(
      within(confirmation).getByRole("button", { name: "Continue editing" }),
    );
    expect(screen.getByLabelText(/^Food name/)).toHaveValue("Draft milk");

    await router.navigate(-1);
    fireEvent.click(
      within(
        await screen.findByRole("dialog", { name: "Discard changes?" }),
      ).getByRole("button", { name: "Discard changes" }),
    );
    expect(await screen.findByRole("dialog", { name: "Milk" })).toBeVisible();
    expect(router.state.location.pathname).toBe(`/pantry/items/${item.id}`);
  });

  it("loads direct Edit independently and uses Details as the Cancel fallback", async () => {
    foodApi();
    const { router, unmount } = renderApp(`/pantry/items/${item.id}/edit`);
    expect(await screen.findByLabelText(/^Food name/)).toHaveValue("Milk");
    expect(screen.getByRole("heading", { name: "Edit item" })).toBeVisible();
    expect(screen.queryByRole("dialog", { name: "Edit item" })).toBeNull();
    unmount();

    render(<RouterProvider router={router} />);
    expect(await screen.findByLabelText(/^Food name/)).toHaveValue("Milk");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("heading", { name: "Milk" })).toBeVisible();
    expect(router.state.location.pathname).toBe(`/pantry/items/${item.id}`);
  });

  it("shows safe invalid and unavailable direct-route states", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("ffffffffffffffffffffffff")) {
          return Promise.resolve(
            Response.json(
              { error: { code: "FOOD_ITEM_NOT_FOUND", message: "Not found." } },
              { status: 404 },
            ),
          );
        }

        throw new Error(`Unexpected request: ${url}`);
      }),
    );
    const invalid = renderApp("/pantry/items/not-an-id/edit");
    expect(
      await screen.findByRole("heading", { name: "Invalid item link" }),
    ).toBeVisible();
    invalid.unmount();

    renderApp("/pantry/items/ffffffffffffffffffffffff/edit");
    expect(
      await screen.findByRole("heading", { name: "Item unavailable" }),
    ).toBeVisible();
    expect(screen.getByText(/deleted or is not available/i)).toBeVisible();
  });
});
