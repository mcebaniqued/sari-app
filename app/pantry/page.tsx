import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/jwt";
import { LogoutButton } from "@/components/LogoutButton";

export default async function PantryPage() {
  const auth = await getAuth();
  if (!auth) redirect("/login");

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Pantry</h1>
      <p className="text-sm">Logged in as: {auth.email}</p>

      <form action="/api/auth/logout" method="post">
        <LogoutButton />
      </form>
    </main>
  );
}
