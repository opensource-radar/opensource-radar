// "Your first pull request in 7 days": a checklist on the guide page. Ticks
// stay in this browser only. Storage can be blocked, so nothing here throws.
const STORAGE_KEY = "radar:seven-days";

export const SEVEN_DAYS = [
  {
    title: "Get set up",
    tasks: [
      "Make a GitHub account, if you don't have one",
      "Install Git and tell it your name and email",
      "Try the practice repository: fork it, add your name, open a pull request",
    ],
    link: { href: "https://github.com/firstcontributions/first-contributions", label: "Open the practice repository", external: true },
  },
  {
    title: "Find a few issues",
    tasks: ["Search in a language you already know", "Keep to issues nobody has taken", "Save three that look doable"],
    link: { href: "/", label: "Search good first issues" },
  },
  {
    title: "Pick one and understand it",
    tasks: ["Read the issue and every comment", "Read the README and contributing guide", "Use “Get help with this issue” if anything is unclear"],
  },
  {
    title: "Ask to work on it",
    tasks: ["Comment on the issue, saying what you plan to do", "Wait to be assigned before you start"],
  },
  {
    title: "Make the change",
    tasks: ["Fork the project and make a new branch", "Make the change, keeping it small", "Run the project's tests"],
  },
  {
    title: "Open your pull request",
    tasks: ["Write what you changed and why", "Add “Fixes #123” with the issue number", "Check that the automatic checks pass"],
  },
  {
    title: "Respond and celebrate",
    tasks: ["Reply to review comments and push fixes", "Thank the maintainers", "When it's merged, share it from My contributions"],
  },
];

const taskId = (day, task) => `${day}.${task}`;
export const ALL_TASKS = SEVEN_DAYS.flatMap((day, d) => day.tasks.map((_, t) => taskId(d, t)));

export function readDone(storage = globalThis.localStorage) {
  try {
    const list = JSON.parse(storage.getItem(STORAGE_KEY));
    return new Set(Array.isArray(list) ? list.filter((id) => ALL_TASKS.includes(id)) : []);
  } catch {
    return new Set();
  }
}

export function writeDone(done, storage = globalThis.localStorage) {
  try {
    if (done.size > 0) storage.setItem(STORAGE_KEY, JSON.stringify([...done]));
    else storage.removeItem(STORAGE_KEY);
  } catch {
    // Ticks are just kept for this visit.
  }
}

export { taskId };
