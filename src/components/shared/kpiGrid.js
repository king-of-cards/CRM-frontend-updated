// KPI grids everywhere: 1 per row on phones, 2 from 640 px, 3 or 4 from 1024 px (3 when the
// cards split evenly into rows of 3, else 4). Pure; returns Tailwind classes (literal strings, so
// Tailwind sees them).
export function kpiGridCols(count) {
  const n = Number(count) || 0;
  if (n <= 1) return "grid-cols-1";
  if (n === 2) return "grid-cols-1 sm:grid-cols-2";
  if (n === 3 || n % 3 === 0) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
}
