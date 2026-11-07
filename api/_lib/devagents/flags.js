// The off switch for DevAgents. It stays off unless DEVAGENTS_ENABLED is exactly
// "true". An optional allow list limits it to certain GitHub logins, which is
// how it is rolled out gradually.
export function devAgentsEnabledFor(login, env = process.env) {
  if (env.DEVAGENTS_ENABLED !== "true") return false;

  const allowed = (env.DEVAGENTS_ALLOWED_LOGINS || "")
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return true;

  return Boolean(login) && allowed.includes(login.toLowerCase());
}
