// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ErrorHelp from "../../src/devagents/sections/ErrorHelp.jsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ErrorHelp", () => {
  it("sends only the end of a very long log, starting on a whole word", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: { meaning: "m", nextSteps: [] } })));
    render(<ErrorHelp issue={{ repo: "a/b", issue: 1 }} />);
    const log = `${"start ".repeat(9000)}ghp_halfcutTOKEN the end`;
    fireEvent.change(screen.getByLabelText(/your error message/i), { target: { value: log } });
    fireEvent.click(screen.getByRole("button", { name: "Explain this error" }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const { errorText } = JSON.parse(fetch.mock.calls[0][1].body);
    expect(errorText.length).toBeLessThanOrEqual(8000);
    expect(errorText.endsWith("the end")).toBe(true);
    expect(errorText.startsWith("start ")).toBe(true);
    await screen.findByText("m");
  });
});

describe("ErrorHelp's next steps", () => {
  it("warns to check AI-written commands before running them", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: { meaning: "m", nextSteps: ["run x"] } })));
    render(<ErrorHelp issue={{ repo: "a/b", issue: 1 }} />);
    fireEvent.change(screen.getByLabelText(/your error message/i), { target: { value: "boom" } });
    fireEvent.click(screen.getByRole("button", { name: "Explain this error" }));
    await screen.findByText(/check every command against the project's own docs/i);
  });
});

describe("ErrorHelp in setup mode", () => {
  it("asks whether setup worked and shows the verdict", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: { worked: "no", meaning: "A package is missing.", nextSteps: [] } })));
    render(<ErrorHelp issue={{ repo: "a/b", issue: 1 }} mode="setup" />);
    fireEvent.change(screen.getByLabelText("What your terminal printed"), { target: { value: "ModuleNotFoundError" } });
    fireEvent.click(screen.getByRole("button", { name: "Check my setup" }));
    await screen.findByText("It doesn't look like it worked yet");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ mode: "setup", errorText: "ModuleNotFoundError" });
    expect(screen.queryByText(/AI-written/)).toBeNull();
  });
});
