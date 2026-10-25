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
  window.history.replaceState({}, "", "/");
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("camera scanning lifecycle", () => {
  function camera() {
    vi.stubGlobal("isSecureContext", true);
    const trackStop = vi.fn();
    const track = {
      label: "Back Camera",
      stop: trackStop,
      getCapabilities: () => ({}),
      getSettings: () => ({
        width: 1280,
        height: 720,
        frameRate: 30,
        facingMode: "environment",
      }),
    };
    const stream = {
      getTracks: () => [track],
      getVideoTracks: () => [track],
    };
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    decode.mockResolvedValue({ stop });

    return { stream, track, trackStop, getUserMedia };
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

  it("keeps baseline acquisition unchanged until the user opts into the resolution experiment", async () => {
    window.history.replaceState({}, "", "/?cameraDiagnostics=1");
    const { getUserMedia, trackStop } = camera();
    render(<CameraScanner onDetected={vi.fn()} onType={vi.fn()} />);
    await waitFor(() => {
      expect(getUserMedia).toHaveBeenCalledOnce();
    });
    expect(getUserMedia).toHaveBeenNthCalledWith(1, {
      audio: false,
      video: { facingMode: { ideal: "environment" } },
    });
    expect(screen.getByText("1280 × 720")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Capture strategy"), {
      target: { value: "prefer-hd" },
    });

    await waitFor(() => {
      expect(getUserMedia).toHaveBeenCalledTimes(2);
    });
    expect(trackStop).toHaveBeenCalled();
    expect(getUserMedia).toHaveBeenNthCalledWith(2, {
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    });
  });

  it("lists permission-exposed cameras and changes only the selected source", async () => {
    window.history.replaceState({}, "", "/?cameraDiagnostics=1");
    const { getUserMedia } = camera();
    const enumerateDevices = vi.fn().mockResolvedValue([
      { kind: "audioinput", deviceId: "microphone", label: "Phone mic" },
      { kind: "videoinput", deviceId: "wide", label: "Back Camera" },
      { kind: "videoinput", deviceId: "alternate", label: "Back Camera 2" },
    ]);
    vi.stubGlobal("navigator", {
      mediaDevices: { enumerateDevices, getUserMedia },
    });
    render(<CameraScanner onDetected={vi.fn()} onType={vi.fn()} />);
    expect(
      await screen.findByRole("option", { name: "Back Camera 2" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Camera source"), {
      target: { value: "alternate" },
    });

    await waitFor(() => {
      expect(getUserMedia).toHaveBeenCalledTimes(2);
    });
    expect(getUserMedia).toHaveBeenNthCalledWith(2, {
      audio: false,
      video: { deviceId: { exact: "alternate" } },
    });
  });

  it("reports an unavailable selected camera without silently changing sources", async () => {
    window.history.replaceState({}, "", "/?cameraDiagnostics=1");
    const { getUserMedia, stream, trackStop } = camera();
    getUserMedia
      .mockResolvedValueOnce(stream)
      .mockRejectedValueOnce(
        new DOMException("Unavailable", "OverconstrainedError"),
      );
    const enumerateDevices = vi
      .fn()
      .mockResolvedValue([
        { kind: "videoinput", deviceId: "alternate", label: "Back Camera 2" },
      ]);
    vi.stubGlobal("navigator", {
      mediaDevices: { enumerateDevices, getUserMedia },
    });
    render(<CameraScanner onDetected={vi.fn()} onType={vi.fn()} />);
    expect(
      await screen.findByRole("option", { name: "Back Camera 2" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Camera source"), {
      target: { value: "alternate" },
    });

    expect(
      await screen.findByText(/That camera setup isn't available/),
    ).toBeInTheDocument();
    expect(trackStop).toHaveBeenCalled();
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole("button", { name: "Enter barcode manually" }),
    ).toBeEnabled();
  });

  it("keeps diagnostics usable when optional camera inspection APIs are absent", async () => {
    window.history.replaceState({}, "", "/?cameraDiagnostics=1");
    const { getUserMedia, track } = camera();
    Object.assign(track, {
      getCapabilities: undefined,
      getSettings: undefined,
      label: "",
    });
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    render(<CameraScanner onDetected={vi.fn()} onType={vi.fn()} />);

    expect(await screen.findAllByText("Not reported")).not.toHaveLength(0);
    expect(
      screen.getByRole("option", { name: "Default rear camera preference" }),
    ).toBeInTheDocument();
    expect(decode).toHaveBeenCalledOnce();
  });

  it("stops a stale permission result after the diagnostic strategy changes", async () => {
    window.history.replaceState({}, "", "/?cameraDiagnostics=1");
    vi.stubGlobal("isSecureContext", true);
    const staleStop = vi.fn();
    const activeStop = vi.fn();
    const staleTrack = {
      label: "Stale camera",
      stop: staleStop,
      getCapabilities: () => ({}),
      getSettings: () => ({}),
    };
    const activeTrack = {
      label: "Active camera",
      stop: activeStop,
      getCapabilities: () => ({}),
      getSettings: () => ({ width: 1920, height: 1080 }),
    };
    const staleStream = {
      getTracks: () => [staleTrack],
      getVideoTracks: () => [staleTrack],
    };
    const activeStream = {
      getTracks: () => [activeTrack],
      getVideoTracks: () => [activeTrack],
    };
    let resolveStale: ((stream: typeof staleStream) => void) | undefined;
    const getUserMedia = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveStale = resolve;
          }),
      )
      .mockResolvedValueOnce(activeStream);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    decode.mockResolvedValue({ stop });
    render(<CameraScanner onDetected={vi.fn()} onType={vi.fn()} />);
    await waitFor(() => {
      expect(getUserMedia).toHaveBeenCalledOnce();
    });

    fireEvent.change(screen.getByLabelText("Capture strategy"), {
      target: { value: "prefer-hd" },
    });
    await waitFor(() => {
      expect(decode).toHaveBeenCalledOnce();
    });
    await act(async () => {
      resolveStale?.(staleStream);
      await Promise.resolve();
    });

    expect(staleStop).toHaveBeenCalled();
    expect(activeStop).not.toHaveBeenCalled();
    expect(screen.getByText("Active camera")).toBeInTheDocument();
  });
});
