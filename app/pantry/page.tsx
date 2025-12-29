import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/jwt";
import PantryClient from "./PantryClient";
import { LogoutButton } from "@/components/LogoutButton";
import { PageContainer } from "@/components/PageContainer";

export default async function PantryPage() {
  const auth = await getAuth();
  if (!auth) redirect("/login");

  return (
    <main className="min-h-full bg-[rgb(var(--background))] text-[rgb(var(--foreground))]">
      <PageContainer>
        <div className="space-y-4">
          {/* Title row */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold">Pantry</h1>
              <p className="text-sm text-[rgb(var(--muted-foreground))] truncate">
                Signed in as {auth.email}
              </p>
            </div>
            <LogoutButton />
          </div>

          <PantryClient />
        </div>
      </PageContainer>
    </main>
  );
}
