import { GoogleGenAI } from "@google/genai";

export function makeGemini(apiKey) {
  if (!apiKey) throw new Error("GEMINI_API_KEY required");
  return new GoogleGenAI({ apiKey });
}

// Return { text, usage: null }
export async function runGemini({ client, model, user }) {
  const r = await client.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: user }]}]
  });
  return { text: (r.response?.text() || ""), usage: null };
}
