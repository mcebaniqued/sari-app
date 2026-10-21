import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { afterEach, describe, expect, it, vi } from "vitest";
import CameraScanner from "./CameraScanner";

const { decode, stop, reader } = vi.hoisted(() => ({
  decode: vi.fn(),
  stop: vi.fn(),
  reader: vi.fn(),
}));
vi.mock("@zxing/browser", () => ({
  BrowserMultiFormatReader: class {
    constructor(hints: unknown, options: unknown) {
      reader(hints, options);
    }
    decodeFromStream = decode;
  },
}));

function read(value: string, format = BarcodeFormat.UPC_A) {
  const callback = decode.mock.calls[0]?.[2] as (
    result: { getText: () => string; getBarcodeFormat: () => BarcodeFormat },
    error: undefined,
    controls: { stop: () => void },
  ) => void;
  act(() => {
    callback(
      { getText: () => value, getBarcodeFormat: () => format },
      undefined,
      { stop },
    );
  });
}

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

  it("requires repeated matching reads before accepting and stopping the camera", async () => {
    const { trackStop } = camera();
    const onDetected = vi.fn();
    const view = render(
      <CameraScanner onDetected={onDetected} onType={vi.fn()} />,
    );
    await waitFor(() => {
      expect(decode).toHaveBeenCalledOnce();
    });
    read("012345678905");
    read("012345678905");
    expect(onDetected).not.toHaveBeenCalled();
    expect(trackStop).not.toHaveBeenCalled();
    read("012345678905");
    read("012345678905");
    expect(onDetected).toHaveBeenCalledExactlyOnceWith("012345678905");
    expect(trackStop).toHaveBeenCalled();
    view.unmount();
  });
  it("rejects short ITF results with the reported wrong digits despite their valid GTIN checksum", async () => {
    const { trackStop } = camera();
    const onDetected = vi.fn();
    render(<CameraScanner onDetected={onDetected} onType={vi.fn()} />);
    await waitFor(() => {
      expect(decode).toHaveBeenCalledOnce();
    });
    const hints = reader.mock.calls[0]?.[0] as Map<DecodeHintType, unknown>;
    expect(hints.get(DecodeHintType.ALLOWED_LENGTHS)).toEqual([14]);

    for (let i = 0; i < 3; i++) {
      read("25384482", BarcodeFormat.ITF);
    }

    expect(onDetected).not.toHaveBeenCalled();
    expect(trackStop).not.toHaveBeenCalled();

    for (let i = 0; i < 3; i++) {
      read("853807005033");
    }

    expect(onDetected).toHaveBeenCalledExactlyOnceWith("853807005033");
  });
  it("discards an isolated valid misread when the following frames identify another barcode", async () => {
    camera();
    const onDetected = vi.fn();
    render(<CameraScanner onDetected={onDetected} onType={vi.fn()} />);
    await waitFor(() => {
      expect(decode).toHaveBeenCalledOnce();
    });
    read("25384482", BarcodeFormat.EAN_8);
    read("853807005033");
    read("853807005033");
    expect(onDetected).not.toHaveBeenCalled();
    read("853807005033");
    expect(onDetected).toHaveBeenCalledExactlyOnceWith("853807005033");
  });
  it.each([
    ["96385074", BarcodeFormat.EAN_8],
    ["0853807005033", BarcodeFormat.EAN_13],
    ["00853807005033", BarcodeFormat.ITF],
  ])("still accepts repeated supported barcode %s", async (value, format) => {
    camera();
    const onDetected = vi.fn();
    render(<CameraScanner onDetected={onDetected} onType={vi.fn()} />);
    await waitFor(() => {
      expect(decode).toHaveBeenCalledOnce();
    });

    for (let i = 0; i < 3; i++) {
      read(value, format);
    }

    expect(onDetected).toHaveBeenCalledExactlyOnceWith(value);
  });
  it.each([
    ["853807005034", BarcodeFormat.UPC_A],
    ["853807005033", BarcodeFormat.EAN_8],
    ["00853807005033", BarcodeFormat.CODE_128],
  ])("ignores invalid or unsupported results %s/%s", async (value, format) => {
    const { trackStop } = camera();
    const onDetected = vi.fn();
    render(<CameraScanner onDetected={onDetected} onType={vi.fn()} />);
    await waitFor(() => {
      expect(decode).toHaveBeenCalledOnce();
    });

    for (let i = 0; i < 3; i++) {
      read(value, format);
    }

    expect(onDetected).not.toHaveBeenCalled();
    expect(trackStop).not.toHaveBeenCalled();
  });
  it("counts equivalent UPC/EAN reads together while preserving printed leading zeros", async () => {
    camera();
    const onDetected = vi.fn();
    render(<CameraScanner onDetected={onDetected} onType={vi.fn()} />);
    await waitFor(() => {
      expect(decode).toHaveBeenCalledOnce();
    });
    read("853807005033");
    read("0853807005033", BarcodeFormat.EAN_13);
    read("0853807005033", BarcodeFormat.EAN_13);
    expect(onDetected).toHaveBeenCalledExactlyOnceWith("0853807005033");
  });
  it("requires a fresh sequence after conflicting or invalid results", async () => {
    camera();
    const onDetected = vi.fn();
    render(<CameraScanner onDetected={onDetected} onType={vi.fn()} />);
    await waitFor(() => {
      expect(decode).toHaveBeenCalledOnce();
    });
    read("853807005033");
    read("853807005033");
    read("012345678905");
    read("853807005033");
    read("853807005033");
    read("853807005034");
    read("853807005033");
    read("853807005033");
    expect(onDetected).not.toHaveBeenCalled();
    read("853807005033");
    expect(onDetected).toHaveBeenCalledExactlyOnceWith("853807005033");
  });
  it("does not reuse stale reads or accept callbacks after dismissal", async () => {
    vi.useFakeTimers();
    camera();
    const onDetected = vi.fn();
    const view = render(
      <CameraScanner onDetected={onDetected} onType={vi.fn()} />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    read("853807005033");
    read("853807005033");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1501);
    });
    read("853807005033");
    read("853807005033");
    expect(onDetected).not.toHaveBeenCalled();
    view.unmount();
    read("853807005033");
    expect(onDetected).not.toHaveBeenCalled();
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
  it("does not clear a newer preview when cancelled permission resolves late", async () => {
    const { trackStop, getUserMedia, stream } = camera();
    let resolvePermission: ((value: unknown) => void) | undefined;
    getUserMedia.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePermission = resolve;
        }),
    );

    const view = render(
      <CameraScanner onDetected={vi.fn()} onType={vi.fn()} />,
    );
    const video = screen.getByLabelText<HTMLVideoElement>(
      "Barcode camera preview",
    );
    await waitFor(() => {
      expect(getUserMedia).toHaveBeenCalledOnce();
    });
    view.unmount();

    // Simulate a newer effect taking ownership before the cancelled request settles.
    const newerStream = {} as MediaStream;
    video.srcObject = newerStream;
    await act(async () => {
      resolvePermission?.(stream);
      await Promise.resolve();
    });

    expect(trackStop).toHaveBeenCalled();
    expect(video.srcObject).toBe(newerStream);
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
    expect(screen.getByRole("button", { name: "Type barcode" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Keep scanning" }));
    expect(
      screen.queryByRole("button", { name: "Keep scanning" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Enter barcode manually" }),
    ).toBeEnabled();
    expect(decode).toHaveBeenCalledOnce();
    expect(trackStop).not.toHaveBeenCalled();
    view.unmount();
    expect(trackStop).toHaveBeenCalled();
  });
  it("lets the user choose typed entry after a slow scan", async () => {
    vi.useFakeTimers();
    camera();
    const onType = vi.fn();
    const onDetected = vi.fn();
    render(<CameraScanner onDetected={onDetected} onType={onType} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(
      screen.getByRole("button", { name: "Enter barcode manually" }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Keep scanning" }),
    ).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(25_000);
    });
    fireEvent.click(screen.getByRole("button", { name: "Type barcode" }));
    expect(onType).toHaveBeenCalledOnce();
    expect(onDetected).not.toHaveBeenCalled();
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
    expect(
      screen.queryByRole("button", { name: "Keep scanning" }),
    ).not.toBeInTheDocument();
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
