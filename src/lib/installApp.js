// "Install app" support. Browsers that can install the site fire
// beforeinstallprompt once; it's kept here so the menu can offer it later.
let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach((listener) => listener());

export function listenForInstallPrompt(target = window) {
  target.addEventListener("beforeinstallprompt", (event) => {
    // Stops the browser's own mini-bar; the menu offers it instead.
    event.preventDefault();
    deferredPrompt = event;
    notify();
  });
  target.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

export const canInstall = () => deferredPrompt !== null;

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Shows the browser's install dialog. Resolves to true if the person accepted.
export async function promptInstall() {
  const prompt = deferredPrompt;
  if (!prompt) return false;
  deferredPrompt = null;
  notify();
  prompt.prompt();
  const choice = await prompt.userChoice.catch(() => null);
  return choice?.outcome === "accepted";
}

// Registers the service worker that shows an offline page. Production only,
// so local development never serves stale files.
export function registerServiceWorker({ nav = navigator, enabled = import.meta.env.PROD } = {}) {
  if (!enabled || !("serviceWorker" in nav)) return;
  window.addEventListener("load", () => {
    nav.serviceWorker.register("/sw.js").catch(() => {
      // The site works the same without it.
    });
  });
}
