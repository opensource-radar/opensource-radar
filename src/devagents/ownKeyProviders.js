// The AI providers people can use their own key with. The addresses their keys
// go to are fixed on the server. These are only names and sign-up links.
export const OWN_KEY_PROVIDERS = [
  { id: "groq", name: "Groq", keysUrl: "https://console.groq.com/keys" },
  { id: "gemini", name: "Google Gemini", keysUrl: "https://aistudio.google.com/apikey" },
  { id: "cerebras", name: "Cerebras", keysUrl: "https://cloud.cerebras.ai" },
  { id: "mistral", name: "Mistral", keysUrl: "https://console.mistral.ai/api-keys" },
  { id: "openrouter", name: "OpenRouter", keysUrl: "https://openrouter.ai/keys" },
  { id: "openai", name: "OpenAI", keysUrl: "https://platform.openai.com/api-keys" },
];
