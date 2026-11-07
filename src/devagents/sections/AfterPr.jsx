import { useId, useState } from "react";
import Helpful from "../Helpful";
import { parsePrNumber } from "../links";
import { useAction } from "../useAction";
import Next from "./Next";

const CHECK_STATUS = {
  passing: "All automatic checks have passed.",
  pending: "The checks are still running. Look again in a few minutes.",
};

function AfterPr({ issue, language, shared }) {
  const { repo, issue: number } = issue;
  const fieldId = useId();
  const [text, setText] = useState("");
  const pr = parsePrNumber(text);
  const checks = useAction("explain-checks", { repo, issue: number });
  const review = useAction("explain-review", { repo, issue: number });

  return (
    <div>
      <label htmlFor={fieldId}>Your pull request number or link</label>
      <input
        id={fieldId}
        className="devagents-field"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <button type="button" className="secondary-button" disabled={!pr || checks.loading} onClick={() => checks.run({ pr })}>
        {checks.loading ? "Looking…" : "Explain my failed checks"}
      </button>{" "}
      <button type="button" className="secondary-button" disabled={!pr || review.loading} onClick={() => review.run({ pr })}>
        {review.loading ? "Reading…" : "Explain the review comments"}
      </button>

      {checks.data && CHECK_STATUS[checks.data.status] && <p>{CHECK_STATUS[checks.data.status]}</p>}
      {checks.data?.failing?.length > 0 && (
        <ul>
          {checks.data.failing.map((item) => (
            <li key={item.name}>
              <strong>{item.name}</strong>: {item.why} {item.nextStep}
            </li>
          ))}
        </ul>
      )}
      {checks.data?.failing?.length > 0 && <Helpful action="explain-checks" />}
      {checks.failure}

      {review.data && review.data.comments?.length === 0 && <p>No review comments yet.</p>}
      {review.data?.comments?.length > 0 && (
        <ul>
          {review.data.comments.map((item) => (
            <li key={item.meaning}>
              {item.meaning} {item.nextStep}
            </li>
          ))}
        </ul>
      )}
      {review.data?.comments?.length > 0 && <Helpful action="explain-review" />}
      {review.failure}

      <Next language={language} shared={shared} />
    </div>
  );
}

export default AfterPr;
