// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import AboutPage from "../src/components/AboutPage.jsx";

afterEach(cleanup);

describe("About page privacy", () => {
  it("says what DevAgents sends and stores", () => {
    render(<AboutPage />);
    expect(screen.getByText(/third-party AI providers/i)).toBeTruthy();
    expect(screen.getByText(/saved AI answers/i)).toBeTruthy();
  });

  it("says visits are counted, and that searches aren't sent", () => {
    render(<AboutPage />);
    expect(screen.getByText(/Vercel Web Analytics/i)).toBeTruthy();
    expect(screen.getByText(/not what you search for/i)).toBeTruthy();
  });
});
