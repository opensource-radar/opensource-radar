// Reading text aloud with the browser's built-in voices (Web Speech API).
// Nothing is sent anywhere. Every call is safe where speech isn't available.
export const SPEEDS = [
  { value: 0.75, label: "Slower" },
  { value: 1, label: "Normal" },
  { value: 1.4, label: "Faster" },
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

// Writing systems we can recognise, and the voice language to ask for.
// Japanese kana comes before Chinese characters, which Japanese also uses.
const SCRIPTS = [
  [/[ऀ-ॿ]/g, "hi-IN"],
  [/[ঀ-৿]/g, "bn-IN"],
  [/[਀-੿]/g, "pa-IN"],
  [/[઀-૿]/g, "gu-IN"],
  [/[଀-୿]/g, "or-IN"],
  [/[஀-௿]/g, "ta-IN"],
  [/[ఀ-౿]/g, "te-IN"],
  [/[ಀ-೿]/g, "kn-IN"],
  [/[ഀ-ൿ]/g, "ml-IN"],
  [/[가-힯ᄀ-ᇿ㄰-㆏]/g, "ko-KR"],
  [/[぀-ヿ]/g, "ja-JP"],
  [/[一-鿿]/g, "zh-CN"],
  [/[؀-ۿ]/g, "ar"],
  [/[֐-׿]/g, "he-IL"],
  [/[Ѐ-ӿ]/g, "ru-RU"],
  [/[Ͱ-Ͽ]/g, "el-GR"],
  [/[฀-๿]/g, "th-TH"],
];
const count = (text, pattern) => text.match(pattern)?.length ?? 0;

// The language to read in, from the text's writing system, or null for text
// in Latin letters (the browser's usual voice is used for those).
export function detectLanguage(text) {
  const value = String(text ?? "");
  const latin = count(value, /[A-Za-z]/g);
  let best = null;
  let bestCount = 0;
  for (const [pattern, lang] of SCRIPTS) {
    const n = count(value, pattern);
    if (n > bestCount) {
      best = lang;
      bestCount = n;
    }
  }
  if (best === "zh-CN" && count(value, /[぀-ヿ]/g) > 0) best = "ja-JP";
  // Code and project names are often in English inside other languages' text.
  return best && bestCount >= 0.3 * (bestCount + latin) ? best : null;
}

const normal = (lang) => String(lang ?? "").replace("_", "-").toLowerCase();

// The best installed voice for a language: an exact match, then any voice
// for the same language.
export function pickVoice(voices, lang) {
  if (!lang) return null;
  const wanted = normal(lang);
  const primary = wanted.split("-")[0];
  const local = (list) => list.find((voice) => voice.localService) ?? list[0] ?? null;
  return (
    local(voices.filter((voice) => normal(voice.lang) === wanted)) ??
    local(voices.filter((voice) => normal(voice.lang).split("-")[0] === primary))
  );
}

const MAX_CHUNK = 200;

// One sentence at a time, long ones split at about 200 characters. Chrome
// stops long readings partway, and a speed change can restart close by.
export function chunksOf(text) {
  const sentences = text.match(/[^.!?।。！？]+[.!?।。！？]*\s*/g) ?? [];
  const chunks = [];
  for (const sentence of sentences) {
    let current = "";
    for (const piece of sentence.split(/(\s+)/)) {
      if ((current + piece).length > MAX_CHUNK && current.trim()) {
        chunks.push(current.trim());
        current = "";
      }
      current += piece;
    }
    if (current.trim()) chunks.push(current.trim());
  }
  return chunks;
}

// Each reading gets a number, so callbacks from one that was stopped (to
// change speed, say) can't end the next one.
let reading = 0;

// Starts reading, from sentence `from`, `at` characters into it (a word
// start). Returns { ok, count, lang, hasVoice }. onProgress(sentence, char)
// runs as each sentence and word starts; onEnd when it finishes or fails.
export function speak(text, { rate = 1, from = 0, at = 0, onEnd, onProgress, scope = globalThis } = {}) {
  if (!canSpeak(scope)) return { ok: false };
  const synth = scope.speechSynthesis;
  synth.cancel();
  const id = (reading += 1);
  const clean = speakableText(text);
  const chunks = chunksOf(clean);
  if (chunks.length === 0) return { ok: false };

  const lang = detectLanguage(clean);
  const voices = synth.getVoices?.() ?? [];
  const voice = pickVoice(voices, lang);
  const start = Math.min(Math.max(0, from), chunks.length - 1);
  const finish = () => {
    if (id === reading) onEnd?.();
  };

  chunks.slice(start).forEach((chunk, offset) => {
    const index = start + offset;
    // The first sentence may start partway, from the word it was on.
    const skip = offset === 0 ? Math.min(Math.max(0, at), chunk.length) : 0;
    const utterance = new scope.SpeechSynthesisUtterance(chunk.slice(skip));
    utterance.rate = rate;
    if (lang) utterance.lang = voice?.lang ?? lang;
    if (voice) utterance.voice = voice;
    utterance.onstart = () => {
      if (id === reading) onProgress?.(index, skip);
    };
    // Word by word, where the voice reports it (most on-device voices do).
    utterance.onboundary = (event) => {
      if (id === reading && event?.name !== "sentence" && Number.isInteger(event?.charIndex)) {
        onProgress?.(index, skip + event.charIndex);
      }
    };
    utterance.onerror = (event) => {
      if (event?.error !== "interrupted" && event?.error !== "canceled") finish();
    };
    if (index === chunks.length - 1) utterance.onend = finish;
    synth.speak(utterance);
  });

  // An empty voice list means the browser hasn't loaded them yet: assume it can.
  return { ok: true, count: chunks.length, lang, hasVoice: !lang || voices.length === 0 || Boolean(voice) };
}

export function stopSpeaking(scope = globalThis) {
  if (!canSpeak(scope)) return;
  reading += 1;
  scope.speechSynthesis.cancel();
}

// "Korean", "Hindi"… for a message about a missing voice.
export function languageName(lang) {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(lang.split("-")[0]);
  } catch {
    return lang;
  }
}
