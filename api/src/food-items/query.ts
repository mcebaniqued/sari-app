import type { FoodItemQuery } from "@sari/contracts";

type Predicate = Record<string, unknown>;

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function textPredicate(
  field: string,
  filter: NonNullable<FoodItemQuery["filters"]["name"]>,
): Predicate {
  if (filter.type === "blank") {
    return { [field]: { $in: [null, ""] } };
  }

  if (filter.type === "notBlank") {
    return { [field]: { $nin: [null, ""] } };
  }

  let value = filter.filter ?? "";
  if (field === "unit" && value.toLowerCase() === "items") {
    value = "item";
  }
  const literal = escapeRegex(value);
  const pattern =
    filter.type === "equals" || filter.type === "notEqual"
      ? `^${literal}$`
      : filter.type === "startsWith"
        ? `^${literal}`
        : filter.type === "endsWith"
          ? `${literal}$`
          : literal;
  const regex = new RegExp(pattern, "i");

  return {
    [field]:
      filter.type === "notEqual" || filter.type === "notContains"
        ? { $not: regex }
        : regex,
  };
}

function numberPredicate(
  filter: NonNullable<FoodItemQuery["filters"]["quantity"]>,
): Predicate {
  switch (filter.type) {
    case "blank":
      // Quantity is required, so a blank filter must match no documents.
      return { _id: { $exists: false } };
    case "notBlank":
      return {};
    case "equals":
      return { quantity: filter.filter };
    case "notEqual":
      return { quantity: { $ne: filter.filter } };
    case "lessThan":
      return { quantity: { $lt: filter.filter } };
    case "lessThanOrEqual":
      return { quantity: { $lte: filter.filter } };
    case "greaterThan":
      return { quantity: { $gt: filter.filter } };
    case "greaterThanOrEqual":
      return { quantity: { $gte: filter.filter } };
    case "inRange":
      return { quantity: { $gte: filter.filter, $lte: filter.filterTo } };
  }
}

function datePredicate(
  field: "expiresOn" | "createdAt",
  filter: NonNullable<FoodItemQuery["filters"]["expiresOn"]>,
): Predicate {
  if (filter.type === "blank") {
    return { [field]: null };
  }

  if (filter.type === "notBlank") {
    return { [field]: { $ne: null } };
  }

  const date = filter.dateFrom;
  if (!date) {
    throw new Error("Date filter was not validated.");
  }

  if (field === "expiresOn") {
    switch (filter.type) {
      case "equals":
        return { expiresOn: date };
      case "notEqual":
        return { expiresOn: { $nin: [date, null] } };
      case "lessThan":
        return { expiresOn: { $lt: date, $ne: null } };
      case "lessThanOrEqual":
        return { expiresOn: { $lte: date, $ne: null } };
      case "greaterThan":
        return { expiresOn: { $gt: date } };
      case "greaterThanOrEqual":
        return { expiresOn: { $gte: date } };
      case "inRange":
        return { expiresOn: { $gte: date, $lte: filter.dateTo } };
    }
  }
  // Calendar filters on timestamps cover a UTC day with an exclusive upper bound.
  const from = new Date(`${date}T00:00:00.000Z`);

  const nextDay = (value: Date) => new Date(value.getTime() + 86_400_000);

  switch (filter.type) {
    case "equals":
      return { createdAt: { $gte: from, $lt: nextDay(from) } };
    case "notEqual":
      return {
        $or: [
          { createdAt: { $lt: from } },
          { createdAt: { $gte: nextDay(from) } },
        ],
      };
    case "lessThan":
      return { createdAt: { $lt: from } };
    case "lessThanOrEqual":
      return { createdAt: { $lt: nextDay(from) } };
    case "greaterThan":
      return { createdAt: { $gte: nextDay(from) } };
    case "greaterThanOrEqual":
      return { createdAt: { $gte: from } };
    case "inRange":
      return {
        createdAt: {
          $gte: from,
          $lt: nextDay(new Date(`${filter.dateTo ?? date}T00:00:00.000Z`)),
        },
      };
  }
}

/** Translate an already validated whitelist of filters into MongoDB predicates. */
export function foodMongoQuery(query: FoodItemQuery) {
  const clauses: Predicate[] = [];
  if (query.search) {
    clauses.push({ name: new RegExp(escapeRegex(query.search), "i") });
  }
  const { filters } = query;
  if (filters.name) {
    clauses.push(textPredicate("name", filters.name));
  }
  if (filters.unit) {
    clauses.push(textPredicate("unit", filters.unit));
  }
  if (filters.quantity) {
    clauses.push(numberPredicate(filters.quantity));
  }
  if (filters.expiresOn) {
    clauses.push(datePredicate("expiresOn", filters.expiresOn));
  }
  if (filters.createdAt) {
    clauses.push(datePredicate("createdAt", filters.createdAt));
  }
  const sort: Record<string, 1 | -1> = {};
  if (query.sort.length) {
    for (const item of query.sort) {
      sort[item.colId] = item.sort === "asc" ? 1 : -1;
    }
  } else {
    sort.expiresOn = 1;
  }
  const expirationFirst =
    query.sort.length === 0 || query.sort[0]?.colId === "expiresOn";
  // Deterministic ties keep page boundaries stable when several values are equal.
  sort._id = expirationFirst ? (sort.expiresOn ?? 1) : -1;

  return {
    filter: clauses.length ? { $and: clauses } : {},
    sort,
    expirationFirst,
  };
}
