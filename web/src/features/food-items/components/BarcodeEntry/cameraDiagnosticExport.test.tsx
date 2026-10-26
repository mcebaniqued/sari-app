import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cameraDiagnosticSnapshot,
  clearCameraDiagnostics,
  exportCameraDiagnostics,
  storeCameraDiagnosticBatch,
} from "./cameraDiagnosticExport";
import CameraDiagnosticExportControl from "./CameraDiagnosticExportControl";

const sessionId = "4f6e81ef-6c60-4704-b686-3dd389120246";

function storeSession(id = sessionId) {
  storeCameraDiagnosticBatch({
    sessionId: id,
    events: [
      {
        type: "session-started",
        sequence: 1,
        elapsedMs: 0,
        captureStrategy: "baseline",
        cameraSource: "default",
      },
      {
        type: "session-cancelled",
        sequence: 2,
        elapsedMs: 10,
        reason: "component-closed",
      },
    ],
  });
}

afterEach(() => {
  clearCameraDiagnostics();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("local camera diagnostic export", () => {
  it("keeps only the newest bounded sessions", () => {
    for (let index = 0; index < 9; index += 1) {
      storeSession(`00000000-0000-4000-8000-00000000000${index}`);
    }

    const sessions = cameraDiagnosticSnapshot();
    expect(sessions).toHaveLength(8);
    expect(sessions[0]?.sessionId).toBe("00000000-0000-4000-8000-000000000001");
    expect(sessions.at(-1)?.sessionId).toBe(
      "00000000-0000-4000-8000-000000000008",
    );
  });

  it("preserves a terminal outcome when an event timeline is truncated", () => {
    storeCameraDiagnosticBatch({
      sessionId,
      events: Array.from({ length: 205 }, (_, index) => ({
        type: "decoder-started" as const,
        sequence: index + 1,
        elapsedMs: index,
      })),
    });
    storeCameraDiagnosticBatch({
      sessionId,
      events: [
        {
          type: "session-completed",
          sequence: 206,
          elapsedMs: 205,
          outcome: "confirmed",
          attempts: 20,
          timeToFirstValidMs: 100,
          timeToConfirmedMs: 205,
        },
      ],
    });

    const session = cameraDiagnosticSnapshot()[0];
    expect(session?.truncated).toBe(true);
    expect(session?.events).toHaveLength(200);
    expect(session?.events.at(-1)).toMatchObject({
      type: "session-completed",
      sequence: 206,
    });
  });

  it("uses file sharing when the browser supports it", async () => {
    storeSession();
    const share = vi
      .fn<(data?: ShareData) => Promise<void>>()
      .mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      canShare: vi.fn().mockReturnValue(true),
      share,
    });

    await expect(
      exportCameraDiagnostics(new Date("2026-10-26T06:00:00.000Z")),
    ).resolves.toBe("shared");
    expect(share).toHaveBeenCalledOnce();
    const sharedFile = share.mock.calls[0]?.[0]?.files?.[0];
    expect(sharedFile).toBeInstanceOf(File);
    if (!(sharedFile instanceof File)) {
      throw new TypeError("Expected a shared diagnostic file.");
    }
    expect(sharedFile.name).toBe(
      "sari-camera-diagnostics-2026-10-26T06-00-00.000Z.json",
    );
    await expect(sharedFile.text()).resolves.toContain(
      '"kind": "sari.camera-diagnostics-export"',
    );
  });

  it("falls back to a JSON download and keeps sessions after the control remounts", async () => {
    storeSession();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const createObjectURL = vi.fn().mockReturnValue("blob:camera-diagnostics");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    });
    vi.stubGlobal("navigator", {});

    await expect(
      exportCameraDiagnostics(new Date("2026-10-26T06:00:00.000Z")),
    ).resolves.toBe("downloaded");
    expect(click).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(File));

    const first = render(<CameraDiagnosticExportControl />);
    expect(screen.getByText("1 camera session ready to export.")).toBeVisible();
    first.unmount();
    render(<CameraDiagnosticExportControl />);
    expect(screen.getByText("1 camera session ready to export.")).toBeVisible();
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });
});
