# DevAgents runbook

DevAgents is the optional "Get help with this issue" helper. It only reads public GitHub data and never writes to GitHub. The rest of the site doesn't depend on it.

## Setting it up

1. Create a separate Upstash Redis database, and set `DEVAGENTS_REDIS_URL` and `DEVAGENTS_REDIS_TOKEN`.
2. Set a key and model for at least one LLM provider (see `.env.example`). Check that each provider's terms allow this use.
3. Set `DEVAGENTS_ALLOWED_LOGINS` to your own GitHub login.
4. Set `DEVAGENTS_ENABLED` to `true`, and redeploy.

## Rolling it out

Change `DEVAGENTS_ALLOWED_LOGINS` one stage at a time, and redeploy after each change:

1. Your own login.
2. A small group of 3–5 people.
3. Empty, which means everyone.

Between stages, look at the `da:count:*` counters in the DevAgents database, and at Vercel's usage page.

## Turning it off

Do this first, and investigate afterwards.

1. In Vercel, remove `DEVAGENTS_ENABLED` and redeploy. The button disappears from every card.
2. If the site itself is broken, use Vercel's instant rollback to the last good deployment.

Turn it off if:

- the site's error rate rises
- Vercel usage passes 70% of the plan
- people report wrong or harmful text from the helper

## When something fails

| What you see | Likely cause | What to do |
|---|---|---|
| Panel shows "We couldn't get this right now" for everyone | No LLM provider is responding, or the DevAgents database is down | Check provider status and keys, and the Upstash dashboard |
| Everyone hits the limit early | The limits count per GitHub login, so this points to one account or a bug | Check the `da:llm:*` and `da:issues:*` keys |
| "Sign in again" keeps showing | Radar's sign-in or `SESSION_SECRET` has a problem | This is not specific to DevAgents; check sign-in first |
| A provider stops working | Its free plan or model name changed | Update `DEVAGENTS_*_MODEL`, or remove that provider's key |

The helper never stores GitHub tokens or a user's own Groq key. Its database holds only cached answers, daily limits and plain counts.
For preview deployments, add the same settings to Vercel's Preview environment.
