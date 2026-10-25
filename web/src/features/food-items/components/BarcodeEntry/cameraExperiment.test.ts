import { describe, expect, it, vi } from "vitest";
import {
  applyCameraZoom,
  availableVideoInputs,
  cameraDiagnosticCapabilities,
  cameraDiagnosticReading,
  cameraDiagnosticsEnabled,
  cameraVideoConstraints,
  cameraZoomControl,
  cameraZoomOptions,
  changedCameraSettings,
  diagnosticCameraLabel,
} from "./cameraExperiment";

describe("camera experiment", () => {
  it("gates diagnostics behind an explicit query value", () => {
    expect(cameraDiagnosticsEnabled("?cameraDiagnostics=1")).toBe(true);
    expect(cameraDiagnosticsEnabled("?cameraDiagnostics=0")).toBe(false);
    expect(cameraDiagnosticsEnabled("")).toBe(false);
  });

  it("changes only requested resolution between baseline and HD", () => {
    expect(cameraVideoConstraints("baseline")).toEqual({
      facingMode: { ideal: "environment" },
    });
    expect(cameraVideoConstraints("prefer-hd")).toEqual({
      facingMode: { ideal: "environment" },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    });
    expect(cameraVideoConstraints("baseline", "chosen-camera")).toEqual({
      deviceId: { exact: "chosen-camera" },
    });
  });

  it("reports bounded camera settings without transmitting the raw device ID", () => {
    const track = {
      label: "Back Camera",
      getSettings: () => ({
        width: 1920,
        height: 1080,
        frameRate: 29.97,
        facingMode: "environment",
        deviceId: "not-shown",
      }),
      getCapabilities: () => ({
        width: { min: 320, max: 1920 },
        height: { min: 240, max: 1080 },
        frameRate: { min: 1, max: 60 },
        focusMode: ["continuous", "manual"],
        zoom: { min: 1, max: 5 },
        deviceId: "not-shown",
      }),
    } as unknown as MediaStreamTrack;
    const video = { videoWidth: 1920, videoHeight: 1080 } as HTMLVideoElement;

    expect(cameraDiagnosticReading(track, video, "camera-1")).toEqual({
      rawDeviceId: "not-shown",
      settings: {
        width: 1920,
        height: 1080,
        videoWidth: 1920,
        videoHeight: 1080,
        frameRate: 29.97,
        facingMode: "environment",
        deviceIdentity: "camera-1",
      },
    });
    expect(cameraDiagnosticCapabilities(track)).toEqual({
      width: { min: 320, max: 1920 },
      height: { min: 240, max: 1080 },
      frameRate: { min: 1, max: 60 },
      focusModes: ["continuous", "manual"],
      zoom: { min: 1, max: 5 },
    });
    expect(diagnosticCameraLabel(track)).toBe("Back Camera");
  });

  it("uses label fallbacks and tolerates failed device enumeration", async () => {
    const enumerateDevices = vi.fn().mockResolvedValue([
      { kind: "videoinput", deviceId: "first", label: "" },
      { kind: "audioinput", deviceId: "audio", label: "Microphone" },
      { kind: "videoinput", deviceId: "second", label: "Rear camera" },
    ]);
    expect(
      await availableVideoInputs({
        enumerateDevices,
      } as unknown as MediaDevices),
    ).toEqual([
      { deviceId: "first", label: "Camera 1" },
      { deviceId: "second", label: "Rear camera" },
    ]);

    enumerateDevices.mockRejectedValueOnce(new DOMException("Unavailable"));
    expect(
      await availableVideoInputs({
        enumerateDevices,
      } as unknown as MediaDevices),
    ).toEqual([]);
  });

  it("treats failed optional inspection methods as empty diagnostics", () => {
    const track = {
      label: "",
      getSettings: () => {
        throw new DOMException("Unsupported");
      },
      getCapabilities: () => {
        throw new DOMException("Unsupported");
      },
    } as unknown as MediaStreamTrack;

    expect(
      cameraDiagnosticReading(track, {
        videoWidth: 0,
        videoHeight: 0,
      } as HTMLVideoElement),
    ).toEqual({
      settings: { videoWidth: 0, videoHeight: 0 },
    });
    expect(cameraDiagnosticCapabilities(track)).toEqual({});
    expect(diagnosticCameraLabel(track)).toBe("Not reported");
  });

  it("exposes only usable zoom controls and applies a bounded track constraint", async () => {
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
    const track = {
      applyConstraints,
      getCapabilities: () => ({ zoom: { min: 1, max: 4, step: 0.5 } }),
      getSettings: () => ({ zoom }),
    } as unknown as MediaStreamTrack;

    expect(cameraZoomControl(track)).toEqual({
      min: 1,
      max: 4,
      step: 0.5,
      current: 1,
    });
    await expect(
      applyCameraZoom(track, 8, { min: 1, max: 4 }),
    ).resolves.toEqual({
      requested: 4,
      actual: 4,
    });
    expect(applyConstraints).toHaveBeenCalledExactlyOnceWith({
      advanced: [{ zoom: 4 }],
    });
  });

  it("does not offer zoom without a variable range, readable setting, and constraint support", () => {
    expect(
      cameraZoomControl({
        getCapabilities: () => ({ zoom: { min: 1, max: 1 } }),
        getSettings: () => ({ zoom: 1 }),
      } as unknown as MediaStreamTrack),
    ).toBeUndefined();
    expect(
      cameraZoomControl({
        applyConstraints: vi.fn(),
        getCapabilities: () => ({ zoom: { min: 1, max: 4 } }),
        getSettings: () => ({}),
      } as unknown as MediaStreamTrack),
    ).toBeUndefined();
  });

  it("offers only supported preset zoom values and preserves a distinct initial default", () => {
    expect(
      cameraZoomOptions(
        { min: 1.25, max: 1.75, step: 0.25, current: 1.25 },
        1.25,
      ),
    ).toEqual([
      { label: "Default (1.25×)", value: 1.25 },
      { label: "1.5×", value: 1.5 },
    ]);
    expect(
      cameraZoomOptions({ min: 1, max: 2, step: 0.5, current: 1.5 }, 1.5),
    ).toEqual([
      { label: "1×", value: 1 },
      { label: "1.5×", value: 1.5 },
      { label: "2×", value: 2 },
    ]);
    expect(cameraZoomOptions({ min: 1.5, max: 2, current: 1.5 }, 1)).toEqual([
      { label: "1.5×", value: 1.5 },
      { label: "2×", value: 2 },
    ]);
  });

  it("identifies only settings that changed between periodic samples", () => {
    expect(
      changedCameraSettings(
        { width: 640, height: 480, zoom: 1, deviceIdentity: "camera-1" },
        { width: 1920, height: 1080, zoom: 2, deviceIdentity: "camera-2" },
      ),
    ).toEqual(["width", "height", "zoom", "deviceIdentity"]);
    expect(changedCameraSettings({ width: 640 }, { width: 640 })).toEqual([]);
  });
});
