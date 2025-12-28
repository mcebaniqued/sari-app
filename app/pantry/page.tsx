import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/jwt";
import PantryClient from "./PantryClient";
import { LogoutButton } from "@/components/LogoutButton";

export default async function PantryPage() {
  const auth = await getAuth();
  if (!auth) redirect("/login");

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pantry</h1>
          <p className="text-sm text-gray-600">Signed in as {auth.email}</p>
        </div>
        <LogoutButton />
      </header>

      <PantryClient />
    </main>
  );
}
