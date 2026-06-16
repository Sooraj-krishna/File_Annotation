/**
 * Tests for ErrorBoundary — renders children normally, catches errors.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function GoodChild() {
  return <div>All good</div>;
}

function BadChild(): React.ReactNode {
  throw new Error("💥 crashed");
}

describe("ErrorBoundary", () => {
  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <GoodChild />
      </ErrorBoundary>,
    );
    expect(screen.getByText("All good")).toBeTruthy();
  });

  it("renders fallback UI when a child throws", () => {
    render(
      <ErrorBoundary>
        <BadChild />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeTruthy();
    expect(screen.getByText("💥 crashed")).toBeTruthy();
  });

  it("shows a reload button on error", () => {
    render(
      <ErrorBoundary>
        <BadChild />
      </ErrorBoundary>,
    );
    const btn = screen.getByRole("button", { name: /reload page/i });
    expect(btn).toBeTruthy();
  });
});
