import { gh } from "../github.js";
import { cached } from "../limits.js";
import { parseTarget } from "../target.js";
import { READ_FILES, findTestCommands } from "../testCommands.js";

const DAY_SECONDS = 24 * 60 * 60;

// The command that runs the project's tests, kept until its code changes.
export async function testCommand(ctx, payload) {
  const { repo } = parseTarget(payload);
  const { sha } = await gh.readRepo(ctx.token, repo);
  if (!sha) return { commands: [] };

  return cached(`da:v1:test-command:${repo.toLowerCase()}:${sha}`, DAY_SECONDS, async () => {
    const names = await gh.readRootNames(ctx.token, repo, sha);
    const present = READ_FILES.filter((name) => names.includes(name));
    const texts = await Promise.all(present.map((name) => gh.readFile(ctx.token, repo, name, sha)));
    const files = Object.fromEntries(present.map((name, index) => [name, texts[index]]));
    return { commands: findTestCommands(names, files) };
  });
}
