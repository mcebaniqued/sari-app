import { LuLeaf } from "react-icons/lu";
import { Link, Route, Routes } from "react-router-dom";

export default function App() {
  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <header className="mx-auto flex max-w-5xl items-center px-6 py-7 sm:px-10">
        <Link
          to="/"
          className="flex items-center gap-2 text-xl font-semibold tracking-tight"
        >
          <LuLeaf aria-hidden="true" className="text-accent" />
          Sari
        </Link>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-16 sm:px-10 sm:py-24">
        <Routes>
          <Route
            path="/"
            element={
              <div className="max-w-xl">
                <p className="mb-5 text-sm font-medium uppercase tracking-widest text-accent">
                  A little less waste
                </p>
                <h1 className="text-4xl leading-tight font-medium tracking-tight sm:text-6xl">
                  Your kitchen,
                  <br />a little clearer.
                </h1>
                <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
                  A simple home for the food you have. Your pantry starts here.
                </p>
                <p className="mt-12 border-t border-line pt-5 text-sm text-muted">
                  Food tracking is coming soon.
                </p>
              </div>
            }
          />
          <Route
            path="*"
            element={
              <div>
                <h1 className="text-3xl font-medium tracking-tight">
                  Page not found
                </h1>
                <Link
                  to="/"
                  className="mt-6 inline-block text-accent underline underline-offset-4"
                >
                  Back to Sari
                </Link>
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
