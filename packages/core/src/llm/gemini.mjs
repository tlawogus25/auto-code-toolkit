// import: 구글 Gemini SDK를 불러옵니다.
import { GoogleGenAI } from "@google/genai";

// makeGemini: API 키로 Gemini 클라이언트를 생성합니다.
export function makeGemini(apiKey) {
  // 키가 없으면 명확한 에러를 던져 설정 문제를 조기 발견합니다.
  if (!apiKey) throw new Error("GEMINI_API_KEY required");
  // 클라이언트를 생성해 반환합니다.
  return new GoogleGenAI({ apiKey });
}

// sleep: 지정한 밀리초(ms) 만큼 대기하는 Promise 유틸입니다.
function sleep(ms) {
  // setTimeout 래핑으로 비동기 대기 구현
  return new Promise((r) => setTimeout(r, ms));
}

// isTransientGeminiError: 재시도 가치가 있는 일시적 오류인지 판단합니다.
function isTransientGeminiError(err) {
  // 메시지를 문자열로 정규화합니다.
  const msg = String(err?.message || err || "");
  // 라이브러리/서버가 제공하는 코드/상태를 최대한 추출합니다.
  const code = err?.code ?? err?.status ?? err?.error?.code;
  // 429/503 은 과부하/요율 제한이므로 재시도 대상으로 봅니다.
  if (code === 429 || code === 503) return true;
  // 상태 문자열에 UNAVAILABLE 이 포함되면 재시도 대상으로 간주합니다.
  if (/UNAVAILABLE/i.test(msg)) return true;
  // 메시지에 overload/overloaded/rate/quota/try again 등이 있으면 재시도합니다.
  if (/overload|overloaded|rate|quota|try again/i.test(msg)) return true;
  // 그 외는 재시도하지 않습니다.
  return false;
}

// runGemini: 프롬프트를 전송해 텍스트를 받고, 일시 오류 시 지수 백오프로 재시도합니다.
export async function runGemini({ client, model, user, maxAttempts = 3 }) {
  // 시도 횟수를 0으로 시작합니다.
  let attempt = 0;
  // 마지막 에러를 보관할 변수를 준비합니다.
  let lastErr = null;
  // 최대 시도 횟수까지 루프를 돌립니다.
  while (attempt < maxAttempts) {
    // 현재 시도를 1 증가시킵니다.
    attempt += 1;
    try {
      // Gemini SDK로 콘텐츠 생성을 요청합니다.
      const r = await client.models.generateContent({
        // 사용할 모델을 지정합니다.
        model,
        // 사용자 입력을 SDK 포맷에 맞춰 전달합니다.
        contents: [{ role: "user", parts: [{ text: user }]}],
      });
      // 응답 텍스트를 안전하게 추출합니다(없으면 빈 문자열).
      return { text: (r.response?.text() || ""), usage: null };
    } catch (e) {
      // 에러를 저장해 두고 재시도 여부를 판단합니다.
      lastErr = e;
      // 일시 오류가 아니거나, 마지막 시도였다면 재시도를 중단합니다.
      if (!isTransientGeminiError(e) || attempt >= maxAttempts) break;
      // 지수 백오프(500ms * 2^(시도-1))를 계산합니다.
      const delay = 500 * Math.pow(2, attempt - 1);
      // 경고 로그를 남겨 진단에 도움을 줍니다.
      console.warn(`[gemini] transient error (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms:`, String(e?.message||e));
      // 계산한 시간만큼 대기합니다.
      await sleep(delay);
      // 다음 루프로 넘어가 재시도합니다.
    }
  }
  // 여기까지 오면 모든 시도가 실패했으므로 마지막 에러를 던집니다.
  throw lastErr || new Error("Gemini call failed");
}