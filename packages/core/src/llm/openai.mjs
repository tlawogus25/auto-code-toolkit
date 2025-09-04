import OpenAI from "openai";

/**
 * OpenAI SDK 클라이언트 생성
 */
export function makeOpenAI(apiKey) {
  if (!apiKey) throw new Error("OPENAI_API_KEY required");
  return new OpenAI({ apiKey });
}

/**
 * 이 모델이 reasoning 파라미터를 지원하는지 판별
 * - o3 / o4 / (향후) -reasoning 접미 계열만 허용
 */
function supportsReasoning(model = "") {
  const m = String(model).toLowerCase();
  return (
    m.startsWith("o3") ||
    m.startsWith("o4") ||
    m.includes("reasoning")
  );
}

/**
 * OpenAI Responses API 호출
 * - reasoning 미지원 모델에서 400이 나지 않도록 안전 가드 장착
 * - 반환: { text, usage }
 */
export async function runOpenAI({ client, model, system, user, reasoning }) {
  const input = [
    { role: "system", content: system || "" },
    { role: "user", content: user || "" },
  ];

  const payload = { model, input };

  // ⚠️ 모델이 지원할 때만 reasoning 전달
  if (reasoning && supportsReasoning(model)) {
    payload.reasoning = reasoning;
  }

  const r = await client.responses.create(payload);

  const usage = r.usage || r.output?.[0]?.usage || null;
  const text = r.output_text || "";

  return { text, usage };
}
