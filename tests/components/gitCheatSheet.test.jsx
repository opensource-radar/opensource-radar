// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import GitCheatSheet from "../../src/components/GitCheatSheet.jsx";
import { gitCommands } from "../../src/lib/gitCommands.js";

afterEach(cleanup);

describe("gitCommands", () => {
  it("gives the exact commands for one issue, with the language's own steps", () => {
    const steps = gitCommands({ repo: "acme/widgets", number: 42, language: "Python" });
    const commands = steps.map((step) => step.command);
    expect(commands[0]).toBe("git clone https://github.com/YOUR-USERNAME/widgets.git");
    expect(commands).toContain("cd widgets");
    expect(commands).toContain("git remote add upstream https://github.com/acme/widgets.git");
    expect(commands).toContain("git checkout -b fix-issue-42");
    expect(commands).toContain('git add -A\ngit commit -m "Fix #42"');
    expect(commands.at(-1)).toBe("git push -u origin fix-issue-42");
    // Python's install and test commands come from its language page.
    expect(commands.some((command) => /pip|pytest|python/.test(command))).toBe(true);
  });

  it("uses the person's own fork when their username is known", () => {
    expect(gitCommands({ repo: "acme/widgets", number: 1, login: "sam" })[0].command).toBe(
      "git clone https://github.com/sam/widgets.git",
    );
  });

  it("leaves out project commands for a language it doesn't know", () => {
    expect(gitCommands({ repo: "acme/widgets", number: 1, language: "Brainfuck" })).toHaveLength(6);
  });
});

describe("GitCheatSheet", () => {
  it("shows each command with a copy button, plus copy all and a fork link", () => {
    render(<GitCheatSheet repo="acme/widgets" number={42} language="JavaScript" />);
    expect(screen.getByText("Prefer the command line? Git commands for this issue")).toBeTruthy();
    expect(screen.getByText("git checkout -b fix-issue-42")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Copy" }).length).toBeGreaterThan(5);
    expect(screen.getByRole("button", { name: "Copy all" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /fork acme\/widgets/ }).getAttribute("href")).toBe("https://github.com/acme/widgets/fork");
  });
});
