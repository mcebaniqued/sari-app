import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SearchBar from "./SearchBar";

afterEach(() => {
  vi.useRealTimers();
});
describe("debounced search", () => {
  it("emits only the settled, trimmed value and supports clearing", () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    render(<SearchBar label="Search food items" onSearch={onSearch} />);
    const input = screen.getByRole("searchbox", { name: "Search food items" });
    fireEvent.change(input, { target: { value: "mi" } });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    fireEvent.change(input, { target: { value: " milk " } });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(onSearch).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onSearch).toHaveBeenCalledExactlyOnceWith("milk");
    const clear = screen.getByRole("button", { name: "Clear search" });
    clear.focus();
    fireEvent.click(clear);
    expect(input).toHaveFocus();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onSearch).toHaveBeenLastCalledWith("");
  });
  it("cancels pending searches when unmounted", () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    const { unmount } = render(
      <SearchBar label="Search food items" onSearch={onSearch} />,
    );
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "milk" },
    });
    unmount();
    act(() => {
      vi.runAllTimers();
    });
    expect(onSearch).not.toHaveBeenCalled();
  });
});
