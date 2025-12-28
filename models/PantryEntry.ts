import mongoose, { Schema, Model } from "mongoose";
import { PANTRY_UNITS, PANTRY_STATUSES, PantryUnit, PantryStatus } from "@/lib/domain/pantry";

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
    unit: { type: String, enum: PANTRY_UNITS, required: true },
    purchaseDate: { type: Date },
    expirationDate: { type: Date },
    status: { type: String, enum: PANTRY_STATUSES, default: "ACTIVE", index: true },
  },
  { timestamps: true }
);

PantryEntrySchema.index({ userId: 1, status: 1, expirationDate: 1 });

export const PantryEntry: Model<IPantryEntry> =
  mongoose.models.PantryEntry || mongoose.model<IPantryEntry>("PantryEntry", PantryEntrySchema);
