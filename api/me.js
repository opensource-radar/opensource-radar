import { loadSession } from "./_lib/auth.js";
import { devAgentsEnabledFor } from "./_lib/devagents/flags.js";
import { reportsAvailable } from "./_lib/report.js";
import { getConfig, json } from "./_lib/session.js";
import { storeAvailable } from "./_lib/store.js";

// GET /api/me: who is signed in, plus which optional features the server is
// set up for. Never returns the token itself.
export async function GET(request) {
  const config = getConfig();
  const features = {
    savedSync: config.configured && storeAvailable(),
    reportsAvailable: reportsAvailable(),
    // Project details on cards for visitors who aren't signed in.
    projectInfo: Boolean(process.env.GITHUB_READ_TOKEN),
  };

  if (!config.configured) {
    return json({ signInAvailable: false, user: null, devAgents: false, ...features });
  }

  const { session, cookies } = await loadSession(request, config);
  const user = session?.user ?? null;
  return json(
    {
      signInAvailable: true,
      user,
      devAgents: devAgentsEnabledFor(user?.login ?? null),
      ...features,
    },
    cookies,
  );
}
