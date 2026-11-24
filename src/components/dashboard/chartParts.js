// The parts of the chart library the dashboards use, loaded together by LazyCharts.jsx.
// Named re-exports keep the download to these parts (a plain import("recharts") would bring the
// whole library). Add a name here before using it in a <LazyCharts> render function.
export {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
