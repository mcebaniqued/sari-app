import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { hashPassword } from "@/lib/auth/password";
import { setAuthCookie } from "@/lib/auth/jwt";

export async function POST(req: Request) {
  await connectDB();

  const body = await req.json().catch(() => null);
  const email = body?.email?.toString().trim().toLowerCase();
  const password = body?.password?.toString();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const existing = await User.findOne({ email }).select({ _id: 1 });
  if (existing) {
    return NextResponse.json({ error: "Email is already in use" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await User.create({ email, passwordHash });

  await setAuthCookie(user._id.toString(), email);
  return NextResponse.json({ ok: true });
}
