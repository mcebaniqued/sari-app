/**
 * Convert a value to a timestamp (milliseconds since epoch).
 * @param value - The value to convert (string, number, or Date).
 * @returns The timestamp in milliseconds.
 */
export function toTime(value?: string | number | Date) {
  return value ? new Date(value).getTime() : 0;
}

/**
 * Compare two numbers in descending order.
 * @param a - First number.
 * @param b - Second number.
 * @returns A negative number if b > a, positive if a > b, or zero if equal.
 */
export function compareDesc(a: number, b: number) {
  return b - a;
}

/**
 * Compare two numbers in ascending order.
 * @param a - First number.
 * @param b - Second number.
 * @returns A negative number if a < b, positive if b < a, or zero if equal.
 */
export function compareAsc(a: number, b: number) {
  return a - b;
}

/**
 * Compare two strings in alphabetical order (A-Z), case-insensitive.
 * @param a - First string.
 * @param b - Second string.
 * @returns A negative number if a < b, positive if a > b, or zero if equal.
 */
export function compareNameAZ(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}