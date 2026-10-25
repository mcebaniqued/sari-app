import { describe, expect, it } from "vitest";
import { cameraDiagnosticBatchSchema } from "./camera-diagnostics.js";

const sessionId = "4f6e81ef-6c60-4704-b686-3dd389120246";

describe("camera diagnostic contract", () => {
  it("accepts ordered, bounded events without barcode or raw device identity", () => {
    const batch = cameraDiagnosticBatchSchema.parse({
      sessionId,
      events: [
        {
          type: "session-started",
          sequence: 1,
          elapsedMs: 0,
          captureStrategy: "prefer-hd",
          cameraSource: "default",
          requestedResolution: { width: 1920, height: 1080 },
        },
        {
          type: "camera-acquired",
          sequence: 2,
          elapsedMs: 140,
          cameraLabel: "Back Triple Camera",
          settings: {
            width: 1080,
            height: 1920,
            frameRate: 30,
            zoom: 1,
            deviceIdentity: "camera-1",
          },
          capabilities: {
            zoom: { min: 1, max: 9 },
            focusModes: ["continuous"],
          },
        },
      ],
    });

    expect(batch.events).toHaveLength(2);
  });

  it.each([
    {
      sessionId,
      events: [
        {
          type: "session-started",
          sequence: 1,
          elapsedMs: 0,
          captureStrategy: "baseline",
          cameraSource: "default",
          barcode: "012345678905",
        },
      ],
    },
    {
      sessionId,
      events: [
        {
          type: "camera-acquired",
          sequence: 1,
          elapsedMs: 0,
          cameraLabel: "Back Camera",
          settings: { deviceId: "raw-device-id" },
          capabilities: {},
        },
      ],
    },
    {
      sessionId,
      events: [
        {
          type: "decoder-started",
          sequence: 2,
          elapsedMs: 10,
        },
        {
          type: "decoder-started",
          sequence: 1,
          elapsedMs: 20,
        },
      ],
    },
  ])("rejects unsafe or unordered diagnostic input", (input) => {
    expect(cameraDiagnosticBatchSchema.safeParse(input).success).toBe(false);
  });

  it("rejects batches larger than the endpoint limit", () => {
    expect(
      cameraDiagnosticBatchSchema.safeParse({
        sessionId,
        events: Array.from({ length: 21 }, (_, index) => ({
          type: "decoder-started",
          sequence: index + 1,
          elapsedMs: index,
        })),
      }).success,
    ).toBe(false);
  });
});
