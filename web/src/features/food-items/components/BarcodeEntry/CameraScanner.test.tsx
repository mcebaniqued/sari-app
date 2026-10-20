import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CameraScanner from "./CameraScanner";

const { decode, stop } = vi.hoisted(() => ({ decode: vi.fn(), stop: vi.fn() }));
vi.mock("@zxing/browser", () => ({
  BrowserMultiFormatReader: class {
    decodeFromStream = decode;
  },
}));
vi.mock("@zxing/library", () => ({
  BarcodeFormat: { UPC_A: 1, EAN_13: 2, EAN_8: 3, ITF: 4 },
  DecodeHintType: { POSSIBLE_FORMATS: 1 },
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("camera scanning lifecycle", () => {
  function camera() {
    vi.stubGlobal("isSecureContext", true);
    const trackStop = vi.fn();
    const stream = { getTracks: () => [{ stop: trackStop }] };
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    decode.mockResolvedValue({ stop });
    return { stream, trackStop, getUserMedia };
  }

  it("accepts one detection and stops all camera tracks", async () => {
    const { trackStop } = camera();
    const onDetected = vi.fn();
    const view = render(
      <CameraScanner onDetected={onDetected} onType={vi.fn()} />,
    );
    await waitFor(() => {
      expect(decode).toHaveBeenCalledOnce();
    });
    const callback = decode.mock.calls[0]?.[2] as (
      result: { getText: () => string },
      error: undefined,
      controls: { stop: () => void },
    ) => void;
    act(() => {
      callback({ getText: () => "012345678905" }, undefined, { stop });
      callback({ getText: () => "012345678905" }, undefined, { stop });
    });
    expect(onDetected).toHaveBeenCalledExactlyOnceWith("012345678905");
    expect(trackStop).toHaveBeenCalled();
    view.unmount();
  });
  it("stops a stream whose permission resolves after dismissal", async () => {
    const { trackStop, getUserMedia, stream } = camera();
    let resolve: ((value: unknown) => void) | undefined;
    getUserMedia.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const view = render(
      <CameraScanner onDetected={vi.fn()} onType={vi.fn()} />,
    );
    await waitFor(() => {
      expect(getUserMedia).toHaveBeenCalledOnce();
    });
    view.unmount();
    await act(async () => {
      resolve?.(stream);
      await Promise.resolve();
    });
    expect(trackStop).toHaveBeenCalled();
    expect(decode).not.toHaveBeenCalled();
  });
  it("offers manual input after camera permission failure", async () => {
    const { getUserMedia } = camera();
    getUserMedia.mockRejectedValue(
      new DOMException("Denied", "NotAllowedError"),
    );
    const onType = vi.fn();
    render(<CameraScanner onDetected={vi.fn()} onType={onType} />);
    expect(await screen.findByText(/Allow camera access/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Enter barcode manually" }),
    );
    expect(onType).toHaveBeenCalledOnce();
  });
  it("suggests typing after elapsed scan time and clears timers on unmount", async () => {
    vi.useFakeTimers();
    const { trackStop } = camera();
    const view = render(
      <CameraScanner onDetected={vi.fn()} onType={vi.fn()} />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.getByText(/Try brighter light/)).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(
      screen.getByRole("button", { name: "Keep scanning" }),
    ).toBeInTheDocument();
    view.unmount();
    expect(trackStop).toHaveBeenCalled();
  });
  it("explains insecure connections without requesting camera permission", async () => {
    const { getUserMedia } = camera();
    vi.stubGlobal("isSecureContext", false);
    render(<CameraScanner onDetected={vi.fn()} onType={vi.fn()} />);
    expect(
      await screen.findByText(/Camera scanning needs a secure connection/),
    ).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(decode).not.toHaveBeenCalled();
  });
  it("offers typed entry when the device has no camera", async () => {
    const { getUserMedia } = camera();
    getUserMedia.mockRejectedValue(
      new DOMException("No device", "NotFoundError"),
    );
    render(<CameraScanner onDetected={vi.fn()} onType={vi.fn()} />);
    expect(await screen.findByText(/No camera was found/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Enter barcode manually" }),
    ).toBeEnabled();
  });
});
