import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import Modal from "./Modal";

function Example({ busy = false }: { busy?: boolean }) {
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
          title="Example modal"
          description="Some details"
          dismissible={!busy}
          onClose={() => {
            setOpen(false);
          }}
        >
          <input data-autofocus aria-label="Example field" />
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
});
