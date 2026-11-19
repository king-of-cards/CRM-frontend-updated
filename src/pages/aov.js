// AOV (average order value): conversion_amount_total ÷ conversion_amount_count, i.e. the
// average conversion amount of the converted leads that have one (docs section 9:
// conversion_amount_count / conversion_amount_total). Pure, no React.

// The list filters for exactly those leads: converted, with a conversion amount
export const AOV_FILTERS = Object.freeze({ update_status: "converted", conversion: "has" });

// Average in rupees, or null when there is nothing to average
export function aov(count, total) {
  const n = Number(count);
  const sum = Number(total);
  if (!Number.isFinite(n) || n <= 0 || !Number.isFinite(sum)) return null;
  return sum / n;
}

// { value, count } for a dashboard's kpis (conversion_amount_count / _total); null / missing: no value
export function aovOf(kpis) {
  const count = Number(kpis?.conversion_amount_count) || 0;
  return { value: aov(count, kpis?.conversion_amount_total), count };
}
