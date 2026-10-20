import { foodUnitSchema } from "@sari/contracts";
import { model, Schema } from "mongoose";

const productSchema = new Schema(
  {
    barcode: { type: String, required: true },
    name: { type: String, required: true, maxlength: 120 },
    brand: { type: String, default: null },
    packageDescription: { type: String, default: null },
    packageQuantity: { type: Number, default: null },
    packageUnit: {
      type: String,
      enum: [...foodUnitSchema.options, null],
      default: null,
    },
    provider: { type: String, enum: ["usda"], required: true },
    externalId: { type: String, required: true },
    marketCountry: { type: String, default: null },
    sourceUrl: { type: String, required: true },
    sourceModifiedAt: { type: String, default: null },
    sourcePublishedAt: { type: String, default: null },
    checkedAt: { type: Date, required: true },
    // Never serialized by the public DTO. Retains nutrition provenance for later work.
    providerRaw: { type: Schema.Types.Mixed, required: true, select: false },
  },
  {
    timestamps: true,
    versionKey: false,
    bufferCommands: false,
    strict: "throw",
  },
);
productSchema.index({ provider: 1, externalId: 1 }, { unique: true });

export const FoodProductModel = model("FoodProduct", productSchema);

const lookupSchema = new Schema(
  {
    barcode: { type: String, required: true, unique: true },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "FoodProduct",
      default: null,
    },
    checkedAt: { type: Date, default: null },
    refreshAfter: { type: Date, default: null },
    leaseUntil: { type: Date, default: () => new Date(0) },
    retryAfter: { type: Date, default: () => new Date(0) },
  },
  { versionKey: false, bufferCommands: false, strict: "throw" },
);

export const BarcodeLookupModel = model("BarcodeLookup", lookupSchema);

// A shared counter also bounds requests across multiple API instances.
const budgetSchema = new Schema(
  {
    _id: { type: String, required: true },
    calls: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false, bufferCommands: false },
);
budgetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const UsdaBudgetModel = model("UsdaBudget", budgetSchema);
