import { describe, expect, it } from "vitest";
import { devAgentsEnabledFor } from "../../api/_lib/devagents/flags.js";

describe("devAgentsEnabledFor", () => {
  it("is off unless DEVAGENTS_ENABLED is exactly true", () => {
    expect(devAgentsEnabledFor("a", {})).toBe(false);
    expect(devAgentsEnabledFor("a", { DEVAGENTS_ENABLED: "1" })).toBe(false);
    expect(devAgentsEnabledFor("a", { DEVAGENTS_ENABLED: "TRUE" })).toBe(false);
  });

  it("is on for everyone with an empty allow list", () => {
    const env = { DEVAGENTS_ENABLED: "true" };
    expect(devAgentsEnabledFor("a", env)).toBe(true);
    expect(devAgentsEnabledFor(null, env)).toBe(true);
  });

  it("only allows listed logins, ignoring case and spaces", () => {
    const env = { DEVAGENTS_ENABLED: "true", DEVAGENTS_ALLOWED_LOGINS: "Ann, bob" };
    expect(devAgentsEnabledFor("ann", env)).toBe(true);
    expect(devAgentsEnabledFor("BOB", env)).toBe(true);
    expect(devAgentsEnabledFor("carl", env)).toBe(false);
    expect(devAgentsEnabledFor(null, env)).toBe(false);
  });
});
