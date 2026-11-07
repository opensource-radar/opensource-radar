import { issueUrl, repoUrl } from "./links";

// Needs no network, so there is always something useful to show.
function ManualSteps({ repo, issue }) {
  const home = repoUrl(repo);
  return (
    <ul className="devagents-manual">
      <li>
        <a href={issueUrl(repo, issue)} target="_blank" rel="noopener noreferrer">
          Read the issue ↗
        </a>
      </li>
      <li>
        <a href={`${home}#readme`} target="_blank" rel="noopener noreferrer">
          Read the project's README ↗
        </a>
      </li>
      <li>
        <a href={`${home}/blob/HEAD/CONTRIBUTING.md`} target="_blank" rel="noopener noreferrer">
          Read the contributing guide, if it has one ↗
        </a>
      </li>
    </ul>
  );
}

export default ManualSteps;
