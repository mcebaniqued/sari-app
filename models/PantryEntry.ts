import mongoose, { Schema, Model } from "mongoose";

export type PantryUnit = "count" | "g" | "oz" | "ml";
export type PantryStatus = "ACTIVE" | "CONSUMED" | "DISCARDED";

export interface IPantryEntry {
  userId: mongoose.Types.ObjectId;
  name: string;
  quantity: number;
  unit: PantryUnit;
  purchaseDate?: Date;
  expirationDate?: Date;
  status: PantryStatus;
  createdAt: Date;
  updatedAt: Date;
}

const PantryEntrySchema = new Schema<IPantryEntry>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, enum: ["count", "g", "oz", "ml"], required: true },

    purchaseDate: { type: Date },
    expirationDate: { type: Date },

    status: { type: String, enum: ["ACTIVE", "CONSUMED", "DISCARDED"], default: "ACTIVE", index: true },
  },
  { timestamps: true }
);

// Default list query index
PantryEntrySchema.index({ userId: 1, status: 1, expirationDate: 1 });

export const PantryEntry: Model<IPantryEntry> =
  mongoose.models.PantryEntry || mongoose.model<IPantryEntry>("PantryEntry", PantryEntrySchema);
