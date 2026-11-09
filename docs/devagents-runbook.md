# DevAgents runbook

DevAgents is the optional "Get help with this issue" helper, which opens its own page at `/help/<owner>/<repo>/<issue>`. It only reads public GitHub data and never writes to GitHub. The rest of the site doesn't depend on it.

## Setting it up

1. Create a separate Upstash Redis database, and set `DEVAGENTS_REDIS_URL` and `DEVAGENTS_REDIS_TOKEN`.
2. Set a key and model for at least one LLM provider (see `.env.example`). Check that each provider's terms allow this use.
3. Set `DEVAGENTS_ALLOWED_LOGINS` to your own GitHub login.
4. Set `DEVAGENTS_ENABLED` to `true`, and redeploy.

## Capacity and routing

Free LLM plans limit tokens per minute and per day, and every user shares the same keys. On Groq's free plan, one new Explain uses about 7,000 tokens, so its limits allow only a few dozen new explanations a day. Answers are cached, so repeat requests cost nothing.

DevAgents chooses a provider for each request:

- **Before a limit is hit:** when a provider reports how much it has left, DevAgents skips it if the request wouldn't fit. Providers that don't report this are only skipped after they refuse a request.
- **Choosing:** it prefers providers with more room that are fast and reliable, with some randomness to spread the load.
- **After a problem:** a rate limit rests a provider for as long as it asks, a rejected key for 10 minutes, and repeated errors for up to 2 minutes.
- **When everything is busy:** it waits once if a provider will be ready within 13 seconds. Otherwise it tells the user straight away.

People aren't charged towards their daily limit when no answer comes back. What it learns is shared between servers through the database. Each AI call adds about two database commands, which count towards Upstash's monthly limit.

To add capacity, add more providers (see [Adding AI providers](#adding-ai-providers)).

## Adding AI providers

Every provider you add is another place to send requests when the others are busy. DevAgents picks among the providers that are set up, as described above.

| Provider | Settings | Base address (set by the code) |
| --- | --- | --- |
| Groq | `DEVAGENTS_GROQ_KEY`, `DEVAGENTS_GROQ_MODEL` | `https://api.groq.com/openai/v1` |
| Google Gemini | `DEVAGENTS_GEMINI_KEY`, `DEVAGENTS_GEMINI_MODEL` | `https://generativelanguage.googleapis.com/v1beta/openai` |
| Cerebras | `DEVAGENTS_CEREBRAS_KEY`, `DEVAGENTS_CEREBRAS_MODEL` | `https://api.cerebras.ai/v1` |
| Mistral | `DEVAGENTS_MISTRAL_KEY`, `DEVAGENTS_MISTRAL_MODEL` | `https://api.mistral.ai/v1` |
| A FreeLLMAPI server you host | `DEVAGENTS_FREELLM_URL`, `DEVAGENTS_FREELLM_KEY`, `DEVAGENTS_FREELLM_MODEL` (defaults to `auto`) | Your server's `https://` address, ending in `/v1` |
| Any other OpenAI-compatible provider | `DEVAGENTS_EXTRA_PROVIDERS` | You give it, in the list below |

Rules:

- **A provider is used only when both its key and its model are set.** A key on its own does nothing.
- **Use the model name exactly as the provider lists it.** Model names change, so check the provider's current list.
- **Settings only apply after a redeploy.** In Vercel, open Deployments, then the latest deployment, then **Redeploy**.
- **Addresses must use `https://`.** Anything else is skipped, so a server running only on your own computer (`localhost`) can't be used.
- **One account per provider.** Extra keys on the same account share its limits, and using several accounts to get more free quota can break a provider's terms. Check each provider's terms allow use on a public site.

### The extra-providers list

`DEVAGENTS_EXTRA_PROVIDERS` is a JSON list with one entry per provider:

```json
[
  { "name": "openrouter", "baseUrl": "https://openrouter.ai/api/v1", "apiKey": "<key>", "model": "<model>" },
  { "name": "nvidia", "baseUrl": "https://integrate.api.nvidia.com/v1", "apiKey": "<key>", "model": "<model>" }
]
```

- `name` uses letters, numbers, `_` or `-`. It must be unique, and can't be `own` or the name of another provider you've set up.
- `baseUrl` is the address before `/chat/completions`.
- An entry with a mistake is skipped, and the others still work. If the whole value isn't valid JSON, the list is ignored.

### Checking it worked

After the redeploy, open a help page while signed in and click **Explain this issue**. Each provider's latest limits and errors are stored in the DevAgents database under `da:v1:provider:<name>`, so a provider that appears there has been used.

## People's own API keys

The panel's "Use your own API key" option lets someone pick Groq, Google Gemini, Cerebras, Mistral, OpenRouter or OpenAI, check their key, and choose a model. Their requests then use their own account and skip the daily limits. The key stays in their browser, passes through the server for each request, and is never stored or logged. Keys can only go to the fixed provider addresses in `api/_lib/devagents/llm.js`. A key that fails falls back to shared capacity, which does count towards the limits. Signing out clears it.

## Rolling it out

Change `DEVAGENTS_ALLOWED_LOGINS` one stage at a time, and redeploy after each change:

1. Your own login.
2. A small group of 3–5 people.
3. Empty, which means everyone.

Between stages, look at the `da:count:*` counters in the DevAgents database, and at Vercel's usage page.

## Watching it

- **Uptime:** the "Uptime check" workflow tests the live site every 30 minutes or so, and GitHub emails whoever last changed its schedule if it fails. Run it by hand from the Actions tab to try it. GitHub pauses scheduled workflows after 60 days with no repository activity.
- **Usage:** check Vercel, Upstash and each AI provider's usage page every few days at first. Vercel's Hobby logs last only 1 hour.

## Measuring results

DevAgents adds a note saying the PR was prepared with AI assistance from DevAgents, so its PRs can be found with GitHub search. People can remove the note, and projects that ban AI get no note, so these counts are a minimum.

- All PRs: [search](https://github.com/search?q=%22AI+assistance+from+DevAgents%22+is%3Apr&type=pullrequests)
- Merged PRs: [search](https://github.com/search?q=%22AI+assistance+from+DevAgents%22+is%3Apr+is%3Amerged&type=pullrequests)

The merge rate is merged divided by all. In the site, "My contributions" shows each person's own count and rate.

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

The helper never stores GitHub tokens or a user's own API key on the server. Its database holds only cached answers, daily limits and plain counts.
For preview deployments, add the same settings to Vercel's Preview environment.

