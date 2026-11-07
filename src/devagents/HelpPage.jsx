import { useCallback, useEffect, useRef, useState } from "react";
import ErrorBoundary from "../components/ErrorBoundary";
import Icon from "../components/Icon";
import { isPlainClick } from "../links";
import { setPageMeta } from "../pageMeta";
import { helpPath, issueUrl, repoUrl } from "./links";
import ManualSteps from "./ManualSteps";
import KeySettings from "./sections/KeySettings";
import { SECTIONS } from "./sections/index";
import "./devagents.css";

const stepFallback = ({ retry }) => (
  <p className="devagents-callout" role="alert">
    This step couldn't load.{" "}
    <button type="button" className="text-button" onClick={retry}>
      Try again
    </button>
  </p>
);

// A page for one issue's own help, so search engines shouldn't list it.
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.append(meta);
    return () => meta.remove();
  }, []);
}

function HelpPage({ issue, language, signedIn, onBack, sections = SECTIONS }) {
  const { repo, issue: number } = issue;
  const headingRef = useRef(null);
  const stepHeadings = useRef({});
  const movedStep = useRef(false);
  const [active, setActive] = useState(0);
  const [visited, setVisited] = useState(() => new Set([0]));
  // What one step has learned that a later step needs.
  const [shared, setShared] = useState({});
  const onShare = useCallback((update) => {
    setShared((current) => ({ ...current, ...update }));
  }, []);

  const title = issue.title ?? shared.issueTitle ?? `${repo} #${number}`;
  useNoIndex();

  // Screen readers and keyboards start at the new page, not the old link.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    setPageMeta({
      path: helpPath(repo, number),
      title: `Help with: ${title} | OpenSource Radar`,
      description: "Understand this GitHub issue and prepare your first contribution.",
    });
  }, [repo, number, title]);

  // Moving to a step puts the reader at its heading.
  useEffect(() => {
    if (!movedStep.current) return;
    stepHeadings.current[active]?.focus();
  }, [active]);

  const goTo = (index) => {
    movedStep.current = true;
    setActive(index);
    setVisited((current) => new Set(current).add(index));
  };

  const previous = sections[active - 1];
  const next = sections[active + 1];

  return (
    <article className="helppage">
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

      <header className="helppage-header">
        <h1 ref={headingRef} tabIndex={-1}>
          {title}
        </h1>
        <p className="helppage-links">
          <a href={repoUrl(repo)} target="_blank" rel="noopener noreferrer">
            <Icon name="repo" />
            {repo}
          </a>
          <a href={issueUrl(repo, number)} target="_blank" rel="noopener noreferrer">
            View issue #{number} ↗
          </a>
        </p>
      </header>

      <p className="helppage-notice">
        <Icon name="info" />
        <span>
          This helper uses outside AI services. The issue, public project files and anything you
          paste are sent to them, so don't paste private details. AI can be wrong, so check its
          answers.
        </span>
      </p>

      {signedIn ? (
        <div className="helppage-layout">
          <nav className="helppage-rail" aria-label="Steps">
            <ol>
              {sections.map(({ id, title: name }, index) => {
                const isActive = index === active;
                const isVisited = visited.has(index) && !isActive;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      className={`helppage-step${isActive ? " is-active" : ""}${isVisited ? " is-visited" : ""}`}
                      aria-current={isActive ? "step" : undefined}
                      onClick={() => goTo(index)}
                    >
                      <span className="helppage-step-marker">
                        {isVisited ? <Icon name="check" /> : index + 1}
                      </span>
                      <span className="helppage-step-name">{name}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="helppage-main">
            <div className="helppage-panel">
              {sections.map(({ id, title: name, intro, Component }, index) => (
                // Every step stays mounted, so moving around never loses anything.
                <section key={id} hidden={index !== active}>
                  <h2
                    ref={(element) => {
                      stepHeadings.current[index] = element;
                    }}
                    tabIndex={-1}
                  >
                    {name}
                  </h2>
                  <p className="helppage-intro">{intro}</p>
                  <ErrorBoundary fallback={stepFallback}>
                    {Component && (
                      <Component
                        issue={issue}
                        language={language}
                        shared={shared}
                        onShare={onShare}
                      />
                    )}
                  </ErrorBoundary>
                </section>
              ))}

              {sections.length > 1 && (
                <div className="helppage-pager">
                  {previous && (
                    <button type="button" className="secondary-button" onClick={() => goTo(active - 1)}>
                      Previous: {previous.title}
                    </button>
                  )}
                  {next && (
                    <button
                      type="button"
                      className="secondary-button helppage-next"
                      onClick={() => goTo(active + 1)}
                    >
                      Next: {next.title}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="helppage-extras">
              <ErrorBoundary fallback={null}>
                <KeySettings />
              </ErrorBoundary>
            </div>
          </div>
        </div>
      ) : (
        <div className="helppage-panel">
          <p>
            <a href="/auth/login">Sign in with GitHub</a> to get help with this issue. We only read
            public information.
          </p>
          <ManualSteps repo={repo} issue={number} />
        </div>
      )}
    </article>
  );
}

export default HelpPage;
