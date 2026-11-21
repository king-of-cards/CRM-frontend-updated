import { Component } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

// Catches a crash inside a page's content so the frame (sidebar, top bar, tabs) stays usable and
// the user sees a message with Retry instead of a blank white page. DashboardLayout gives it a
// key per page, so moving to another page starts afresh.
export default class PageErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.retry = this.retry.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Kept in the console for support; the page shows a friendly message
    console.error("Page crashed:", error, info?.componentStack);
  }

  retry() {
    this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div role="alert" className="mt-6 rounded-3xl bg-white p-8 text-center shadow-lg shadow-gray-200/50 ring-1 ring-gray-100">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <AlertTriangle size={22} aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-gray-900">Something went wrong on this page</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
          The rest of the app still works. Try again, or open another tab.
        </p>
        {error?.message && (
          <p className="mx-auto mt-3 max-w-md break-words rounded-xl bg-gray-50 px-3 py-2 font-mono text-xs text-gray-500">
            {String(error.message)}
          </p>
        )}
        <button
          type="button"
          onClick={this.retry}
          className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-linear-to-r from-brand-600 to-brand-800 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-brand-700/25"
        >
          <RotateCcw size={14} aria-hidden="true" />
          Retry
        </button>
      </div>
    );
  }
}
