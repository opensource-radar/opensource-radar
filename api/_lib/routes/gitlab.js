import { fetchGitLabIssues } from "../gitlab.js";
import { json } from "../session.js";
import { redis, storeAvailable } from "../store.js";

const CACHE_SECONDS = 15 * 60;
const LANGUAGE = /^[\w+#. -]{0,40}$/;
const MAX_WORDS = 100;
const cacheKey = (language, words) => `gitlab:v1:${language.toLowerCase()}:${words.toLowerCase()}`;

// GET /api/gitlab?language=Go&q=words
// Beginner issues from a curated list of GitLab projects (api/_lib/gitlab.js),
// newest activity first. Shared answers are cached for 15 minutes.
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const language = (params.get("language") || "").trim();
  const words = (params.get("q") || "").trim().slice(0, MAX_WORDS);
  if (!LANGUAGE.test(language)) return json({ error: "invalid_language" }, [], 400);

  const key = cacheKey(language, words);
  if (storeAvailable()) {
    try {
      const cached = await redis(["GET", key]);
      if (cached) return json(JSON.parse(cached));
    } catch {
      // Ask GitLab instead.
    }
  }

  let issues;
  try {
    issues = await fetchGitLabIssues({ language, words, token: process.env.GITLAB_TOKEN || "" });
  } catch {
    return json({ issues: [], error: "gitlab_error" }, [], 502);
  }

  const body = { issues };
  if (storeAvailable()) {
    try {
      await redis(["SET", key, JSON.stringify(body), "EX", CACHE_SECONDS]);
    } catch {
      // Not cached this time.
    }
  }
  return json(body);
}
