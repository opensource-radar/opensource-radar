import { useId, useState } from "react";
import CopyButton from "../CopyButton";
import Helpful from "../Helpful";
import { parsePrNumber, pullUrl } from "../links";
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
  const thanks = useAction("thank-you", { repo, issue: number });

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
      </button>{" "}
      <button type="button" className="secondary-button" disabled={!pr || thanks.loading} onClick={() => thanks.run({ pr })}>
        {thanks.loading ? "Writing…" : "Write a thank-you"}
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

      {thanks.data && !thanks.data.merged && (
        <p>This pull request isn&rsquo;t merged yet. Come back for a thank-you once it is.</p>
      )}
      {thanks.data?.banned && (
        <p>
          This project doesn&rsquo;t accept AI-written text, so write your own thanks. Even one line,
          like &ldquo;Thanks for reviewing and merging this!&rdquo;, means a lot to maintainers.
        </p>
      )}
      {thanks.data?.note && (
        <div className="devagents-thanks">
          <p className="devagents-text">{thanks.data.note}</p>
          <p className="devagents-muted">
            Change it so it sounds like you, then post it as a comment on your pull request.
          </p>
          <CopyButton text={thanks.data.note} label="Copy the thank-you" />{" "}
          <a href={pullUrl(repo, pr ?? "")} target="_blank" rel="noopener noreferrer">
            Open your pull request ↗
          </a>
        </div>
      )}
      {thanks.failure}

      <Next language={language} shared={shared} />
    </div>
  );
}

export default AfterPr;
