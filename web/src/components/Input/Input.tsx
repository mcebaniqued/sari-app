import type { ComponentProps } from "react";

export default function Input({
  className = "",
  ...props
}: ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={`min-h-11.5 w-full min-w-0 appearance-none rounded-control border border-border-control bg-surface px-3 py-2.5 text-base text-content placeholder:text-content-muted focus-visible:border-brand focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50 ${className}`}
    />
  );
}
