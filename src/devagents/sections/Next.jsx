import { nextIssueUrl } from "../nextIssue";

// Picks up on what the user really did. No streaks or points.
function Next({ language, shared }) {
  const practised = [
    shared?.explain && "Reading a new project and finding where to start",
    shared?.change && "Checking your own change before others see it",
  ].filter(Boolean);

  return (
    <div>
      {practised.length > 0 && (
        <>
          <p>What you practised:</p>
          <ul>
            {practised.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}
      <p>
        <a href={nextIssueUrl(language)}>Find your next issue, a little harder this time</a>
      </p>
    </div>
  );
}

export default Next;
