import { useEffect, useId, useRef, useState } from "react";
import { rawGuideUrl } from "../lib/markdown";
import Icon from "./Icon";
import MarkdownText from "./MarkdownText";
import "./ContributingGuide.css";

const MAX_CHARS = 60000;

// A project's contributing guide, read on Radar, with the issue it was opened
// from one tap away from being saved. Mounted only while open.
function ContributingGuide({ url, repo, issueTitle, number, saved, onToggleSave, onClose }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const raw = rawGuideUrl(url);
  const [state, setState] = useState({ status: raw ? "loading" : "error" });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) {
      if (dialog.showModal) dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    if (!raw) return undefined;
    let cancelled = false;
    fetch(raw)
      .then((response) => (response.ok ? response.text() : Promise.reject(response)))
      .then((text) => {
        if (!cancelled) setState({ status: "ready", text: text.slice(0, MAX_CHARS), cut: text.length > MAX_CHARS });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [raw]);

  return (
    <dialog
      ref={dialogRef}
      className="about-dialog guide-dialog"
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === dialogRef.current) dialogRef.current.close();
      }}
      onClose={onClose}
    >
      <div className="about-header">
        <h2 id={titleId}>Contributing guide</h2>
        <button type="button" className="icon-button" aria-label="Close" onClick={() => dialogRef.current?.close()}>
          <Icon name="x" />
        </button>
      </div>

      <div className="guide-bar">
        <p className="guide-for">
          {repo}
          {issueTitle && (
            <>
              {" · for "}
              {number ? `#${number} ` : ""}
              {issueTitle}
            </>
          )}
        </p>
        <div className="guide-actions">
          {onToggleSave && (
            <button
              type="button"
              className={`secondary-button guide-save${saved ? " is-saved" : ""}`}
              aria-pressed={saved}
              onClick={onToggleSave}
            >
              <Icon name={saved ? "bookmarkFilled" : "bookmark"} />
              {saved ? "Saved" : "Save this issue"}
            </button>
          )}
          <a href={url} target="_blank" rel="noopener noreferrer">
            Open on GitHub ↗
          </a>
        </div>
      </div>

      <div className="about-body guide-body">
        {state.status === "loading" && <p>Loading the guide…</p>}
        {state.status === "error" && (
          <p>
            Couldn&rsquo;t load the guide here.{" "}
            <a href={url} target="_blank" rel="noopener noreferrer">
              Read it on GitHub ↗
            </a>
          </p>
        )}
        {state.status === "ready" && (
          <>
            <MarkdownText text={state.text} base={url} />
            {state.cut && (
              <p>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  Read the rest on GitHub ↗
                </a>
              </p>
            )}
          </>
        )}
      </div>
    </dialog>
  );
}

export default ContributingGuide;
