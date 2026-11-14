// Finds the command that runs a project's tests, from the files at the top of
// the repository. Simple rules, no AI, so it can't make a command up.

// Files whose contents the rules read. Everything else is judged by name.
export const READ_FILES = ["package.json", "Makefile", "makefile", "justfile", "pyproject.toml", "setup.cfg", "tox.ini", "composer.json"];
const MAX_COMMANDS = 4;
const NPM_PLACEHOLDER = /no test specified/i;

const parseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

function javascript(names, files) {
  const pkg = parseJson(files["package.json"] ?? "");
  if (!pkg?.scripts) return [];
  const runner = names.has("pnpm-lock.yaml")
    ? "pnpm"
    : names.has("yarn.lock")
      ? "yarn"
      : names.has("bun.lockb") || names.has("bun.lock")
        ? "bun run"
        : "npm";
  const run = (script) => (runner === "npm" && script !== "test" ? `npm run ${script}` : `${runner} ${script}`);
  const found = [];
  if (typeof pkg.scripts.test === "string" && !NPM_PLACEHOLDER.test(pkg.scripts.test)) {
    found.push({ command: run("test"), source: "package.json (scripts.test)" });
  }
  if (typeof pkg.scripts.lint === "string") found.push({ command: run("lint"), source: "package.json (scripts.lint)" });
  return found;
}

function python(names, files) {
  if (names.has("tox.ini")) return [{ command: "tox", source: "tox.ini" }];
  if (names.has("noxfile.py")) return [{ command: "nox", source: "noxfile.py" }];
  const config = `${files["pyproject.toml"] ?? ""}\n${files["setup.cfg"] ?? ""}`;
  const usesPytest = /pytest/i.test(config) || names.has("pytest.ini") || names.has("conftest.py");
  if (!usesPytest) return [];
  const prefix = names.has("uv.lock") ? "uv run " : /\[tool\.poetry\]/.test(config) ? "poetry run " : "";
  return [{ command: `${prefix}pytest`, source: names.has("pytest.ini") ? "pytest.ini" : "pyproject.toml or setup.cfg" }];
}

function byName(names, files) {
  const found = [];
  const has = (name) => names.has(name);
  if (has("Cargo.toml")) found.push({ command: "cargo test", source: "Cargo.toml" });
  if (has("go.mod")) found.push({ command: "go test ./...", source: "go.mod" });
  if (has("pom.xml")) found.push({ command: has("mvnw") ? "./mvnw test" : "mvn test", source: "pom.xml" });
  if (has("build.gradle") || has("build.gradle.kts")) {
    found.push({ command: has("gradlew") ? "./gradlew test" : "gradle test", source: "build.gradle" });
  }
  if (has("mix.exs")) found.push({ command: "mix test", source: "mix.exs" });
  if (has("deno.json") || has("deno.jsonc")) found.push({ command: "deno test", source: "deno.json" });
  if (has("Gemfile")) {
    if (has("spec") || has(".rspec")) found.push({ command: "bundle exec rspec", source: "Gemfile and spec/" });
    else if (has("Rakefile")) found.push({ command: "bundle exec rake test", source: "Gemfile and Rakefile" });
  }
  const composer = parseJson(files["composer.json"] ?? "");
  if (typeof composer?.scripts?.test === "string" || Array.isArray(composer?.scripts?.test)) {
    found.push({ command: "composer test", source: "composer.json (scripts.test)" });
  } else if (has("phpunit.xml") || has("phpunit.xml.dist")) {
    found.push({ command: "vendor/bin/phpunit", source: "phpunit.xml" });
  }
  if ([...names].some((name) => /\.(sln|csproj)$/.test(name))) found.push({ command: "dotnet test", source: ".sln or .csproj" });
  return found;
}

function taskRunners(files) {
  const found = [];
  const makefile = files.Makefile ?? files.makefile ?? "";
  if (/^test\s*:/m.test(makefile)) found.push({ command: "make test", source: "Makefile (test target)" });
  else if (/^check\s*:/m.test(makefile)) found.push({ command: "make check", source: "Makefile (check target)" });
  if (/^test\b[^\n]*:/m.test(files.justfile ?? "")) found.push({ command: "just test", source: "justfile" });
  return found;
}

// `names`: top-level file and folder names. `files`: contents of READ_FILES that exist.
export function findTestCommands(names, files) {
  const nameSet = new Set(names);
  const all = [...taskRunners(files), ...javascript(nameSet, files), ...python(nameSet, files), ...byName(nameSet, files)];
  const seen = new Set();
  return all.filter(({ command }) => !seen.has(command) && seen.add(command)).slice(0, MAX_COMMANDS);
}
