export function PageContainer({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  /**
   * v0: centered, app-like container.
   * Later: change to `max-w-none` and adjust padding once, globally.
   */
  return (
    <div
      className={[
        "mx-auto w-full max-w-md px-4 py-4",
        "sm:max-w-xl md:max-w-3xl lg:max-w-5xl",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}
