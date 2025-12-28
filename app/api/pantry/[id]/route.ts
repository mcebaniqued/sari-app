import { getAuth } from "@/lib/auth/jwt";
import { connectDB } from "@/lib/db";
import { PantryEntry } from "@/models/PantryEntry";
import mongoose from "mongoose";
import { NextResponse } from "next/server";

/**
 * Route context type - Next.js provides `params` as a promise in app routes.
 */
type Ctx = { params: Promise<{ id: string }> };

/**
 * DELETE /api/pantry/:id
 *
 * Soft-delete a pantry entry by marking it `DISCARDED` instead of removing it
 * from the database. This preserves history while removing the item from the
 * "active" lists shown to the user.
 *
 * Steps:
 * 1. Ensure DB connection
 * 2. Authorize the request (resolve current user)
 * 3. Validate the `id` parameter is a valid MongoDB ObjectId
 * 4. Update the matching ACTIVE item owned by the user to `DISCARDED`
 * 5. Return appropriate HTTP responses for each failure/success case
 */
export async function DELETE(_: Request, ctx: Ctx) {
  // 1) Ensure DB connection before performing queries
  await connectDB();

  // 2) Resolve authentication. `getAuth` reads cookies/headers and returns
  // authenticated user info or `null` when unauthorized.
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // `params` is a promise in Next.js app routes - await to get the actual values
  const { id } = await ctx.params;

  // 3) Validate `id` early to avoid querying the DB with malformed values
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // 4) Soft-delete: restrict update to items that are ACTIVE and belong to
  // the authenticated user. This prevents users from affecting others' data.
  const updated = await PantryEntry.findOneAndUpdate(
    { _id: id, userId: auth.userId, status: "ACTIVE" },
    { $set: { status: "DISCARDED" } },
    { new: true }
  ).select({ _id: 1 }); // return minimal payload

  // 5) If nothing was updated, respond with 404. This avoids leaking whether
  // an id exists but belongs to another user.
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Success - confirm the operation.
  return NextResponse.json({ ok: true });
}
