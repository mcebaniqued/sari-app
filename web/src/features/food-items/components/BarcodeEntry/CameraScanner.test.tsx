import {
  type CameraDiagnosticBatch,
  cameraDiagnosticBatchSchema,
} from "@sari/contracts";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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

function miss() {
  const callback = decode.mock.calls[0]?.[2] as (
    result: undefined,
    error: undefined,
    controls: { stop: () => void },
  ) => void;
  act(() => {
    callback(undefined, undefined, { stop });
  });
}

function captureDiagnosticBatches() {
  const batches: CameraDiagnosticBatch[] = [];
  const fetch = vi.fn((_input: string, init?: RequestInit) => {
    if (typeof init?.body !== "string") {
      throw new TypeError("Expected a serialized diagnostic batch.");
    }

    const body: unknown = JSON.parse(init.body);
    batches.push(cameraDiagnosticBatchSchema.parse(body));

    return Promise.resolve(new Response(null, { status: 204 }));
  });
  vi.stubGlobal("fetch", fetch);

  return { batches, fetch };
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

  it("prefers 1080p for normal sessions and decodes the negotiated stream unchanged", async () => {
    const { getUserMedia, stream, track } = camera();
    const applyConstraints = vi.fn();
    Object.assign(track, {
      applyConstraints,
      getCapabilities: () => ({ zoom: { min: 1, max: 4 } }),
      getSettings: () => ({ zoom: 1 }),
    });
    render(<CameraScanner onDetected={vi.fn()} onType={vi.fn()} />);

    await waitFor(() => {
      expect(decode).toHaveBeenCalledOnce();
    });
    expect(getUserMedia).toHaveBeenCalledExactlyOnceWith({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    });
    expect(decode).toHaveBeenCalledWith(
      stream,
      expect.any(HTMLVideoElement),
      expect.any(Function),
    );
    expect(screen.queryByRole("group", { name: "Camera zoom" })).toBeNull();
    expect(applyConstraints).not.toHaveBeenCalled();
  });

  it("applies diagnostic zoom to the acquired track and shows verified readback", async () => {
    window.history.replaceState({}, "", "/?cameraDiagnostics=1");
    const { track } = camera();
    let zoom = 1;
    const applyConstraints = vi.fn((constraints: MediaTrackConstraints) => {
      const requested = (
        constraints.advanced?.[0] as MediaTrackConstraintSet & {
          zoom?: number;
        }
      ).zoom;
      if (requested === undefined) {
        return Promise.reject(new TypeError("Expected a zoom constraint."));
      }

      zoom = requested;

      return Promise.resolve();
    });
    Object.assign(track, {
      applyConstraints,
      getCapabilities: () => ({ zoom: { min: 1, max: 4, step: 0.5 } }),
      getSettings: () => ({ zoom }),
    });
    render(<CameraScanner onDetected={vi.fn()} onType={vi.fn()} />);

    const zoomControls = await screen.findByRole("group", {
      name: "Camera zoom",
    });
    expect(screen.getByText("Current zoom: 1×")).toBeInTheDocument();
    expect(
      within(zoomControls).getByRole("button", { name: "1×" }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(zoomControls).getByRole("button", { name: "1.5×" }));

    await waitFor(() => {
      expect(applyConstraints).toHaveBeenCalledExactlyOnceWith({
        advanced: [{ zoom: 1.5 }],
      });
    });
    expect(await screen.findByText("Current zoom: 1.5×")).toBeInTheDocument();
    expect(
      within(zoomControls).getByRole("button", { name: "1.5×" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(decode).toHaveBeenCalledOnce();
  });

  it("offers a distinct default and filters presets outside the reported range", async () => {
    window.history.replaceState({}, "", "/?cameraDiagnostics=1");
    const { track } = camera();
    Object.assign(track, {
      applyConstraints: vi.fn().mockResolvedValue(undefined),
      getCapabilities: () => ({
        zoom: { min: 1.25, max: 1.75, step: 0.25 },
      }),
      getSettings: () => ({ zoom: 1.25 }),
    });
    render(<CameraScanner onDetected={vi.fn()} onType={vi.fn()} />);

    const zoomControls = await screen.findByRole("group", {
      name: "Camera zoom",
    });
    expect(
      within(zoomControls).getByRole("button", {
        name: "Default (1.25×)",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(zoomControls).getByRole("button", { name: "1.5×" }),
    ).toBeEnabled();
    expect(
      within(zoomControls).queryByRole("button", { name: "1×" }),
    ).toBeNull();
    expect(
      within(zoomControls).queryByRole("button", { name: "2×" }),
    ).toBeNull();
  });

  it("continues scanning when a diagnostic zoom constraint is rejected", async () => {
    window.history.replaceState({}, "", "/?cameraDiagnostics=1");
    const { track } = camera();
    Object.assign(track, {
      applyConstraints: vi
        .fn()
        .mockRejectedValue(
          new DOMException("Unsupported", "OverconstrainedError"),
        ),
      getCapabilities: () => ({ zoom: { min: 1, max: 4 } }),
      getSettings: () => ({ zoom: 1 }),
    });
    const onDetected = vi.fn();
    render(<CameraScanner onDetected={onDetected} onType={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "2×" }));
    expect(
      await screen.findByText(/Zoom adjustment wasn't applied/),
    ).toBeInTheDocument();

    read("012345678905");
    read("012345678905");
    read("012345678905");
    expect(onDetected).toHaveBeenCalledExactlyOnceWith("012345678905");
  });

  it("reports a zoom request that the camera ignores without interrupting scanning", async () => {
    window.history.replaceState({}, "", "/?cameraDiagnostics=1");
    const { track } = camera();
    Object.assign(track, {
      applyConstraints: vi.fn().mockResolvedValue(undefined),
      getCapabilities: () => ({ zoom: { min: 1, max: 4 } }),
      getSettings: () => ({ zoom: 1 }),
    });
    render(<CameraScanner onDetected={vi.fn()} onType={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "2×" }));

    expect(
      await screen.findByText(/Camera kept zoom at 1× instead of 2×\./),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1×" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "2×" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(decode).toHaveBeenCalledOnce();
  });

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

  it("keeps diagnostic baseline distinct until the user selects the resolution experiment", async () => {
    window.history.replaceState({}, "", "/?cameraDiagnostics=1");
    const { batches, fetch } = captureDiagnosticBatches();
    const { getUserMedia, trackStop } = camera();
    render(<CameraScanner onDetected={vi.fn()} onType={vi.fn()} />);
    await waitFor(() => {
      expect(getUserMedia).toHaveBeenCalledOnce();
    });
    expect(getUserMedia).toHaveBeenNthCalledWith(1, {
      audio: false,
      video: { facingMode: { ideal: "environment" } },
    });
    expect(screen.getByText("Camera diagnostics")).toBeInTheDocument();

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
    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
    expect(batches.flatMap((batch) => batch.events)).toContainEqual(
      expect.objectContaining({
        type: "session-cancelled",
        reason: "strategy-change",
      }),
    );
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

    expect(
      await screen.findByRole("button", {
        name: "Camera switched / image sharpened",
      }),
    ).toBeEnabled();
    expect(
      screen.getByRole("option", { name: "Default rear camera preference" }),
    ).toBeInTheDocument();
    expect(decode).toHaveBeenCalledOnce();
    expect(screen.queryByRole("group", { name: "Camera zoom" })).toBeNull();
  });

  it("reports acquisition errors without hiding the manual-entry fallback", async () => {
    window.history.replaceState({}, "", "/?cameraDiagnostics=1");
    const { batches, fetch } = captureDiagnosticBatches();
    const { getUserMedia } = camera();
    getUserMedia.mockRejectedValue(
      new DOMException("Denied", "NotAllowedError"),
    );
    render(<CameraScanner onDetected={vi.fn()} onType={vi.fn()} />);

    expect(await screen.findByText(/Allow camera access/)).toBeInTheDocument();
    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
    expect(batches.flatMap((batch) => batch.events)).toContainEqual(
      expect.objectContaining({
        type: "session-error",
        stage: "acquisition",
        errorName: "NotAllowedError",
      }),
    );
    expect(
      screen.getByRole("button", { name: "Enter barcode manually" }),
    ).toBeEnabled();
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
    expect(decode).toHaveBeenCalledOnce();
  });

  it("sends an ordered timeline for settings changes and decoder outcomes without barcode values", async () => {
    vi.useFakeTimers();
    window.history.replaceState({}, "", "/?cameraDiagnostics=1");
    const { batches, fetch } = captureDiagnosticBatches();
    const { track } = camera();
    let settings = {
      width: 640,
      height: 480,
      frameRate: 30,
      facingMode: "environment",
      zoom: 1,
      deviceId: "raw-camera-a",
    };
    track.getSettings = () => settings;
    const onDetected = vi.fn();
    render(<CameraScanner onDetected={onDetected} onType={vi.fn()} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(decode).toHaveBeenCalledOnce();

    const video = screen.getByLabelText<HTMLVideoElement>(
      "Barcode camera preview",
    );
    Object.defineProperties(video, {
      videoWidth: { configurable: true, value: 640 },
      videoHeight: { configurable: true, value: 480 },
      readyState: { configurable: true, value: 1 },
    });
    fireEvent.loadedMetadata(video);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Camera switched / image sharpened",
      }),
    );
    settings = {
      ...settings,
      width: 1920,
      height: 1080,
      zoom: 2,
      deviceId: "raw-camera-b",
    };
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    miss();
    read("853807005033");
    read("853807005034");
    read("853807005033");
    read("853807005033");
    read("853807005033");
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onDetected).toHaveBeenCalledExactlyOnceWith("853807005033");
    expect(fetch).toHaveBeenCalled();
    const events = batches.flatMap((batch) => batch.events);
    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        "session-started",
        "camera-acquired",
        "video-ready",
        "decoder-started",
        "manual-marker",
        "settings-changed",
        "decode-summary",
        "first-valid-read",
        "matching-reset",
        "matching-progress",
        "session-completed",
      ]),
    );
    expect(events.map((event) => event.sequence)).toEqual(
      [...events]
        .map((event) => event.sequence)
        .sort((left, right) => left - right),
    );
    const settingsEvent = events.find(
      (event) => event.type === "settings-changed",
    );
    expect(settingsEvent?.changedFields).toEqual(
      expect.arrayContaining(["width", "height", "zoom", "deviceIdentity"]),
    );
    expect(settingsEvent?.settings.deviceIdentity).toBe("camera-2");
    const summaryEvent = events.find(
      (event) => event.type === "decode-summary",
    );
    expect(summaryEvent).toMatchObject({
      attempts: 6,
      noResult: 1,
      invalid: 1,
      valid: 4,
    });
    expect(JSON.stringify(batches)).not.toContain("853807005033");
    expect(JSON.stringify(batches)).not.toContain("raw-camera");
  });
});
