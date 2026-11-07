import Change from "./Change";
import Plan from "./Plan";
import Understand from "./Understand";

// The six steps of the panel, in the order a beginner goes through them.
export const SECTIONS = [
  { id: "understand", title: "Understand", Component: Understand },
  { id: "plan", title: "Plan", Component: Plan },
  { id: "change", title: "Change", Component: Change },
  { id: "check", title: "Check", Component: null },
  { id: "submit", title: "Submit", Component: null },
  { id: "after", title: "After", Component: null },
];
