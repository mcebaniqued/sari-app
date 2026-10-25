import { describe, expect, it, vi } from "vitest";
import {
  availableVideoInputs,
  cameraDiagnosticsEnabled,
  cameraDiagnosticSnapshot,
  cameraVideoConstraints,
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

  it("reports only useful camera settings and optional capabilities", () => {
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

    expect(cameraDiagnosticSnapshot(track, video)).toEqual({
      cameraLabel: "Back Camera",
      captureResolution: "1920 × 1080",
      videoResolution: "1920 × 1080",
      frameRate: "30",
      facingMode: "environment",
      resolutionCapability: "320–1920 × 240–1080",
      frameRateCapability: "1–60",
      focusModes: "continuous, manual",
      zoomCapability: "1–5",
    });
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

  it("treats failed optional inspection methods as unreported diagnostics", () => {
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
      cameraDiagnosticSnapshot(track, {
        videoWidth: 0,
        videoHeight: 0,
      } as HTMLVideoElement),
    ).toEqual({
      cameraLabel: "Not reported",
      captureResolution: "Not reported",
      videoResolution: "Not reported",
      frameRate: "Not reported",
      facingMode: "Not reported",
      resolutionCapability: "Not reported",
      frameRateCapability: "Not reported",
      focusModes: "Not reported",
      zoomCapability: "Not reported",
    });
  });
});
