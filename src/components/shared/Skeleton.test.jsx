import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { BarListSkeleton, ChartSkeleton, DashboardSkeleton, FormSkeleton, ListSkeleton, PageSkeleton, SkeletonRows } from "./Skeleton.jsx";
import LazyCharts from "../dashboard/LazyCharts.jsx";

// Loading placeholders are shaped like the content and never spin
describe("skeleton placeholders", () => {
  test("table rows: one row per row, one cell per column, said once to screen readers", () => {
    const html = renderToString(<table><tbody><SkeletonRows rows={3} cols={4} label="Loading leads" /></tbody></table>);
    expect(html.match(/<tr/g)).toHaveLength(3);
    expect(html.match(/<td/g)).toHaveLength(12);
    expect(html.match(/Loading leads/g)).toHaveLength(1);
  });
  test("every shape pulses (or stays still with reduced motion) and none spins", () => {
    const all = renderToString(
      <>
        <PageSkeleton />
        <DashboardSkeleton />
        <ChartSkeleton />
        <ListSkeleton />
        <BarListSkeleton />
        <FormSkeleton />
      </>,
    );
    expect(all).toContain("animate-pulse");
    expect(all).toContain("motion-reduce:animate-none");
    expect(all).not.toContain("animate-spin");
    expect(all).toContain('role="status"');
  });
  test("charts: a chart-shaped placeholder while the data or the chart code loads", () => {
    expect(renderToString(<LazyCharts ready={false}>{() => null}</LazyCharts>)).toContain("Loading chart");
    // While the chart code downloads: the placeholder; once it is here: the chart
    expect(renderToString(<LazyCharts>{() => <p>chart</p>}</LazyCharts>)).toMatch(/Loading chart|<p>chart<\/p>/);
  });
});
