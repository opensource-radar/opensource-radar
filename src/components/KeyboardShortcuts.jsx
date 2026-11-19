import { useEffect, useId, useRef } from "react";
import { SHORTCUTS } from "../lib/shortcuts";
import Icon from "./Icon";

// The list of shortcuts. Mounted only while open.
function KeyboardShortcuts({ onClose }) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) {
      if (dialog.showModal) dialog.showModal();
      else dialog.setAttribute("open", "");
    }
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="about-dialog shortcuts-dialog"
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === dialogRef.current) dialogRef.current.close();
      }}
      onClose={onClose}
    >
      <div className="about-header">
        <h2 id={titleId}>Keyboard shortcuts</h2>
        <button type="button" className="icon-button" aria-label="Close" onClick={() => dialogRef.current?.close()}>
          <Icon name="x" />
        </button>
      </div>
      <div className="about-body">
        <dl className="shortcuts-list">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.key} className="shortcuts-row">
              <dt>
                <kbd>{shortcut.key}</kbd>
              </dt>
              <dd>{shortcut.label}</dd>
            </div>
          ))}
        </dl>
        <p className="shortcuts-note">They work on the issue list whenever you&rsquo;re not typing in a box.</p>
      </div>
    </dialog>
  );
}

export default KeyboardShortcuts;
