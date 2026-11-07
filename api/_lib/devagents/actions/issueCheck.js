import { gh } from "../github.js";
import { cached } from "../limits.js";
import { aiPolicy, claimStatus, paymentClaim, repoRules } from "../rules.js";
import { parseTarget } from "../target.js";

const POLICY_FILES = [
  "CONTRIBUTING.md",
  ".github/CONTRIBUTING.md",
  "AI_POLICY.md",
  "CODE_OF_CONDUCT.md",
];
const DAY_SECONDS = 24 * 60 * 60;

const CLAIM_COMMENT =
  "Hi! I'd like to work on this issue. Is it still available? This would be one of my first contributions, so any pointers are very welcome.";

// Reads a project's policy and rules. Results are kept until its code changes.
export function readRepoPolicy(token, repo, sha) {
  if (!sha) return Promise.resolve({ aiPolicy: "unknown", rules: [] });

  return cached(`da:v1:policy:${repo.toLowerCase()}:${sha}`, DAY_SECONDS, async () => {
    const texts = await Promise.all(
      POLICY_FILES.map((path) => gh.readFile(token, repo, path, sha)),
    );
    return {
      aiPolicy: aiPolicy(texts),
      rules: repoRules(texts.filter(Boolean).join("\n")),
    };
  });
}

export async function issueCheck(ctx, payload) {
  const { repo, issue: number } = parseTarget(payload);
  const [issue, repoInfo, comments, linkedPulls] = await Promise.all([
    gh.readIssue(ctx.token, repo, number),
    gh.readRepo(ctx.token, repo),
    gh.readComments(ctx.token, repo, number),
    gh.readLinkedPulls(ctx.token, repo, number),
  ]);
  const policy = await readRepoPolicy(ctx.token, repo, repoInfo.sha);

  return {
    ...claimStatus({ issue, comments, linkedPulls, now: Date.now() }),
    ...policy,
    title: issue.title,
    archived: repoInfo.archived,
    paymentClaim: paymentClaim(`${issue.title ?? ""} ${issue.body ?? ""}`),
    claimComment: CLAIM_COMMENT,
  };
}
