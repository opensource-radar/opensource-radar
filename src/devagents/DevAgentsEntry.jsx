import { lazy, Suspense, useState } from "react";
import ErrorBoundary from "../components/ErrorBoundary";

const importPanel = () => import("./Panel.jsx");

// The button on each issue card. The panel's code downloads only when someone
// opens it, so visitors who never use DevAgents don't pay for it.
function DevAgentsEntry({ issue, language, signedIn, loadPanel = importPanel }) {
  const [open, setOpen] = useState(false);
  // React remembers a failed lazy() forever, so a retry needs a new one.
  const [LazyPanel, setLazyPanel] = useState(() => lazy(loadPanel));

  return (
    <>
      <button type="button" className="devagents-entry" onClick={() => setOpen(true)}>
        Get help with this issue
      </button>
      {open && (
        <ErrorBoundary
          fallback={({ retry }) => (
            <span role="alert">
              Help couldn't load.{" "}
              <button
                type="button"
                className="devagents-entry"
                onClick={() => {
                  setLazyPanel(() => lazy(loadPanel));
                  retry();
                }}
              >
                Try again
              </button>
            </span>
          )}
        >
          <Suspense fallback={<span>Loading…</span>}>
            <LazyPanel
              issue={issue}
              language={language}
              signedIn={signedIn}
              onClose={() => setOpen(false)}
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </>
  );
}

export default DevAgentsEntry;
