import { foodUnitSchema } from "@sari/contracts";
import { model, Schema } from "mongoose";

const foodItemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    quantity: {
      type: Number,
      required: true,
      min: Number.MIN_VALUE,
      max: 1_000_000,
    },
    unit: { type: String, required: true, enum: foodUnitSchema.options },
    expiresOn: { type: String, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    bufferCommands: false,
    strict: "throw",
  },
);

foodItemSchema.index({ createdAt: -1, _id: -1 });
foodItemSchema.index(
  { name: 1, _id: -1 },
  { collation: { locale: "en", strength: 2 } },
);

export const FoodItemModel = model("FoodItem", foodItemSchema);
