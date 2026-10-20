export function safeReturnPath(value: unknown) {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    // eslint-disable-next-line no-control-regex -- Browsers strip some control characters when resolving URLs; reject them before redirecting.
    !/[\u0000-\u0020]/.test(value) &&
    !/^\/(?:login|register)(?:[/?#]|$)/.test(value)
    ? value
    : "/pantry";
}
