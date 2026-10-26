import type {
  CameraDiagnosticBatch,
  CameraDiagnosticEvent,
} from "@sari/contracts";
import { storeCameraDiagnosticBatch } from "./cameraDiagnosticExport";

type CameraDiagnosticEventInput = CameraDiagnosticEvent extends infer Event
  ? Event extends CameraDiagnosticEvent
    ? Omit<Event, "elapsedMs" | "sequence">
    : never
  : never;

type TerminalEventInput = Extract<
  CameraDiagnosticEventInput,
  { type: "session-cancelled" | "session-completed" | "session-error" }
>;

type SendBatch = (batch: CameraDiagnosticBatch) => Promise<void>;

interface Options {
  batchSize?: number;
  flushDelayMs?: number;
  now?: () => number;
  send?: SendBatch;
  sessionId?: string;
}

const DEFAULT_BATCH_SIZE = 12;
const DEFAULT_FLUSH_DELAY_MS = 2_000;

function newSessionId() {
  if (typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const value = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

export class CameraDiagnosticSession {
  readonly id: string;

  private readonly batchSize: number;
  private readonly flushDelayMs: number;
  private readonly now: () => number;
  private readonly send: SendBatch | undefined;
  private readonly startedAt: number;
  private closed = false;
  private events: CameraDiagnosticEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private lastElapsedMs = 0;
  private sendChain = Promise.resolve();
  private sequence = 0;

  constructor(options: Options = {}) {
    this.id = options.sessionId ?? newSessionId();
    this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    this.flushDelayMs = options.flushDelayMs ?? DEFAULT_FLUSH_DELAY_MS;
    this.now = options.now ?? (() => performance.now());
    this.send = options.send;
    this.startedAt = this.now();
  }

  record(input: CameraDiagnosticEventInput) {
    if (this.closed) {
      return;
    }

    this.add(input);
  }

  flush() {
    if (this.flushTimer !== undefined) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }

    const events = this.events.splice(0, this.batchSize);
    if (events.length === 0) {
      return this.sendChain;
    }

    const batch = {
      sessionId: this.id,
      events,
    } satisfies CameraDiagnosticBatch;
    storeCameraDiagnosticBatch(batch);
    const send = this.send;
    if (!send) {
      return this.sendChain;
    }

    this.sendChain = this.sendChain
      .then(() => send(batch))
      // Optional observers are best effort and must never affect scanning.
      .catch(() => undefined);

    return this.sendChain;
  }

  close(input: TerminalEventInput) {
    if (!this.closed) {
      this.add(input);
      this.closed = true;
    }

    return this.flush();
  }

  private add(input: CameraDiagnosticEventInput) {
    const elapsedMs = Math.max(
      this.lastElapsedMs,
      Math.round(this.now() - this.startedAt),
    );
    this.lastElapsedMs = elapsedMs;
    this.sequence += 1;
    this.events.push({ ...input, sequence: this.sequence, elapsedMs });

    if (this.events.length >= this.batchSize) {
      void this.flush();

      return;
    }

    this.flushTimer ??= setTimeout(() => {
      this.flushTimer = undefined;
      void this.flush();
    }, this.flushDelayMs);
  }
}
