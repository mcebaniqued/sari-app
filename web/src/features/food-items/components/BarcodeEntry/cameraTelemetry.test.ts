import type { CameraDiagnosticBatch } from "@sari/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cameraDiagnosticSnapshot,
  clearCameraDiagnostics,
} from "./cameraDiagnosticExport";
import { CameraDiagnosticSession } from "./cameraTelemetry";

const sessionId = "4f6e81ef-6c60-4704-b686-3dd389120246";

afterEach(() => {
  clearCameraDiagnostics();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("camera diagnostic session", () => {
  it("assigns ordered sequences and monotonic elapsed times", async () => {
    let now = 100;
    const send = vi
      .fn<(batch: CameraDiagnosticBatch) => Promise<void>>()
      .mockResolvedValue(undefined);
    const session = new CameraDiagnosticSession({
      now: () => now,
      send,
      sessionId,
    });

    session.record({
      type: "session-started",
      captureStrategy: "baseline",
      cameraSource: "default",
    });
    now = 125.6;
    session.record({ type: "decoder-started" });
    now = 120;
    session.record({
      type: "decode-summary",
      attempts: 1,
      noResult: 1,
      invalid: 0,
      valid: 0,
    });
    await session.flush();

    expect(send.mock.calls[0]?.[0].events).toEqual([
      expect.objectContaining({ sequence: 1, elapsedMs: 0 }),
      expect.objectContaining({ sequence: 2, elapsedMs: 26 }),
      expect.objectContaining({ sequence: 3, elapsedMs: 26 }),
    ]);
  });

  it("batches events on a bounded timer", async () => {
    vi.useFakeTimers();
    const send = vi
      .fn<(batch: CameraDiagnosticBatch) => Promise<void>>()
      .mockResolvedValue(undefined);
    const session = new CameraDiagnosticSession({
      batchSize: 3,
      flushDelayMs: 1000,
      now: () => performance.now(),
      send,
      sessionId,
    });

    session.record({ type: "decoder-started" });
    session.record({
      type: "decode-summary",
      attempts: 1,
      noResult: 1,
      invalid: 0,
      valid: 0,
    });
    expect(send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);

    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]?.[0].events).toHaveLength(2);
  });

  it("continues after failed delivery and flushes the terminal event", async () => {
    const send = vi
      .fn<(batch: CameraDiagnosticBatch) => Promise<void>>()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(undefined);
    const session = new CameraDiagnosticSession({ send, sessionId });

    session.record({ type: "decoder-started" });
    await expect(session.flush()).resolves.toBeUndefined();
    await expect(
      session.close({
        type: "session-cancelled",
        reason: "component-closed",
      }),
    ).resolves.toBeUndefined();

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]?.[0].events).toEqual([
      expect.objectContaining({
        type: "session-cancelled",
        sequence: 2,
      }),
    ]);
    session.record({ type: "decoder-started" });
    await session.flush();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("stores terminal sessions locally without making a remote request", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const session = new CameraDiagnosticSession({ sessionId });

    session.record({
      type: "session-started",
      captureStrategy: "baseline",
      cameraSource: "default",
    });
    await session.close({
      type: "session-cancelled",
      reason: "component-closed",
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(cameraDiagnosticSnapshot()).toEqual([
      {
        sessionId,
        truncated: false,
        events: [
          expect.objectContaining({ type: "session-started", sequence: 1 }),
          expect.objectContaining({
            type: "session-cancelled",
            reason: "component-closed",
            sequence: 2,
          }),
        ],
      },
    ]);
  });
});
