const units = {
  g: { dimension: "mass", imperial: false, factor: 1 },
  kg: { dimension: "mass", imperial: false, factor: 1000 },
  ml: { dimension: "volume", imperial: false, factor: 1 },
  l: { dimension: "volume", imperial: false, factor: 1000 },
  // U.S. customary factors in grams/milliliters, per NIST SP 811 Appendix B.8.
  // These only validate printed equivalents; autofill never invents a conversion.
  oz: { dimension: "mass", imperial: true, factor: 28.349523125 },
  lb: { dimension: "mass", imperial: true, factor: 453.59237 },
  "fl oz": { dimension: "volume", imperial: true, factor: 29.5735295625 },
} as const;

const unitAliases: Record<string, keyof typeof units> = {
  g: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  oz: "oz",
  onz: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  floz: "fl oz",
};

function measurement(value: string | undefined) {
  const match = value?.match(
    /^\s*(\d+(?:\.\d+)?)\s*(g|grams?|kg|kilograms?|ml|millilit(?:er|re)s?|l|lit(?:er|re)s?|oz|onz|ounces?|lb|lbs|pounds?|fl\s*oz)\s*$/i,
  );
  if (!match?.[1] || !match[2]) {
    return null;
  }

  const quantity = Number(match[1]);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) {
    return null;
  }

  const name = match[2].toLowerCase().replace(/\s/g, "");
  const unit = unitAliases[name];
  if (!unit) {
    return null;
  }

  return { quantity, unit, ...units[unit] };
}

/** Recognize explicit sizes and equivalent dual-unit labels; leave multipacks manual. */
export function parsePackageSize(description: string | null | undefined) {
  const empty = { packageQuantity: null, packageUnit: null };
  const single = measurement(description ?? undefined);
  if (single) {
    return { packageQuantity: single.quantity, packageUnit: single.unit };
  }

  const pair = description?.match(/^(.+?)\s*(?:\/\s*(.+)|\(\s*(.+)\s*\))$/);
  if (!pair) {
    return empty;
  }

  const left = measurement(pair[1]);
  const right = measurement(pair[2] ?? pair[3]);
  if (!left || !right) {
    return empty;
  }

  if (left.dimension !== right.dimension || left.imperial === right.imperial) {
    return empty;
  }

  const imperial = left.imperial ? left : right;
  const metric = left.imperial ? right : left;
  const imperialAmount = imperial.quantity * imperial.factor;
  const metricAmount = metric.quantity * metric.factor;
  // A narrow 2% allowance handles rounded equivalents such as 1 fl oz / 30 mL.
  const tolerance = Math.max(imperialAmount, metricAmount) * 0.02;
  if (Math.abs(imperialAmount - metricAmount) > tolerance) {
    return empty;
  }

  return { packageQuantity: imperial.quantity, packageUnit: imperial.unit };
}
