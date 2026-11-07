import { useState } from "react";
import { callDevAgents } from "./client";

const REASONS = [
  { id: "wrong_file", label: "A file was wrong" },
  { id: "confusing", label: "It was confusing" },
  { id: "other", label: "Something else" },
];

// Feedback must never get in the way, so a failed save isn't shown.
function Helpful({ action }) {
  const [state, setState] = useState("ask");

  const send = (helpful, reason) => {
    setState("done");
    callDevAgents("feedback", { action, helpful, ...(reason && { reason }) });
  };

  if (state === "done") return <p className="devagents-muted" role="status">Thanks for telling us.</p>;

  if (state === "why") {
    return (
      <p className="devagents-muted">
        What was wrong?{" "}
        {REASONS.map(({ id, label }) => (
          <button key={id} type="button" className="devagents-link-button" onClick={() => send(false, id)}>
            {label}
          </button>
        )).flatMap((button, index) => (index === 0 ? [button] : [" · ", button]))}
      </p>
    );
  }

  return (
    <p className="devagents-muted">
      <button type="button" className="devagents-link-button" onClick={() => send(true)}>
        This helped
      </button>
      {" · "}
      <button type="button" className="devagents-link-button" onClick={() => setState("why")}>
        This didn't help
      </button>
    </p>
  );
}

export default Helpful;
