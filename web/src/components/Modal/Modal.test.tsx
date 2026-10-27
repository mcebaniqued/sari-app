import { fireEvent, render, screen } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import Modal, { type ModalDismissalPolicy } from "./Modal";

interface ExampleProps {
  autofocus?: boolean;
  autofocusContent?: ReactNode;
  busy?: boolean;
  dismissal?: ModalDismissalPolicy;
  headerActions?: ReactNode;
  presentation?: "centered" | "responsive";
  scroll?: "dialog" | "contained";
  title?: string;
}

function Example({
  autofocus = true,
  autofocusContent,
  busy = false,
  dismissal,
  headerActions,
  presentation,
  scroll,
  title = "Example modal",
}: ExampleProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
        }}
      >
        Open example
      </button>
      {open && (
        <Modal
          title={title}
          description="Some details"
          {...(dismissal ? { dismissal } : { dismissible: !busy })}
          {...(headerActions ? { headerActions } : {})}
          {...(presentation ? { presentation } : {})}
          {...(scroll ? { scroll } : {})}
          onClose={() => {
            setOpen(false);
          }}
        >
          <div data-testid="modal-content">
            {autofocusContent ?? (
              <input
                data-autofocus={autofocus || undefined}
                aria-label="Example field"
              />
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

describe("reusable modal", () => {
  it("labels the dialog, focuses its field, locks scroll, and restores focus on close", () => {
    render(<Example />);
    const opener = screen.getByRole("button", { name: "Open example" });
    opener.focus();
    fireEvent.click(opener);
    expect(
      screen.getByRole("dialog", { name: "Example modal" }),
    ).toHaveAccessibleDescription("Some details");
    expect(screen.getByLabelText("Example field")).toHaveFocus();
    expect(document.body).toHaveClass("overflow-hidden");
    fireEvent.click(screen.getByRole("button", { name: "Close modal" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body).not.toHaveClass("overflow-hidden");
    expect(opener).toHaveFocus();
  });

  it("handles Escape but prevents dismissal while a mutation is pending", () => {
    const { rerender } = render(<Example busy />);
    fireEvent.click(screen.getByRole("button", { name: "Open example" }));
    const dialog = screen.getByRole("dialog");
    fireEvent(
      dialog,
      new Event("cancel", { bubbles: false, cancelable: true }),
    );
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByRole("button", { name: "Close modal" })).toBeDisabled();
    rerender(<Example />);
    fireEvent(
      dialog,
      new Event("cancel", { bubbles: false, cancelable: true }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders header actions after a long title without displacing Close", () => {
    const title =
      "A very long pantry item heading that needs to wrap without obscuring modal actions";
    render(
      <Example
        title={title}
        headerActions={<button type="button">More actions</button>}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open example" }));

    const heading = screen.getByRole("heading", { name: title });
    const action = screen.getByRole("button", { name: "More actions" });
    const close = screen.getByRole("button", { name: "Close modal" });
    expect(screen.getByRole("dialog", { name: title })).toBeVisible();
    expect(heading).toHaveClass("wrap-anywhere");
    expect(heading.compareDocumentPosition(action)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(action.compareDocumentPosition(close)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("focuses the heading when no consumer autofocus target is provided", () => {
    render(<Example autofocus={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Open example" }));

    expect(
      screen.getByRole("heading", { name: "Example modal" }),
    ).toHaveFocus();
  });

  it("keeps a consumer autofocus target ahead of the heading fallback", () => {
    render(<Example />);
    fireEvent.click(screen.getByRole("button", { name: "Open example" }));

    expect(screen.getByLabelText("Example field")).toHaveFocus();
  });

  it("falls back to the heading when the marked target is hidden", () => {
    render(
      <Example
        autofocusContent={
          <input hidden data-autofocus aria-label="Hidden target" />
        }
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open example" }));

    expect(
      screen.getByRole("heading", { name: "Example modal" }),
    ).toHaveFocus();
  });

  it("falls back to the heading when the marked target is disabled", () => {
    render(
      <Example
        autofocusContent={
          <button type="button" data-autofocus disabled>
            Disabled target
          </button>
        }
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open example" }));

    expect(
      screen.getByRole("heading", { name: "Example modal" }),
    ).toHaveFocus();
  });

  it("skips a hidden marked target for the next usable candidate", () => {
    render(
      <Example
        autofocusContent={
          <>
            <input hidden data-autofocus aria-label="Hidden target" />
            <button type="button" data-autofocus>
              Visible target
            </button>
          </>
        }
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open example" }));

    expect(
      screen.getByRole("button", { name: "Visible target" }),
    ).toHaveFocus();
  });

  it("configures backdrop, Escape, and explicit Close independently", () => {
    const { rerender } = render(
      <Example
        dismissal={{ backdrop: false, closeButton: true, escape: true }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open example" }));
    let dialog = screen.getByRole("dialog");
    fireEvent.click(dialog, { clientX: -1, clientY: -1 });
    expect(dialog).toBeVisible();
    expect(screen.getByRole("button", { name: "Close modal" })).toBeEnabled();
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    rerender(
      <Example
        dismissal={{ backdrop: true, closeButton: false, escape: false }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open example" }));
    dialog = screen.getByRole("dialog");
    expect(screen.getByRole("button", { name: "Close modal" })).toBeDisabled();
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(dialog).toBeVisible();
    fireEvent.click(dialog, { clientX: -1, clientY: -1 });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("blocks every dismissal method under an explicit busy policy", () => {
    render(
      <Example
        dismissal={{ backdrop: false, closeButton: false, escape: false }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open example" }));
    const dialog = screen.getByRole("dialog");

    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    fireEvent.click(dialog, { clientX: -1, clientY: -1 });
    fireEvent.click(screen.getByRole("button", { name: "Close modal" }));
    expect(dialog).toBeVisible();
  });

  it("restores through the fallback when the invoking control disappears", () => {
    const restoreFallback = vi.fn();

    function DisappearingInvoker() {
      const [open, setOpen] = useState(false);
      const [showInvoker, setShowInvoker] = useState(true);

      return (
        <>
          {showInvoker && (
            <button
              onClick={() => {
                setOpen(true);
              }}
            >
              Open temporary
            </button>
          )}
          {open && (
            <Modal
              title="Temporary modal"
              onClose={() => {
                setOpen(false);
              }}
              onRestoreFocusFallback={restoreFallback}
            >
              <button
                data-autofocus
                onClick={() => {
                  setShowInvoker(false);
                }}
              >
                Remove invoker
              </button>
            </Modal>
          )}
        </>
      );
    }

    render(<DisappearingInvoker />);
    const invoker = screen.getByRole("button", { name: "Open temporary" });
    invoker.focus();
    fireEvent.click(invoker);
    fireEvent.click(screen.getByRole("button", { name: "Remove invoker" }));
    fireEvent.click(screen.getByRole("button", { name: "Close modal" }));

    expect(restoreFallback).toHaveBeenCalledOnce();
  });

  it("opts into contained scrolling and responsive presentation", () => {
    render(<Example scroll="contained" presentation="responsive" />);
    fireEvent.click(screen.getByRole("button", { name: "Open example" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-scroll", "contained");
    expect(dialog).toHaveAttribute("data-presentation", "responsive");
    expect(dialog).toHaveClass("modal-contained", "modal-responsive");
    expect(screen.getByTestId("modal-content").parentElement).toHaveAttribute(
      "data-modal-scroll-region",
    );
    expect(
      screen.getByRole("heading", { name: "Example modal" }).parentElement
        ?.parentElement,
    ).toHaveClass("sticky");
  });

  it("retains legacy centered whole-dialog scrolling by default", () => {
    render(<Example />);
    fireEvent.click(screen.getByRole("button", { name: "Open example" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-scroll", "dialog");
    expect(dialog).toHaveAttribute("data-presentation", "centered");
    expect(dialog).not.toHaveClass("modal-contained", "modal-responsive");
    expect(dialog.querySelector("[data-modal-scroll-region]")).toBeNull();
  });
});
