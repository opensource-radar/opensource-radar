import { isPlainClick } from "../lib/links";
import { helpPath } from "./links";

// The link on each issue card. It's a real link, so it can open in a new tab. A
// normal click moves to the help page without reloading, keeping the search.
function DevAgentsEntry({ issue, onOpen }) {
  return (
    <a
      className="devagents-entry"
      href={helpPath(issue.repo, issue.issue)}
      onClick={(event) => {
        if (!isPlainClick(event)) return;
        event.preventDefault();
        onOpen(issue);
      }}
    >
      Get help with this issue
    </a>
  );
}

export default DevAgentsEntry;
