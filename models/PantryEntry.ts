import {
  DATE_LABEL_TYPES,
  PANTRY_STATUSES,
  PANTRY_UNITS,
  type DateLabelType,
  type PantryStatus,
  type PantryUnit,
} from "@/lib/domain/pantry";
import mongoose, { Model, Schema } from "mongoose";

export interface IPantryEntry {
  userId: mongoose.Types.ObjectId;
  name: string;
  quantity: number;
  unit: PantryUnit;
  purchaseDate?: Date;
  dateLabelType?: DateLabelType;
  dateOnPackage?: Date;
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
    dateLabelType: { type: String, enum: DATE_LABEL_TYPES },
    dateOnPackage: { type: Date },
    status: { type: String, enum: PANTRY_STATUSES, default: "ACTIVE", index: true },
  },
  { timestamps: true }
);

// Query pattern: find({ userId, status }).sort({ dateOnPackage: 1, createdAt: -1 })
PantryEntrySchema.index({ userId: 1, status: 1, dateOnPackage: 1, createdAt: -1 });

export const PantryEntry: Model<IPantryEntry> =
  mongoose.models.PantryEntry || mongoose.model<IPantryEntry>("PantryEntry", PantryEntrySchema);
