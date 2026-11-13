import { useId, useState } from "react";
import { splitGlossary } from "../lib/glossary";
import "./Glossary.css";

// One explained word: hover, focus or tap shows its meaning.
function Term({ word, text }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span className={`glossary${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="glossary-term"
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      >
        {word}
      </button>
      <span role="tooltip" id={id} className="glossary-tip">
        {text}
      </span>
    </span>
  );
}

// Text with its open-source words explained. Pass `parts` from
// splitGlossaryBlocks to share "first use only" across a whole page;
// otherwise each word is marked once within this text.
function GlossaryText({ text, parts }) {
  return (parts ?? splitGlossary(text)).map((part, index) =>
    typeof part === "string" ? part : <Term key={index} word={part.word} text={part.entry.text} />,
  );
}

export default GlossaryText;
