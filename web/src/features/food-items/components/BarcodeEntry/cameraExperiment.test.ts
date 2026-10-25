import { describe, expect, it, vi } from "vitest";
import {
  availableVideoInputs,
  cameraDiagnosticCapabilities,
  cameraDiagnosticReading,
  cameraDiagnosticsEnabled,
  cameraVideoConstraints,
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
