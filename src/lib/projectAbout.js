import { useEffect, useRef, useState } from "react";

// Projects without a description of their own get a one-sentence AI summary,
// a few per page at most, saved on the server for a week.
const MAX_PER_PAGE = 3;

export const needsAiAbout = (project) =>
  Boolean(project) && !project.missing && !project.archived && project.about === null;

export function useAiAbouts(projects, shownRepos) {
  const [abouts, setAbouts] = useState({});
  const requested = useRef(new Set());

  useEffect(() => {
    const names = shownRepos
      .split(",")
      .filter((name) => name && needsAiAbout(projects[name]) && !requested.current.has(name))
      .slice(0, MAX_PER_PAGE);
    names.forEach((name) => {
      requested.current.add(name);
      fetch(`/api/about?repo=${encodeURIComponent(name)}`, { headers: { Accept: "application/json" } })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (data?.about) setAbouts((current) => ({ ...current, [name]: { about: data.about, ai: Boolean(data.ai) } }));
        })
        .catch(() => {});
    });
  }, [projects, shownRepos]);

  return abouts;
}

// The card's project details with the summary filled in, when there is one.
export function withAbout(project, ai) {
  if (!project || project.about || !ai?.about) return project;
  return { ...project, about: ai.about, aboutByAi: ai.ai };
}
