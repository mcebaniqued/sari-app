import type { FoodItem } from "@sari/contracts";

export const foodUnitLabels: Record<FoodItem["unit"], string> = {
  item: "Items",
  g: "Grams (g)",
  kg: "Kilograms (kg)",
  ml: "Milliliters (ml)",
  l: "Liters (l)",
  oz: "Ounces (oz)",
  lb: "Pounds (lb)",
  "fl oz": "Fluid ounces (US fl oz)",
  tsp: "Teaspoons (US tsp)",
  tbsp: "Tablespoons (US tbsp)",
  cup: "Cups (US)",
  pt: "Pints (US pt)",
  qt: "Quarts (US qt)",
  gal: "Gallons (US gal)",
};
