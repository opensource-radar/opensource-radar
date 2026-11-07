import ManualSteps from "./ManualSteps";

function Failure({ reason, onRetry, repo, issue, notFoundMessage }) {
  if (reason === "sign_in") {
    return (
      <p className="devagents-note" role="alert">
        Your sign-in has ended. <a href="/auth/login">Sign in again</a>
      </p>
    );
  }
  if (reason === "limit") {
    return (
      <p className="devagents-note" role="alert">
        You've reached today's free limit. It resets tomorrow, or you can add your own Groq key below.
      </p>
    );
  }
  if (reason === "not_found") {
    return (
      <p className="devagents-note" role="alert">
        {notFoundMessage ??
          "We couldn't find this on GitHub. It may have been deleted, moved or made private."}
      </p>
    );
  }
  if (reason === "too_large") {
    return (
      <p className="devagents-note" role="alert">
        That's too long for us to read. Try sending just the last part.
      </p>
    );
  }
  if (reason === "invalid_request") {
    return (
      <p className="devagents-note" role="alert">
        We couldn't read that. Check what you typed and try again.
      </p>
    );
  }
  return (
    <div className="devagents-note" role="alert">
      <p>
        We couldn't get this right now. The helper may be busy, so wait a minute and{" "}
        <button type="button" className="devagents-link-button" onClick={onRetry}>
          Try again
        </button>
        .
      </p>
      <p>You can still start from these:</p>
      <ManualSteps repo={repo} issue={issue} />
    </div>
  );
}

export default Failure;
