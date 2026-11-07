import { createElement, useCallback, useEffect, useRef, useState } from "react";
import { callDevAgents } from "./client";
import Failure from "./Failure";
import { readPanelState, writePanelState } from "./storage";

// Runs one DevAgents action for a section of the panel. A failed call keeps
// whatever is already on screen. `stateKey` restores the answer after a refresh.
export function useAction(action, payload, stateKey, { notFoundMessage } = {}) {
  const [state, setState] = useState(() => ({
    status: "idle",
    data: stateKey ? readPanelState(stateKey) : null,
    reason: null,
    ownKeyFailed: false,
    extra: undefined,
  }));
  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Comparing by content means a new object with the same values is the same payload.
  const payloadKey = JSON.stringify(payload);

  const run = useCallback(
    async (extra) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setState((current) => ({ ...current, status: "loading", reason: null, extra }));

      const result = await callDevAgents(action, { ...JSON.parse(payloadKey), ...extra });
      inFlight.current = false;
      if (result.ok && stateKey) writePanelState(stateKey, result.data);
      if (!mounted.current) return;

      setState((current) =>
        result.ok
          ? {
              ...current,
              status: "ready",
              data: result.data,
              reason: null,
              ownKeyFailed: result.ownKeyFailed,
            }
          : { ...current, status: "error", reason: result.reason },
      );
    },
    [action, stateKey, payloadKey],
  );

  // run() only touches its refs when a user clicks, never while rendering.
  /* eslint-disable react-hooks/refs */
  const failure =
    state.status === "error"
      ? createElement(Failure, {
          reason: state.reason,
          onRetry: () => run(state.extra),
          repo: payload.repo,
          issue: payload.issue,
          notFoundMessage,
        })
      : state.ownKeyFailed
        ? createElement(
            "p",
            { className: "devagents-note", role: "status" },
            "Your key didn't work, so this used the shared service instead.",
          )
        : null;
  /* eslint-enable react-hooks/refs */

  return { ...state, run, failure, loading: state.status === "loading" };
}
