import { lazy, Suspense } from "react";
import { ChartSkeleton } from "../shared/Skeleton.jsx";

// The chart library (recharts, the biggest dependency) loads on its own, after the page:
// the dashboards' numbers show first and each chart shows a chart-shaped placeholder meanwhile.
//   <LazyCharts>{({ ResponsiveContainer, BarChart, Bar }) => <ResponsiveContainer>…</ResponsiveContainer>}</LazyCharts>
// ready={false}: the data is still loading, so the placeholder stays.

export const loadCharts = () => import("./chartParts.js");

const Charts = lazy(() => loadCharts().then((recharts) => ({ default: ({ children }) => children(recharts) })));

export default function LazyCharts({ ready = true, children }) {
  if (!ready) return <ChartSkeleton />;
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <Charts>{children}</Charts>
    </Suspense>
  );
}
