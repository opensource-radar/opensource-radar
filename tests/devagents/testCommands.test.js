import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findTestCommands } from "../../api/_lib/devagents/testCommands.js";
import { callAction, enableDevAgents, fakeWorld } from "./helpers.js";

const commands = (names, files = {}) => findTestCommands(names, files).map((c) => c.command);
const pkg = (scripts) => JSON.stringify({ scripts });

describe("findTestCommands", () => {
  it("uses the project's package manager for JavaScript", () => {
    expect(commands(["package.json"], { "package.json": pkg({ test: "vitest", lint: "eslint ." }) })).toEqual(["npm test", "npm run lint"]);
    expect(commands(["package.json", "pnpm-lock.yaml"], { "package.json": pkg({ test: "jest" }) })).toEqual(["pnpm test"]);
    expect(commands(["package.json", "yarn.lock"], { "package.json": pkg({ test: "jest" }) })).toEqual(["yarn test"]);
  });

  it("skips npm's placeholder test script", () => {
    expect(commands(["package.json"], { "package.json": pkg({ test: 'echo "Error: no test specified" && exit 1' }) })).toEqual([]);
  });

  it("finds pytest, tox and the right runner for Python", () => {
    expect(commands(["pyproject.toml"], { "pyproject.toml": "[tool.pytest.ini_options]" })).toEqual(["pytest"]);
    expect(commands(["pyproject.toml", "uv.lock"], { "pyproject.toml": "[tool.pytest.ini_options]" })).toEqual(["uv run pytest"]);
    expect(commands(["pyproject.toml"], { "pyproject.toml": "[tool.poetry]\n[tool.pytest.ini_options]" })).toEqual(["poetry run pytest"]);
    expect(commands(["tox.ini", "pyproject.toml"], { "pyproject.toml": "pytest" })).toEqual(["tox"]);
  });

  it("knows other languages by their files", () => {
    expect(commands(["Cargo.toml"])).toEqual(["cargo test"]);
    expect(commands(["go.mod"])).toEqual(["go test ./..."]);
    expect(commands(["pom.xml", "mvnw"])).toEqual(["./mvnw test"]);
    expect(commands(["build.gradle.kts", "gradlew"])).toEqual(["./gradlew test"]);
    expect(commands(["Gemfile", "spec"])).toEqual(["bundle exec rspec"]);
    expect(commands(["App.sln"])).toEqual(["dotnet test"]);
  });

  it("puts a Makefile test target first, and never repeats a command", () => {
    expect(commands(["Makefile", "go.mod"], { Makefile: "build:\n\tgo build\ntest:\n\tgo test ./..." })).toEqual(["make test", "go test ./..."]);
  });

  it("finds nothing rather than guessing", () => {
    expect(commands(["README.md", "src"])).toEqual([]);
  });
});

describe("test-command action", () => {
  beforeEach(enableDevAgents);
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reads only the top-level files it needs, and never asks the AI", async () => {
    const world = fakeWorld({
      github: {
        "/repos/a/b": { default_branch: "main" },
        "/repos/a/b/branches/main": { commit: { sha: "abc" } },
        "/repos/a/b/git/trees/abc": { tree: [{ path: "package.json" }, { path: "pnpm-lock.yaml" }, { path: "src" }] },
        "/repos/a/b/contents/package.json": pkg({ test: "vitest" }),
      },
    });
    const { status, body } = await callAction("test-command", { repo: "a/b", issue: 1 });
    expect(status).toBe(200);
    expect(body.data.commands).toEqual([{ command: "pnpm test", source: "package.json (scripts.test)" }]);
    expect(world.llmCalls()).toHaveLength(0);
    expect(world.githubCalls().some((call) => call.url.includes("recursive"))).toBe(false);
  });
});
