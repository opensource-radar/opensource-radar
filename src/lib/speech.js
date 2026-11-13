// Reading text aloud with the browser's built-in voices (Web Speech API).
// Nothing is sent anywhere. Every call is safe where speech isn't available.
export const SPEEDS = [
  { value: 0.8, label: "Slower" },
  { value: 1, label: "Normal" },
  { value: 1.25, label: "Faster" },
];

export function canSpeak(scope = globalThis) {
  return Boolean(scope.speechSynthesis && scope.SpeechSynthesisUtterance);
}

// Markdown and links read badly aloud, so they're tidied first.
export function speakableText(text) {
  return String(text ?? "")
    .replace(/```[\s\S]*?```/g, " (code example) ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "(link)")
    .replace(/[#>*_~|-]{2,}/g, " ")
    .replace(/^\s*[#>*-]\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Starts reading; calls onEnd when it finishes or is stopped.
export function speak(text, { rate = 1, onEnd, scope = globalThis } = {}) {
  if (!canSpeak(scope)) return false;
  scope.speechSynthesis.cancel();
  const utterance = new scope.SpeechSynthesisUtterance(speakableText(text));
  utterance.rate = rate;
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  scope.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking(scope = globalThis) {
  if (canSpeak(scope)) scope.speechSynthesis.cancel();
}
