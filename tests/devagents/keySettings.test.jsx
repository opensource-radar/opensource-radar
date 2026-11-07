// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearOwnKey, getOwnKey } from "../../src/devagents/ownKey.js";
import KeySettings from "../../src/devagents/sections/KeySettings.jsx";

const reply = (data) => vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data })));

beforeEach(() => {
  localStorage.clear();
  clearOwnKey();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const fillAndCheck = async (provider = "cerebras") => {
  render(<KeySettings />);
  fireEvent.change(screen.getByLabelText("AI provider"), { target: { value: provider } });
  fireEvent.change(screen.getByLabelText("API key"), { target: { value: "my-key" } });
  fireEvent.click(screen.getByRole("button", { name: "Check key" }));
};

describe("KeySettings", () => {
  it("lists the providers by name, each with a link to get a key", () => {
    render(<KeySettings />);
    const names = [...screen.getByLabelText("AI provider").options].map((o) => o.text);
    expect(names).toEqual(["Groq", "Google Gemini", "Cerebras", "Mistral", "OpenRouter", "OpenAI"]);
    expect(screen.getByRole("link", { name: /get a groq key/i }).getAttribute("href")).toContain("console.groq.com");
  });

  it("changes the link with the provider", () => {
    render(<KeySettings />);
    fireEvent.change(screen.getByLabelText("AI provider"), { target: { value: "mistral" } });
    expect(screen.getByRole("link", { name: /get a mistral key/i }).getAttribute("href")).toContain("mistral.ai");
  });

  it("checks the key with the chosen provider, then lets people pick a model and save", async () => {
    reply({ valid: true, models: ["m-1", "m-2"] });
    await fillAndCheck();
    const model = await screen.findByLabelText("Model");
    expect(getOwnKey()).toBeNull();
    const { headers } = fetch.mock.calls[0][1];
    expect(headers["X-User-LLM-Provider"]).toBe("cerebras");
    fireEvent.change(model, { target: { value: "m-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save key" }));
    expect(getOwnKey()).toEqual({ provider: "cerebras", model: "m-2", key: "my-key" });
    expect(await screen.findByText(/your cerebras key will be used/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove my key" })).toBeTruthy();
    expect(screen.getByLabelText("API key").value).toBe("");
  });

  it("lets people type a model when the list is empty", async () => {
    reply({ valid: true, models: [] });
    await fillAndCheck();
    const model = await screen.findByLabelText("Model name");
    expect(screen.getByRole("button", { name: "Save key" }).disabled).toBe(true);
    fireEvent.change(model, { target: { value: "typed-model" } });
    fireEvent.click(screen.getByRole("button", { name: "Save key" }));
    expect(getOwnKey().model).toBe("typed-model");
  });

  it("says when a key isn't accepted, and saves nothing", async () => {
    reply({ valid: false, models: [] });
    await fillAndCheck("mistral");
    await screen.findByText(/mistral didn't accept that key/i);
    expect(getOwnKey()).toBeNull();
    expect(screen.queryByRole("button", { name: "Save key" })).toBeNull();
  });

  it("says when the check couldn't run, and saves nothing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    await fillAndCheck();
    await screen.findByText(/couldn't check that key/i);
    expect(getOwnKey()).toBeNull();
  });

  it("changing the provider or key means checking again", async () => {
    reply({ valid: true, models: ["m-1"] });
    await fillAndCheck();
    await screen.findByLabelText("Model");
    fireEvent.change(screen.getByLabelText("AI provider"), { target: { value: "groq" } });
    expect(screen.queryByLabelText("Model")).toBeNull();
  });

  it("the key field hides what's typed", () => {
    render(<KeySettings />);
    expect(screen.getByLabelText("API key").type).toBe("password");
  });
});
