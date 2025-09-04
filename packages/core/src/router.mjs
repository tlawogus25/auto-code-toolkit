// LLM/Agent 라우팅 규칙
// - 기본: OpenAI 1순위, 필요 시 Gemini로만 명시적 전환
// - 모델 선택: planOnly/빠른 응답 선호(preferFast)면 경량(default), 그 외 heavy 우선
// - 에이전트: cursor > claude > none

function normalize(str) {
  return (str || "").toLowerCase();
}

// 사용자의 명시적 오버라이드(프롬프트 안의 힌트 또는 ENV)
function readProviderOverride(userDemand) {
  const s = normalize(userDemand);
  // 프롬프트에 use:openai / use:gemini 가 포함되면 최우선 반영
  const m = s.match(/\buse:(openai|gemini)\b/);
  if (m) return m[1];

  // 환경변수 LLM_PROVIDER=openai|gemini 로 전역 고정 가능
  const env = normalize(process.env.LLM_PROVIDER);
  if (env === "openai" || env === "gemini") return env;

  return null;
}

// planOnly 또는 빠른 응답 선호 시 경량(default), 그 외 heavy 우선
function chooseModel(set = {}, { planOnly, preferFast }) {
  const def = set.default;
  const heavy = set.heavy || def;

  if (planOnly || preferFast) return def || heavy;
  return heavy || def;
}

// Agent 선택: cursor > claude > none
function chooseAgent(tools = {}) {
  if (tools.cursor?.cli) return "cursor";
  if (tools.claude?.cli) return "claude";
  return "none";
}

/**
 * OpenAI 우선 라우팅
 * @param {Object} p
 * @param {string} p.userDemand  - 사용자 프롬프트(본문)
 * @param {boolean} p.planOnly   - 계획만 생성 모드
 * @param {Object} p.tools       - config.toolkit.config.json 의 tools 섹션
 * @param {boolean} p.preferFast - 빠른 응답 선호
 * @returns {{ llm: "openai"|"gemini", model: string, agent: "cursor"|"claude"|"none" }}
 */
export function pickLLMAndAgent({ userDemand, planOnly, tools = {}, preferFast }) {
  const override = readProviderOverride(userDemand);

  // 1) 기본은 OpenAI, 오버라이드가 'gemini'일 때만 Gemini로 변경
  let llm = "openai";
  if (override === "gemini") llm = "gemini";
  else if (override === "openai") llm = "openai";

  // 2) 모델 고르기 (각 공급자에 설정된 default/heavy를 이용)
  const openaiModel = chooseModel(tools.openai, { planOnly, preferFast }) || "gpt-4o-mini";
  const geminiModel = chooseModel(tools.gemini, { planOnly, preferFast }) || "gemini-2.5-flash";

  // 만약 OpenAI 설정이 전혀 없으면(키 미설정 등) 안전하게 Gemini로 폴백
  if (llm === "openai" && !tools.openai) {
    llm = "gemini";
  }
  // 반대로 Gemini 설정이 없는데 override로 강제된 경우엔 OpenAI로 폴백
  if (llm === "gemini" && !tools.gemini) {
    llm = "openai";
  }

  const model = llm === "openai" ? openaiModel : geminiModel;

  // 3) Agent 선택
  const agent = chooseAgent(tools);

  return { llm, model, agent };
}

export { chooseModel }; // 필요 시 다른 모듈에서 재사용
