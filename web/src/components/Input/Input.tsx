import type { ComponentProps } from "react";

export default function Input({
  className = "",
  ...props
}: ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={`min-h-[2.875rem] w-full min-w-0 appearance-none rounded-control border border-border-control bg-surface px-3 py-2.5 text-base text-content placeholder:text-content-muted focus:border-brand focus:outline-2 focus:outline-offset-1 focus:outline-brand disabled:opacity-50 ${className}`}
    />
  );
}
