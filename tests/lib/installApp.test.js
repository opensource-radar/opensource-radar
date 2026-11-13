// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { canInstall, listenForInstallPrompt, promptInstall, registerServiceWorker, subscribe } from "../../src/lib/installApp.js";

function fakePrompt(outcome = "accepted") {
  const event = new Event("beforeinstallprompt", { cancelable: true });
  event.prompt = vi.fn();
  event.userChoice = Promise.resolve({ outcome });
  return event;
}

describe("install app", () => {
  const target = new EventTarget();
  listenForInstallPrompt(target);

  it("offers install only after the browser says it can", async () => {
    expect(canInstall()).toBe(false);
    const listener = vi.fn();
    const stop = subscribe(listener);
    const event = fakePrompt();
    target.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(canInstall()).toBe(true);
    expect(listener).toHaveBeenCalled();

    expect(await promptInstall()).toBe(true);
    expect(event.prompt).toHaveBeenCalledTimes(1);
    // A prompt can only be used once.
    expect(canInstall()).toBe(false);
    expect(await promptInstall()).toBe(false);
    stop();
  });

  it("reports a dismissed prompt", async () => {
    target.dispatchEvent(fakePrompt("dismissed"));
    expect(await promptInstall()).toBe(false);
  });

  it("stops offering once the app is installed", () => {
    target.dispatchEvent(fakePrompt());
    target.dispatchEvent(new Event("appinstalled"));
    expect(canInstall()).toBe(false);
  });

  it("registers the service worker in production only", () => {
    const register = vi.fn(() => Promise.resolve());
    const nav = { serviceWorker: { register } };
    registerServiceWorker({ nav, enabled: false });
    window.dispatchEvent(new Event("load"));
    expect(register).not.toHaveBeenCalled();

    registerServiceWorker({ nav, enabled: true });
    window.dispatchEvent(new Event("load"));
    expect(register).toHaveBeenCalledWith("/sw.js");
  });

  it("does nothing in browsers without service workers", () => {
    expect(() => registerServiceWorker({ nav: {}, enabled: true })).not.toThrow();
  });
});

describe("manifest", () => {
  it("has what browsers need to install the site", async () => {
    const fs = await import("node:fs");
    const manifest = JSON.parse(fs.readFileSync("public/site.webmanifest", "utf8"));
    expect(manifest).toMatchObject({ id: "/", start_url: "/", scope: "/", display: "standalone" });
    expect(manifest.icons.map((icon) => icon.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    for (const icon of manifest.icons) expect(fs.existsSync(`public${icon.src}`)).toBe(true);
    expect(fs.existsSync("public/offline.html")).toBe(true);
  });
});
