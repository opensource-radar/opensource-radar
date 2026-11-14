import { useCallback, useEffect, useRef, useState } from "react";
import ErrorBoundary from "../components/ErrorBoundary";
import GlossaryText from "../components/Glossary";
import Icon from "../components/Icon";
import { isPlainClick } from "../lib/links";
import { setPageMeta } from "../lib/pageMeta";
import { helpPath, issueUrl, repoUrl } from "./links";
import IssueDetails from "./IssueDetails";
import ManualSteps from "./ManualSteps";
import {
  fetchRemoteProgress,
  newest,
  progressKey,
  readLocalProgress,
  rememberStep,
  writeLocalProgress,
} from "./progress";
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
  const savedKey = progressKey(repo, number);
  // Carries on from the last step reached, in this browser at first.
  const [start] = useState(() => {
    const local = readLocalProgress(savedKey);
    return local && local.step < sections.length ? local : null;
  });
  const [active, setActive] = useState(start?.step ?? 0);
  const [visited, setVisited] = useState(() => new Set([0, ...(start?.visited ?? [])]));
  const [resumed, setResumed] = useState(Boolean(start?.step));
  // What one step has learned that a later step needs.
  const [shared, setShared] = useState({});
  const onShare = useCallback((update) => {
    setShared((current) => ({ ...current, ...update }));
  }, []);
  const [detailsTitle, setDetailsTitle] = useState(null);

  const title = issue.title ?? shared.issueTitle ?? detailsTitle ?? `${repo} #${number}`;
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

  // A position saved on another device wins if it's newer.
  useEffect(() => {
    if (!signedIn) return undefined;
    let cancelled = false;
    fetchRemoteProgress(savedKey).then((remote) => {
      if (cancelled || !remote || remote.step >= sections.length) return;
      const local = readLocalProgress(savedKey);
      if (newest(local, remote) !== remote || remote.step === local?.step) return;
      writeLocalProgress(savedKey, remote);
      setActive(remote.step);
      setVisited((current) => new Set([...current, ...remote.visited]));
      setResumed(remote.step > 0);
    });
    return () => {
      cancelled = true;
    };
  }, [signedIn, savedKey, sections.length]);

  const goTo = (index) => {
    movedStep.current = true;
    setResumed(false);
    setActive(index);
    const nextVisited = new Set(visited).add(index);
    setVisited(nextVisited);
    rememberStep(savedKey, index, nextVisited, signedIn);
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

      <IssueDetails repo={repo} number={number} onLoaded={setDetailsTitle} />

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
              {resumed && (
                <p className="helppage-resumed" role="status">
                  Carrying on from {sections[active]?.title}.{" "}
                  <button type="button" className="text-button" onClick={() => goTo(0)}>
                    Start from the beginning
                  </button>
                </p>
              )}
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
                  <p className="helppage-intro">
                    <GlossaryText text={intro} />
                  </p>
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
            <a href="/auth/login">Sign in with GitHub</a> to get AI help with this issue. We only
            read public information.
          </p>
          <ManualSteps repo={repo} issue={number} />
        </div>
      )}
    </article>
  );
}

export default HelpPage;
