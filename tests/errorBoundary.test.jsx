// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ErrorBoundary from "../src/components/ErrorBoundary.jsx";

function Boom() {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows the fallback instead of crashing when a child throws", () => {
    render(
      <div>
        site
        <ErrorBoundary fallback={<p>help unavailable</p>}>
          <Boom />
        </ErrorBoundary>
      </div>,
    );
    expect(screen.getByText("site")).toBeTruthy();
    expect(screen.getByText("help unavailable")).toBeTruthy();
  });

  it("retry renders the children again", () => {
    let shouldThrow = true;
    function Flaky() {
      if (shouldThrow) throw new Error("once");
      return <p>recovered</p>;
    }
    render(
      <ErrorBoundary
        fallback={({ retry }) => (
          <button
            type="button"
            onClick={() => {
              shouldThrow = false;
              retry();
            }}
          >
            Try again
          </button>
        )}
      >
        <Flaky />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("recovered")).toBeTruthy();
  });

  it("renders nothing for fallback={null}", () => {
    const { container } = render(
      <ErrorBoundary fallback={null}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(container.innerHTML).toBe("");
  });
});
