import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} environment variable`);
  return v;
}

// Required security invariant
const AUTH_SECRET = requireEnv("AUTH_SECRET");

// Policy / configuration values
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "sariapp_session";
const TTL_DAYS = Number(process.env.AUTH_TTL_DAYS || "30");

const key = new TextEncoder().encode(AUTH_SECRET);

export async function setAuthCookie(userId: string, email: string) {
  const token = await new SignJWT({ sub: userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL_DAYS}d`)
    .sign(key);

  (await cookies()).set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_DAYS * 24 * 60 * 60,
  });
}

export async function clearAuthCookie() {
  (await cookies()).set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getAuth() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, key);
    const userId = typeof payload.sub === "string" ? payload.sub : null;
    const email = typeof payload.email === "string" ? payload.email : null;
    if (!userId || !email) return null;
    return { userId, email };
  } catch {
    return null;
  }
}
