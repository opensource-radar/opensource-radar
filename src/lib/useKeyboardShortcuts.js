import { useEffect, useRef } from "react";
import { nextIndex, shortcutFor } from "./shortcuts";

const CARD = ".issues-list .issue-card";

// The card the person is on: the one holding focus, if any.
function currentCard(cards) {
  const active = document.activeElement;
  return cards.findIndex((card) => card === active || card.contains(active));
}

function focusCard(card) {
  // Cards aren't in the tab order; -1 lets the shortcut focus them anyway.
  if (!card.hasAttribute("tabindex")) card.setAttribute("tabindex", "-1");
  card.focus({ preventScroll: true });
  card.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
}

// Listens for the shortcuts while `enabled`. Mounted once, in App.
export function useKeyboardShortcuts({ enabled, onShowHelp }) {
  // The latest callback, without re-adding the listener on every render.
  const showHelp = useRef(onShowHelp);
  useEffect(() => {
    showHelp.current = onShowHelp;
  }, [onShowHelp]);

  useEffect(() => {
    if (!enabled) return undefined;
    const onKeyDown = (event) => {
      const action = shortcutFor(event);
      if (!action) return;

      if (action === "help") {
        event.preventDefault();
        showHelp.current();
        return;
      }
      if (action === "search") {
        const input = document.getElementById("issue-search");
        if (!input) return;
        event.preventDefault();
        input.focus();
        input.select?.();
        return;
      }

      const cards = [...document.querySelectorAll(CARD)];
      if (cards.length === 0) return;
      const current = currentCard(cards);

      if (action === "next" || action === "previous") {
        event.preventDefault();
        focusCard(cards[nextIndex(current, cards.length, action)]);
        return;
      }
      if (current < 0) return;
      const card = cards[current];
      if (action === "save") {
        const button = card.querySelector(".issue-save");
        if (!button) return;
        event.preventDefault();
        button.click();
        // Keeps the place, even if saving re-renders the card.
        if (card.isConnected) focusCard(card);
        return;
      }
      if (action === "open") {
        const link = card.querySelector('.issue-card-links a[href^="https://github.com/"]');
        if (!link) return;
        event.preventDefault();
        window.open(link.href, "_blank", "noopener,noreferrer");
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
