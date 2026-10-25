import { z } from "zod";

const cameraCaptureStrategySchema = z.enum(["baseline", "prefer-hd"]);

const elapsedEventSchema = z.object({
  sequence: z.number().int().positive().max(100_000),
  elapsedMs: z.number().int().nonnegative().max(3_600_000),
});

const numericRangeSchema = z
  .object({
    min: z.number().nonnegative().max(100_000),
    max: z.number().nonnegative().max(100_000),
  })
  .strict()
  .refine(({ min, max }) => max >= min, "Invalid camera capability range.");

const cameraDiagnosticSettingsSchema = z
  .object({
    width: z.number().int().positive().max(16_384).optional(),
    height: z.number().int().positive().max(16_384).optional(),
    videoWidth: z.number().int().nonnegative().max(16_384).optional(),
    videoHeight: z.number().int().nonnegative().max(16_384).optional(),
    frameRate: z.number().positive().max(1_000).optional(),
    facingMode: z.string().trim().min(1).max(64).optional(),
    focusMode: z.string().trim().min(1).max(64).optional(),
    focusDistance: z.number().nonnegative().max(100_000).optional(),
    zoom: z.number().nonnegative().max(1_000).optional(),
    deviceIdentity: z
      .string()
      .regex(/^camera-\d+$/)
      .optional(),
  })
  .strict();

const cameraDiagnosticCapabilitiesSchema = z
  .object({
    width: numericRangeSchema.optional(),
    height: numericRangeSchema.optional(),
    frameRate: numericRangeSchema.optional(),
    zoom: numericRangeSchema.optional(),
    focusDistance: numericRangeSchema.optional(),
    focusModes: z.array(z.string().trim().min(1).max(64)).max(10).optional(),
  })
  .strict();

const settingsFieldSchema = z.enum([
  "width",
  "height",
  "videoWidth",
  "videoHeight",
  "frameRate",
  "facingMode",
  "focusMode",
  "focusDistance",
  "zoom",
  "deviceIdentity",
]);

const cameraDiagnosticEventSchema = z.discriminatedUnion("type", [
  elapsedEventSchema
    .extend({
      type: z.literal("session-started"),
      captureStrategy: cameraCaptureStrategySchema,
      cameraSource: z.enum(["default", "selected"]),
      requestedResolution: z
        .object({
          width: z.number().int().positive().max(16_384),
          height: z.number().int().positive().max(16_384),
        })
        .strict()
        .optional(),
    })
    .strict(),
  elapsedEventSchema
    .extend({
      type: z.literal("camera-acquired"),
      cameraLabel: z.string().trim().min(1).max(120),
      settings: cameraDiagnosticSettingsSchema,
      capabilities: cameraDiagnosticCapabilitiesSchema,
    })
    .strict(),
  elapsedEventSchema
    .extend({
      type: z.literal("video-ready"),
      videoWidth: z.number().int().nonnegative().max(16_384),
      videoHeight: z.number().int().nonnegative().max(16_384),
      readyState: z.number().int().min(0).max(4),
    })
    .strict(),
  elapsedEventSchema.extend({ type: z.literal("decoder-started") }).strict(),
  elapsedEventSchema
    .extend({
      type: z.literal("decode-summary"),
      attempts: z.number().int().nonnegative().max(100_000),
      noResult: z.number().int().nonnegative().max(100_000),
      invalid: z.number().int().nonnegative().max(100_000),
      valid: z.number().int().nonnegative().max(100_000),
    })
    .strict(),
  elapsedEventSchema
    .extend({
      type: z.literal("first-valid-read"),
      attempt: z.number().int().positive().max(100_000),
      format: z.enum(["UPC_A", "EAN_13", "EAN_8", "ITF"]),
    })
    .strict(),
  elapsedEventSchema
    .extend({
      type: z.literal("matching-progress"),
      attempt: z.number().int().positive().max(100_000),
      reads: z.number().int().min(1).max(3),
    })
    .strict(),
  elapsedEventSchema
    .extend({
      type: z.literal("matching-reset"),
      reason: z.enum(["invalid", "different-barcode", "stale"]),
      previousReads: z.number().int().min(1).max(3),
    })
    .strict(),
  elapsedEventSchema
    .extend({
      type: z.literal("settings-changed"),
      changedFields: z.array(settingsFieldSchema).min(1).max(10),
      settings: cameraDiagnosticSettingsSchema,
    })
    .strict(),
  elapsedEventSchema
    .extend({
      type: z.literal("manual-marker"),
      marker: z.literal("camera-switched-or-image-sharpened"),
    })
    .strict(),
  elapsedEventSchema
    .extend({
      type: z.literal("session-completed"),
      outcome: z.literal("confirmed"),
      attempts: z.number().int().nonnegative().max(100_000),
      timeToFirstValidMs: z.number().int().nonnegative().max(3_600_000),
      timeToConfirmedMs: z.number().int().nonnegative().max(3_600_000),
    })
    .strict(),
  elapsedEventSchema
    .extend({
      type: z.literal("session-cancelled"),
      reason: z.enum([
        "camera-change",
        "strategy-change",
        "manual-entry",
        "component-closed",
      ]),
    })
    .strict(),
  elapsedEventSchema
    .extend({
      type: z.literal("session-error"),
      stage: z.enum(["setup", "acquisition", "decoding"]),
      errorName: z.string().trim().min(1).max(64),
    })
    .strict(),
]);

export const cameraDiagnosticBatchSchema = z
  .object({
    sessionId: z.uuid(),
    events: z.array(cameraDiagnosticEventSchema).min(1).max(20),
  })
  .strict()
  .superRefine(({ events }, context) => {
    for (let index = 1; index < events.length; index += 1) {
      const previous = events[index - 1];
      const current = events[index];
      if (!previous || !current) {
        continue;
      }

      if (current.sequence <= previous.sequence) {
        context.addIssue({
          code: "custom",
          path: ["events", index, "sequence"],
          message: "Diagnostic event sequences must increase.",
        });
      }
      if (current.elapsedMs < previous.elapsedMs) {
        context.addIssue({
          code: "custom",
          path: ["events", index, "elapsedMs"],
          message: "Diagnostic event times must not move backward.",
        });
      }
    }
  });

export type CameraDiagnosticSettings = z.infer<
  typeof cameraDiagnosticSettingsSchema
>;
export type CameraDiagnosticCapabilities = z.infer<
  typeof cameraDiagnosticCapabilitiesSchema
>;
export type CameraDiagnosticEvent = z.infer<typeof cameraDiagnosticEventSchema>;
export type CameraDiagnosticBatch = z.infer<typeof cameraDiagnosticBatchSchema>;
