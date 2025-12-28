import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/jwt";

export default async function HomePage() {
  const auth = await getAuth();
  redirect(auth ? "/pantry" : "/login");
}
