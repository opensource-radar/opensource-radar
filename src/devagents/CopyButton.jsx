import { useState } from "react";

// Clipboard access can be refused, so a failure just says so.
function CopyButton({ text, label = "Copy" }) {
  const [status, setStatus] = useState("idle");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  };

  return (
    <button type="button" className="devagents-link-button" onClick={copy}>
      {status === "copied" ? "Copied" : status === "failed" ? "Couldn't copy" : label}
    </button>
  );
}

export default CopyButton;
