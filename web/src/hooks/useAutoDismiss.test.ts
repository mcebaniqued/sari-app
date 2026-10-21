import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useAutoDismiss } from "./useAutoDismiss";

afterEach(() => {
  vi.useRealTimers();
});

it("dismisses after five seconds", () => {
  vi.useFakeTimers();
  const onDismiss = vi.fn();
  renderHook(() => {
    useAutoDismiss({ duration: 5000, paused: false, onDismiss });
  });
  act(() => {
    vi.advanceTimersByTime(4999);
  });
  expect(onDismiss).not.toHaveBeenCalled();
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(onDismiss).toHaveBeenCalledOnce();
});

it("preserves remaining time while paused and resumes the countdown", () => {
  vi.useFakeTimers();
  const onDismiss = vi.fn();
  const { rerender } = renderHook(
    ({ paused }) => {
      useAutoDismiss({ duration: 5000, paused, onDismiss });
    },
    { initialProps: { paused: false } },
  );
  act(() => {
    vi.advanceTimersByTime(2000);
  });
  rerender({ paused: true });
  act(() => {
    vi.advanceTimersByTime(10000);
  });
  expect(onDismiss).not.toHaveBeenCalled();
  rerender({ paused: false });
  act(() => {
    vi.advanceTimersByTime(2999);
  });
  expect(onDismiss).not.toHaveBeenCalled();
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(onDismiss).toHaveBeenCalledOnce();
});

it("clears the timer when unmounted", () => {
  vi.useFakeTimers();
  const onDismiss = vi.fn();
  const { unmount } = renderHook(() => {
    useAutoDismiss({ duration: 5000, paused: false, onDismiss });
  });
  unmount();
  act(() => {
    vi.runAllTimers();
  });
  expect(onDismiss).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
