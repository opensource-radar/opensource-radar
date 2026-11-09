import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as health } from "../api/health.js";
import { resetRouterMemory } from "../api/_lib/devagents/router.js";

const STORE_URL = "https://fake-store.test";
const DA_STORE_URL = "https://fake-devagents-store.test";
const SECRETS = ["store-token", "da-token", "groq-test-key", "gemini-test-key"];

// Fake databases: `broken` names the ones that fail, `states` is what the
// DevAgents database holds for each provider.
function stubDatabases({ broken = [], states = {} } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, init) => {
      const target = String(url) === STORE_URL ? "store" : "devAgentsStore";
      if (broken.includes(target)) return new Response("", { status: 500 });
      const [command, ...keys] = JSON.parse(init.body);
      if (command === "PING") return Response.json({ result: "PONG" });
      if (command === "MGET") {
        return Response.json({
          result: keys.map((key) => {
            const state = states[key.split(":").pop()];
            return state ? JSON.stringify(state) : null;
          }),
        });
      }
      return Response.json({ error: "unexpected command" });
    }),
  );
}

const read = async (response) => ({ status: response.status, body: await response.json() });

beforeEach(() => {
  resetRouterMemory();
  vi.stubEnv("KV_REST_API_URL", STORE_URL);
  vi.stubEnv("KV_REST_API_TOKEN", "store-token");
  vi.stubEnv("DEVAGENTS_ENABLED", "true");
  vi.stubEnv("DEVAGENTS_REDIS_URL", DA_STORE_URL);
  vi.stubEnv("DEVAGENTS_REDIS_TOKEN", "da-token");
  vi.stubEnv("DEVAGENTS_GROQ_KEY", "groq-test-key");
  vi.stubEnv("DEVAGENTS_GROQ_MODEL", "test-model");
  vi.stubEnv("DEVAGENTS_GEMINI_KEY", "gemini-test-key");
  vi.stubEnv("DEVAGENTS_GEMINI_MODEL", "test-model");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GET /api/health", () => {
  it("says ok when the databases answer and an AI provider is ready", async () => {
    stubDatabases();
    const response = await health();
    expect(await read(response)).toEqual({
      status: 200,
      body: {
        status: "ok",
        problems: [],
        store: "ok",
        devAgents: { enabled: true, store: "ok", providers: 2, ready: 2 },
      },
    });
  });

  it("never includes keys, tokens, models or provider names", async () => {
    stubDatabases();
    const text = await (await health()).text();
    for (const secret of [...SECRETS, "test-model", "groq", "gemini"]) {
      expect(text).not.toContain(secret);
    }
  });

  it("lets the CDN keep the answer briefly, so it can't be used to load the databases", async () => {
    stubDatabases();
    expect((await health()).headers.get("Cache-Control")).toContain("s-maxage=30");
  });

  it("answers 503 when Radar's database fails", async () => {
    stubDatabases({ broken: ["store"] });
    const { status, body } = await read(await health());
    expect(status).toBe(503);
    expect(body).toMatchObject({ status: "degraded", problems: ["store"], store: "error" });
  });

  it("answers 503 when the DevAgents database fails", async () => {
    stubDatabases({ broken: ["devAgentsStore"] });
    const { status, body } = await read(await health());
    expect(status).toBe(503);
    expect(body.problems).toContain("devAgentsStore");
  });

  it("counts providers that are resting after a rate limit as not ready", async () => {
    stubDatabases({ states: { groq: { cooldownUntil: Date.now() + 60000 } } });
    const { status, body } = await read(await health());
    expect(status).toBe(200);
    expect(body.devAgents).toMatchObject({ providers: 2, ready: 1 });
  });

  it("answers 503 when every AI provider is resting", async () => {
    const later = Date.now() + 60000;
    stubDatabases({ states: { groq: { cooldownUntil: later }, gemini: { cooldownUntil: later } } });
    const { status, body } = await read(await health());
    expect(status).toBe(503);
    expect(body.problems).toEqual(["aiProviders"]);
  });

  it("answers 503 when DevAgents is on but no AI provider is set up", async () => {
    vi.stubEnv("DEVAGENTS_GROQ_KEY", "");
    vi.stubEnv("DEVAGENTS_GEMINI_KEY", "");
    stubDatabases();
    const { status, body } = await read(await health());
    expect(status).toBe(503);
    expect(body.devAgents).toMatchObject({ providers: 0, ready: 0 });
  });

  it("with DevAgents off, only checks Radar's database", async () => {
    vi.stubEnv("DEVAGENTS_ENABLED", "");
    stubDatabases();
    const { status, body } = await read(await health());
    expect(status).toBe(200);
    expect(body.devAgents).toEqual({ enabled: false });
    expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([STORE_URL]);
  });

  it("is ok without a database, since saving then stays in the browser", async () => {
    vi.stubEnv("KV_REST_API_URL", "");
    vi.stubEnv("DEVAGENTS_ENABLED", "");
    stubDatabases();
    const { status, body } = await read(await health());
    expect(status).toBe(200);
    expect(body.store).toBe("not_set_up");
  });
});
