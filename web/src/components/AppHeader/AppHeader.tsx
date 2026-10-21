import { LuLeaf } from "react-icons/lu";
import { Link } from "react-router-dom";
import UserMenu from "./UserMenu";

export default function AppHeader({
  firstName,
  onLogout,
  hiddenOnMobile = false,
}: {
  firstName: string | undefined;
  onLogout: () => Promise<void>;
  hiddenOnMobile?: boolean;
}) {
  return (
    <header
      className={`sticky top-0 z-30 border-b border-border-default bg-surface transition-transform duration-200 motion-reduce:transition-none md:translate-y-0 ${hiddenOnMobile ? "-translate-y-full" : "translate-y-0"}`}
    >
      <div className="mx-auto flex h-18 max-w-360 items-center gap-8 px-4 sm:px-8 lg:px-12">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-xl font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-content-inverse">
            <LuLeaf aria-hidden="true" className="size-5" />
          </span>
          Sari
        </Link>
        {firstName ? (
          <nav aria-label="User navigation" className="ml-auto">
            <UserMenu firstName={firstName} onLogout={onLogout} />
          </nav>
        ) : null}
      </div>
    </header>
  );
}
