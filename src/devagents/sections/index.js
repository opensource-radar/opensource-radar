import AfterPr from "./AfterPr";
import Change from "./Change";
import Check from "./Check";
import Plan from "./Plan";
import Submit from "./Submit";
import Understand from "./Understand";

// The six steps, in the order a beginner goes through them.
export const SECTIONS = [
  {
    id: "understand",
    title: "Understand",
    intro: "See whether this issue is free to work on, and what it's asking for.",
    Component: Understand,
  },
  {
    id: "plan",
    title: "Plan",
    intro: "Try it yourself first. Ask for a hint when you're stuck.",
    Component: Plan,
  },
  {
    id: "change",
    title: "Change",
    intro: "Make the change yourself on GitHub.",
    Component: Change,
  },
  {
    id: "check",
    title: "Check",
    intro: "Get notes on your change before anyone else sees it.",
    Component: Check,
  },
  {
    id: "submit",
    title: "Submit",
    intro: "Write the pull request text, then open GitHub's page to send it.",
    Component: Submit,
  },
  {
    id: "after",
    title: "After",
    intro: "Understand failed checks and review comments, then find your next issue.",
    Component: AfterPr,
  },
];
