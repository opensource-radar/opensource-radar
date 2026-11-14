// @vitest-environment jsdom
import { cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import IssueCard from "../../src/components/IssueCard.jsx";
import { useAiAbouts, withAbout } from "../../src/lib/projectAbout.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const card = (project) =>
  render(<IssueCard title="Fix it" label="good first issue" repo="a / b" url="https://github.com/a/b/issues/1" project={project} />);

describe("project one-liner", () => {
  it("shows the project's own description, and marks an AI summary", () => {
    card({ about: "A fast linter." });
    expect(screen.getByText("A fast linter.")).toBeTruthy();
    expect(screen.queryByText(/AI summary/)).toBeNull();
    cleanup();
    card(withAbout({ about: null }, { about: "Makes charts.", ai: true }));
    expect(screen.getByText(/AI summary/)).toBeTruthy();
  });

  it("asks for AI summaries only for projects without a description, three at most", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ about: "Summary.", ai: true })));
    const projects = {
      "a/has": { about: "Own words." },
      "a/old": {},
      "a/gone": { missing: true },
      "a/shut": { about: null, archived: true },
      ...Object.fromEntries(["n1", "n2", "n3", "n4"].map((n) => [`a/${n}`, { about: null }])),
    };
    const { result } = renderHook(() => useAiAbouts(projects, Object.keys(projects).join(",")));
    await waitFor(() => expect(Object.keys(result.current)).toHaveLength(3));
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/api/about?repo=a%2Fn1", "/api/about?repo=a%2Fn2", "/api/about?repo=a%2Fn3"]);
  });
});
