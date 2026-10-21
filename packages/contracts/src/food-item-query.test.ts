import { describe, expect, it } from "vitest";
import { foodItemQuerySchema } from "./food-item-query.js";

describe("pantry query boundaries", () => {
  it("supplies paging defaults and normalizes browser query strings", () => {
    expect(foodItemQuerySchema.parse({})).toEqual({
      start: 0,
      limit: 20,
      search: "",
      sort: [],
      filters: {},
    });
    const result = foodItemQuerySchema.parse({
      start: "20",
      limit: "10",
      search: " rice ",
      sort: '[{"colId":"name","sort":"asc"}]',
      filters:
        '{"expiresOn":{"filterType":"date","type":"equals","dateFrom":"2028-02-29 00:00:00"}}',
    });

    expect(result).toMatchObject({
      start: 20,
      limit: 10,
      search: "rice",
      sort: [{ colId: "name", sort: "asc" }],
    });
    expect(result.filters.expiresOn?.dateFrom).toBe("2028-02-29");
  });

  it.each(["blank", "notBlank"])(
    "accepts %s without a filter value",
    (type) => {
      expect(
        foodItemQuerySchema.safeParse({
          filters: {
            name: { filterType: "text", type },
            quantity: { filterType: "number", type },
            createdAt: { filterType: "date", type },
          },
        }).success,
      ).toBe(true);
    },
  );

  it("accepts ordered numeric and calendar ranges", () => {
    const filters = {
      quantity: {
        filterType: "number",
        type: "inRange",
        filter: 1,
        filterTo: 5,
      },
      createdAt: {
        filterType: "date",
        type: "inRange",
        dateFrom: "2028-02-01",
        dateTo: "2028-02-29",
      },
      name: { filterType: "text", type: "contains", filter: "rice" },
    };
    expect(foodItemQuerySchema.parse({ filters }).filters).toEqual(filters);
  });

  it.each([
    { sort: "broken JSON" },
    { filters: "broken JSON" },
    { sort: " ".repeat(6001) },
    { filters: " ".repeat(6001) },
    { start: -1 },
    { limit: 101 },
    { unknown: true },
    { sort: [{ colId: "$where", sort: "asc" }] },
    {
      sort: [
        { colId: "name", sort: "asc" },
        { colId: "name", sort: "desc" },
      ],
    },
    { filters: { name: { filterType: "text", type: "contains" } } },
    {
      filters: {
        name: { filterType: "text", type: "contains", filter: { $ne: null } },
      },
    },
    { filters: { quantity: { filterType: "number", type: "equals" } } },
    {
      filters: {
        quantity: { filterType: "number", type: "inRange", filter: 1 },
      },
    },
    {
      filters: {
        quantity: {
          filterType: "number",
          type: "inRange",
          filter: 5,
          filterTo: 1,
        },
      },
    },
    { filters: { expiresOn: { filterType: "date", type: "equals" } } },
    {
      filters: {
        expiresOn: {
          filterType: "date",
          type: "equals",
          dateFrom: "2026-02-30",
        },
      },
    },
    {
      filters: {
        expiresOn: {
          filterType: "date",
          type: "inRange",
          dateFrom: "2026-03-01",
          dateTo: "2026-02-01",
        },
      },
    },
  ])("rejects unsafe, malformed, or incomplete queries: %j", (query) => {
    expect(foodItemQuerySchema.safeParse(query).success).toBe(false);
  });
});
