import { GoogleGenAI } from "@google/genai";

export function makeGemini(apiKey) {
  if (!apiKey) throw new Error("GEMINI_API_KEY required");
  return new GoogleGenAI({ apiKey });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isTransientGeminiError(err) {
  const msg = String(err?.message || err || "");
  const code = err?.code ?? err?.status ?? err?.error?.code;
  if (code === 429 || code === 503) return true;
  if (/UNAVAILABLE/i.test(msg)) return true;
  if (/overload|overloaded|rate|quota|try again/i.test(msg)) return true;
  return false;
}

export async function runGemini({ client, model, user, maxAttempts = 3 }) {
  let attempt = 0;
  let lastErr = null;
  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const r = await client.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: user }]}],
      });
      const txt = (r.response?.text() || "");
      // ❶ 빈 텍스트를 성공으로 돌려보내지 않음 → 오케스트레이터 폴백 유도
      if (!txt.trim()) throw new Error("Gemini returned empty text");
      return { text: txt, usage: null };
    } catch (e) {
      lastErr = e;
      if (!isTransientGeminiError(e) || attempt >= maxAttempts) break;
      const delay = 500 * Math.pow(2, attempt - 1);
      console.warn(`[gemini] transient error (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms:`, String(e?.message||e));
      await sleep(delay);
    }
  }
  throw lastErr || new Error("Gemini call failed");
}
