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

// { value, count } for an object (or objects) with conversion_amount_count / _total,
// e.g. kpis, or the Wedding + Wedding planner outcomes summed. null / missing parts are skipped.
export function aovOf(...parts) {
  let count = 0;
  let total = 0;
  for (const part of parts) {
    if (!part) continue;
    count += Number(part.conversion_amount_count) || 0;
    total += Number(part.conversion_amount_total) || 0;
  }
  return { value: aov(count, total), count };
}
