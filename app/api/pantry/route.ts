import { getAuth } from "@/lib/auth/jwt";
import { connectDB } from "@/lib/db";
import { isDateLabelType, isPantryUnit } from "@/lib/domain/pantry";
import { PantryEntry } from "@/models/PantryEntry";
import { NextResponse } from "next/server";

/**
 * Normalize an unknown value to a `Date` or `null`.
 *
 * Accepts values that can be parsed by the `Date` constructor (strings,
 * numbers, or Date objects). Returns `null` for falsy inputs or invalid dates.
 *
 * @param v - value that may represent a date
 * @returns a valid Date object or null
 */
function toDateOrNull(v: unknown): Date | null {
  if (!v) return null; // treat empty/falsy as no date provided
  const d = new Date(String(v));

  // If `getTime()` is NaN, the date was invalid
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * GET /api/pantry
 *
 * - Ensures DB connection and authentication
 * - Returns only ACTIVE pantry items for the authenticated user
 * - Sorts by soonest package date first, then most-recently-created
 */
export async function GET() {
  // Ensure we have a DB connection before running queries
  await connectDB();

  // Resolve authentication (reads cookie/header depending on implementation)
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // For v0 we only return items with `status: "ACTIVE"`.
  // Sort by soonest expiration first, then most-recently-created.
  const items = await PantryEntry.find({ userId: auth.userId, status: "ACTIVE" })
    .sort({ dateOnPackage: 1, createdAt: -1 })
    .lean();

  return NextResponse.json({ items });
}

/**
 * POST /api/pantry
 *
 * Creates a new pantry entry for the authenticated user.
 * Expected JSON body:
 * {
 *   name: string,
 *   quantity: number,
 *   unit: PantryUnit,
 *   purchaseDate?: string|Date,
 *   dateLabelType?: DateLabelType,
 *   dateOnPackage?: string|Date
 * }
 */
export async function POST(req: Request) {
  await connectDB();

  // Ensure the user is authenticated before allowing writes
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Parse request body safely. If JSON parsing fails, `body` will be `null`.
  const body = await req.json().catch(() => null);

  // Extract and coerce fields from the incoming body
  const name = body?.name?.toString().trim();
  const quantity = Number(body?.quantity);
  const unit = body?.unit;

  // Basic validation with clear error responses for clients
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "Quantity must be a number > 0" }, { status: 400 });
  }

  // Allowed unit values - keep this list in sync if you support more units later
  if (!isPantryUnit(unit)) {
    return NextResponse.json({ error: "Invalid unit" }, { status: 400 });
  }

  // Normalize optional date fields to real Date objects or `undefined` for mongoose
  const purchaseDate = toDateOrNull(body?.purchaseDate);

  // Optional fields:
  // - If provided, validate dateLabelType against supported values.
  // - If invalid, return 400 (better than silently dropping).
  const rawDateLabelType = body?.dateLabelType;
  if (rawDateLabelType !== undefined && rawDateLabelType !== null && rawDateLabelType !== "") {
    if (!isDateLabelType(rawDateLabelType)) {
      return NextResponse.json({ error: "Invalid dateLabelType" }, { status: 400 });
    }
  }
  const dateLabelType = isDateLabelType(rawDateLabelType) ? rawDateLabelType : undefined;

  const dateOnPackage = toDateOrNull(body?.dateOnPackage);

  // Create the pantry entry in MongoDB (Mongoose model)
  const created = await PantryEntry.create({
    userId: auth.userId,
    name,
    quantity,
    unit,
    // use `undefined` so mongoose omits the field when not provided
    purchaseDate: purchaseDate ?? undefined,
    dateLabelType,
    dateOnPackage: dateOnPackage ?? undefined,
    status: "ACTIVE",
  });

  // Return the created item with 201 status
  return NextResponse.json({ item: created }, { status: 201 });
}
