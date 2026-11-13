// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NavMenu from "../../src/components/NavMenu.jsx";
import { listenForInstallPrompt } from "../../src/lib/installApp.js";

listenForInstallPrompt(window);
afterEach(cleanup);

const noop = () => {};
const menu = () =>
  render(
    <NavMenu themePreference="system" onThemeChange={noop} user={null} signInAvailable={false}
      onSignOut={noop} savedCount={0} onShowSaved={noop} onShowRecommended={noop}
      onShowAbout={noop} reportsAvailable={false} theme="light" />,
  );

describe("Install app menu item", () => {
  it("is hidden until the browser offers installation, then opens its prompt", async () => {
    menu();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.queryByRole("menuitem", { name: "Install app" })).toBeNull();

    const event = new Event("beforeinstallprompt", { cancelable: true });
    event.prompt = vi.fn();
    event.userChoice = Promise.resolve({ outcome: "accepted" });
    act(() => window.dispatchEvent(event));

    fireEvent.click(await screen.findByRole("menuitem", { name: "Install app" }));
    expect(event.prompt).toHaveBeenCalledTimes(1);
  });
});
