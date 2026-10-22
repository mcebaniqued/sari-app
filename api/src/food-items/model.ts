import { foodUnitSchema } from "@sari/contracts";
import { model, Schema } from "mongoose";

const foodItemSchema = new Schema(
  {
    userId: { type: String, required: true, immutable: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    quantity: {
      type: Number,
      required: true,
      min: Number.MIN_VALUE,
      max: 1_000_000,
    },
    unit: { type: String, required: true, enum: foodUnitSchema.options },
    expiresOn: { type: String, default: null },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "FoodProduct",
      default: null,
    },
    barcode: { type: String, default: null },
    creationKey: { type: String, immutable: true, select: false },
    creationFingerprint: { type: String, immutable: true, select: false },
  },
  {
    timestamps: true,
    versionKey: false,
    bufferCommands: false,
    strict: "throw",
  },
);

foodItemSchema.index({ userId: 1, createdAt: -1, _id: -1 });
foodItemSchema.index(
  { userId: 1, expiresOn: 1, _id: 1 },
  { collation: { locale: "en", strength: 2 } },
);
foodItemSchema.index(
  { userId: 1, creationKey: 1 },
  {
    unique: true,
    partialFilterExpression: { creationKey: { $type: "string" } },
  },
);
foodItemSchema.index(
  { userId: 1, name: 1, _id: -1 },
  { collation: { locale: "en", strength: 2 } },
);

export const FoodItemModel = model("FoodItem", foodItemSchema);
