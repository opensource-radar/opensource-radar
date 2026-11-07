import { lazy, Suspense, useState } from "react";
import ErrorBoundary from "../components/ErrorBoundary";
import Icon from "../components/Icon";
import { isPlainClick } from "../links";
import { issueUrl } from "./links";

const importPage = () => import("./HelpPage.jsx");

function BackToSearch({ onBack }) {
  return (
    <a
      className="aboutpage-back"
      href="/"
      onClick={(event) => {
        if (!isPlainClick(event)) return;
        event.preventDefault();
        onBack();
      }}
    >
      <Icon name="arrowLeft" />
      Back to search
    </a>
  );
}

// Decides what the help page's address shows. The page's own code downloads only
// here, so people who never use the helper don't pay for it.
function DevAgentsRoute({ issue, language, account, onBack, loadPage = importPage }) {
  // React remembers a failed lazy() forever, so a retry needs a new one.
  const [LazyPage, setLazyPage] = useState(() => lazy(loadPage));

  if (!account.checked) {
    return (
      <article className="aboutpage">
        <p className="aboutpage-sub">Loading…</p>
      </article>
    );
  }

  if (!account.devAgents) {
    return (
      <article className="aboutpage">
        <BackToSearch onBack={onBack} />
        <p className="aboutpage-lead">This helper isn't available right now.</p>
        <p>
          <a href={issueUrl(issue.repo, issue.issue)} target="_blank" rel="noopener noreferrer">
            Read the issue on GitHub ↗
          </a>
        </p>
      </article>
    );
  }

  return (
    <ErrorBoundary
      fallback={({ retry }) => (
        <article className="aboutpage" role="alert">
          <BackToSearch onBack={onBack} />
          <p className="aboutpage-lead">This page couldn't load.</p>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setLazyPage(() => lazy(loadPage));
              retry();
            }}
          >
            Try again
          </button>
        </article>
      )}
    >
      <Suspense
        fallback={
          <article className="aboutpage">
            <p className="aboutpage-sub">Loading…</p>
          </article>
        }
      >
        <LazyPage
          issue={issue}
          language={language}
          signedIn={account.signedIn}
          onBack={onBack}
        />
      </Suspense>
    </ErrorBoundary>
  );
}

export default DevAgentsRoute;
