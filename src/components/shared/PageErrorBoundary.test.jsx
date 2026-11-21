import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import PageErrorBoundary from "./PageErrorBoundary.jsx";

describe("page error boundary", () => {
  test("no error: the page renders as usual", () => {
    expect(renderToString(<PageErrorBoundary><p>Lead list</p></PageErrorBoundary>)).toContain("Lead list");
  });
  test("after a crash: a message, the error and a Retry button instead of a white page", () => {
    const boundary = new PageErrorBoundary({ children: <p>Lead list</p> });
    boundary.state = PageErrorBoundary.getDerivedStateFromError(new Error("null is not an object (evaluating 'options.cities')"));
    const html = renderToString(boundary.render());
    expect(html).toContain("Something went wrong on this page");
    expect(html).toContain("options.cities");
    expect(html).toContain("Retry");
    expect(html).not.toContain("Lead list");
  });
  test("Retry clears the error so the page renders again", () => {
    const boundary = new PageErrorBoundary({ children: <p>Lead list</p> });
    boundary.state = { error: new Error("boom") };
    boundary.setState = (next) => { boundary.state = { ...boundary.state, ...next }; };
    boundary.retry();
    expect(renderToString(boundary.render())).toContain("Lead list");
  });
});
