import type {
  CameraDiagnosticBatch,
  CameraDiagnosticEvent,
} from "@sari/contracts";

const MAX_SESSIONS = 8;
const MAX_EVENTS_PER_SESSION = 200;
const terminalEventTypes = new Set<CameraDiagnosticEvent["type"]>([
  "session-completed",
  "session-cancelled",
  "session-error",
]);

export interface StoredCameraDiagnosticSession {
  sessionId: string;
  events: CameraDiagnosticEvent[];
  truncated: boolean;
}

export interface CameraDiagnosticExport {
  kind: "sari.camera-diagnostics-export";
  exportedAt: string;
  sessions: StoredCameraDiagnosticSession[];
}

const sessions: StoredCameraDiagnosticSession[] = [];
const listeners = new Set<() => void>();
let revision = 0;

function notify() {
  revision += 1;
  listeners.forEach((listener) => {
    listener();
  });
}

export function storeCameraDiagnosticBatch(batch: CameraDiagnosticBatch) {
  let session = sessions.find(({ sessionId }) => sessionId === batch.sessionId);
  if (!session) {
    session = { sessionId: batch.sessionId, events: [], truncated: false };
    sessions.push(session);
    if (sessions.length > MAX_SESSIONS) {
      sessions.shift();
    }
  }

  for (const event of batch.events) {
    if (terminalEventTypes.has(event.type)) {
      if (session.events.length < MAX_EVENTS_PER_SESSION) {
        session.events.push(event);
      } else {
        session.events[MAX_EVENTS_PER_SESSION - 1] = event;
        session.truncated = true;
      }

      continue;
    }

    if (session.events.length < MAX_EVENTS_PER_SESSION - 1) {
      session.events.push(event);
    } else {
      session.truncated = true;
    }
  }

  notify();
}

export function cameraDiagnosticRevision() {
  return revision;
}

export function subscribeToCameraDiagnostics(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function cameraDiagnosticSnapshot(): StoredCameraDiagnosticSession[] {
  return JSON.parse(
    JSON.stringify(sessions),
  ) as StoredCameraDiagnosticSession[];
}

export function clearCameraDiagnostics() {
  sessions.splice(0, sessions.length);
  notify();
}

function createExport(now: Date): CameraDiagnosticExport {
  return {
    kind: "sari.camera-diagnostics-export",
    exportedAt: now.toISOString(),
    sessions: cameraDiagnosticSnapshot(),
  };
}

export async function exportCameraDiagnostics(now = new Date()) {
  const report = createExport(now);
  const filename = `sari-camera-diagnostics-${now.toISOString().replaceAll(":", "-")}.json`;
  const file = new File([`${JSON.stringify(report, null, 2)}\n`], filename, {
    type: "application/json",
  });
  const shareData = { files: [file], title: "Sari camera diagnostics" };

  if (
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare(shareData)
  ) {
    await navigator.share(shareData);

    return "shared" as const;
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60_000);

  return "downloaded" as const;
}
