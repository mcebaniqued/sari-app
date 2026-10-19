import { useEffect, useId, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";

interface ErrorPageProps {
  title: string;
  description: string;
}

/** Shared recovery UI. A direct visit must never send the user to another site. */
export default function ErrorPage({ title, description }: ErrorPageProps) {
  const navigate = useNavigate();
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} | Sari`;
    heading.current?.focus({ preventScroll: true });
    return () => {
      document.title = previousTitle;
    };
  }, [title]);

  function goBack() {
    // BrowserRouter tracks SPA entries by index; history.length can include other sites.
    const state: unknown = window.history.state;
    const hasPreviousAppPage =
      typeof state === "object" &&
      state !== null &&
      "idx" in state &&
      typeof state.idx === "number" &&
      state.idx > 0;
    if (hasPreviousAppPage) {
      void navigate(-1);
    } else {
      void navigate("/pantry", { replace: true });
    }
  }

  return (
    <section
      aria-labelledby={titleId}
      className="mx-auto max-w-md py-16 sm:py-24"
    >
      <h1
        ref={heading}
        id={titleId}
        tabIndex={-1}
        className="text-2xl font-semibold tracking-tight outline-none"
      >
        {title}
      </h1>
      <p className="mt-3 text-sm leading-6 text-content-muted">{description}</p>
      <div className="mt-6 flex flex-wrap items-center gap-5">
        <Link
          to="/pantry"
          replace
          className="inline-flex min-h-11 items-center justify-center rounded-control bg-brand px-4 py-2.5 text-sm font-medium text-content-inverse hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Back to pantry
        </Link>
        <button
          type="button"
          onClick={goBack}
          className="min-h-11 rounded-control text-sm text-content-muted underline underline-offset-4 hover:text-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Go back
        </button>
      </div>
    </section>
  );
}
