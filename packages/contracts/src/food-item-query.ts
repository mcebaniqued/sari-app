import { z } from "zod";

const foodSortFieldSchema = z.enum([
  "name",
  "quantity",
  "unit",
  "expiresOn",
  "createdAt",
]);
const blankOperators = ["blank", "notBlank"] as const;
const comparisons = [
  "equals",
  "notEqual",
  "lessThan",
  "lessThanOrEqual",
  "greaterThan",
  "greaterThanOrEqual",
  "inRange",
  ...blankOperators,
] as const;

const textFilter = z
  .strictObject({
    filterType: z.literal("text"),
    type: z.enum([
      "contains",
      "notContains",
      "equals",
      "notEqual",
      "startsWith",
      "endsWith",
      ...blankOperators,
    ]),
    filter: z.string().max(120).nullable().optional(),
  })
  .refine(
    (value) =>
      value.type === "blank" ||
      value.type === "notBlank" ||
      typeof value.filter === "string",
    "A text filter value is required.",
  );

const numberFilter = z
  .strictObject({
    filterType: z.literal("number"),
    type: z.enum(comparisons),
    filter: z.number().nullable().optional(),
    filterTo: z.number().nullable().optional(),
  })
  .refine(
    (value) =>
      value.type === "blank" ||
      value.type === "notBlank" ||
      typeof value.filter === "number",
    "A number filter value is required.",
  )
  .refine(
    (value) =>
      value.type !== "inRange" ||
      (typeof value.filterTo === "number" &&
        typeof value.filter === "number" &&
        value.filterTo >= value.filter),
    "Provide an ordered numeric range.",
  );

// AG Grid sends calendar dates with a midnight suffix. Normalize them at the boundary.
const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(?: 00:00:00)?$/)
  .transform((value) => value.slice(0, 10))
  .pipe(z.iso.date());
const dateFilter = z
  .strictObject({
    filterType: z.literal("date"),
    type: z.enum(comparisons),
    dateFrom: calendarDate.nullable().optional(),
    dateTo: calendarDate.nullable().optional(),
  })
  .refine(
    (value) =>
      value.type === "blank" ||
      value.type === "notBlank" ||
      Boolean(value.dateFrom),
    "A date filter value is required.",
  )
  .refine(
    (value) =>
      value.type !== "inRange" ||
      Boolean(value.dateFrom && value.dateTo && value.dateTo >= value.dateFrom),
    "Provide an ordered date range.",
  );

function jsonParameter(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  if (value.length > 6000) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(value);

    return parsed;
  } catch {
    return undefined;
  }
}

const sortSchema = z
  .array(
    z.strictObject({
      colId: foodSortFieldSchema,
      sort: z.enum(["asc", "desc"]),
    }),
  )
  .max(5)
  .refine(
    (value) => new Set(value.map((sort) => sort.colId)).size === value.length,
    "Sort columns must be unique.",
  );
const filtersSchema = z.strictObject({
  name: textFilter.optional(),
  quantity: numberFilter.optional(),
  unit: textFilter.optional(),
  expiresOn: dateFilter.optional(),
  createdAt: dateFilter.optional(),
});

export const foodItemQuerySchema = z.strictObject({
  start: z.coerce.number().int().min(0).max(1_000_000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).default(""),
  sort: z.preprocess(jsonParameter, sortSchema).default([]),
  filters: z.preprocess(jsonParameter, filtersSchema).default({}),
});

export type FoodItemQuery = z.infer<typeof foodItemQuerySchema>;
