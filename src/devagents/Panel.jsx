import { useCallback, useEffect, useId, useRef, useState } from "react";
import ErrorBoundary from "../components/ErrorBoundary";
import Icon from "../components/Icon";
import ManualSteps from "./ManualSteps";
import { SECTIONS } from "./sections/index";
import "./devagents.css";

const sectionFallback = ({ retry }) => (
  <p className="devagents-note" role="alert">
    This part couldn't load.{" "}
    <button type="button" className="devagents-link-button" onClick={retry}>
      Try again
    </button>
  </p>
);

function Panel({ issue, language, signedIn, onClose, sections = SECTIONS }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  // What one step has learned that a later step needs.
  const [shared, setShared] = useState({});
  const onShare = useCallback((update) => {
    setShared((current) => ({ ...current, ...update }));
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog.open) return;
    if (dialog.showModal) dialog.showModal();
    else dialog.setAttribute("open", "");
  }, []);

  const closeDialog = () => {
    dialogRef.current?.close?.();
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="about-dialog devagents-panel"
      aria-labelledby={titleId}
      onClose={onClose}
    >
      <div className="about-header">
        <h2 id={titleId}>{issue.title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close"
          onClick={closeDialog}
        >
          <Icon name="x" />
        </button>
      </div>

      {signedIn ? (
        sections.map(({ id, title, Component }) => (
          <section key={id} className="devagents-section">
            <h3>{title}</h3>
            <ErrorBoundary fallback={sectionFallback}>
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
        ))
      ) : (
        <div className="devagents-section">
          <p>
            <a href="/auth/login">Sign in with GitHub</a> to get help with this issue. We only
            read public information.
          </p>
          <ManualSteps repo={issue.repo} issue={issue.issue} />
        </div>
      )}
    </dialog>
  );
}

export default Panel;
