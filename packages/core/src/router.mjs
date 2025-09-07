// LLM/Agent 라우팅 규칙                                                             // 파일 설명
// - 기본: OpenAI 1순위, 필요 시 Gemini로만 명시적 전환                               // 정책 요약
// - 모델 선택: planOnly/빠른 응답 선호(preferFast)면 경량(default), 그 외 heavy 우선    // 모델 규칙
// - 에이전트: cursor > claude > none                                                // 에이전트 우선순위

function normalize(str) {                                                            // 소문자 정규화 유틸
  return (str || "").toLowerCase();                                                  // 입력이 없을 때 빈 문자열 처리
}

// 사용자의 명시적 오버라이드(프롬프트 안의 힌트 또는 ENV)                              // 제공자 오버라이드 진입
function readProviderOverride(userDemand) {                                          // 오버라이드 판독 함수
  const s = normalize(userDemand);                                                   // 프롬프트를 소문자화
  const m = s.match(/\buse:(openai|gemini)\b/);                                      // use:openai|gemini 힌트 검색
  if (m) return m[1];                                                                // 힌트가 있으면 해당 제공자 사용
  const env = normalize(process.env.LLM_PROVIDER);                                   // ENV로 전역 제공자 고정
  if (env === "openai" || env === "gemini") return env;                              // 유효값이면 반환
  return null;                                                                       // 없으면 null
}

// planOnly 또는 빠른 응답 선호 시 경량(default), 그 외 heavy 우선                         // 모델 선택 규칙
function chooseModel(set = {}, { planOnly, preferFast }) {                           // 모델 선택 함수
  const def = set?.default;                                                          // 경량 모델
  const heavy = set?.heavy || def;                                                   // 무거운 모델(없으면 def 대체)
  if (planOnly || preferFast) return def || heavy;                                   // 플랜/빠른 응답 → 경량 우선
  return heavy || def;                                                               // 그 외 → heavy 우선
}

// Agent 선택: cursor > claude > none                                                // 에이전트 결정 규칙
function chooseAgent(tools = {}) {                                                   // 에이전트 선택 함수
  if (tools.cursor?.cli) return "cursor";                                            // cursor CLI 있으면 우선
  if (tools.claude?.cli) return "claude";                                            // 다음 순위 claude
  return "none";                                                                     // 없으면 비활성
}

// Claude Agent의 모델 선택(OPENAI와 동일 규칙 재사용)                                   // Claude 모델 선택
function chooseAgentModel(tools = {}, flags = {}) {                                  // agentModel 선택 함수
  const set = tools?.claude || {};                                                   // tools.claude 섹션
  const modelSet = {                                                                 // 안전 폴백 포함
    default: set.default || "claude-3-haiku-latest",                                 // 경량 기본값
    heavy: set.heavy || set.default || "claude-3.5-sonnet-latest"                    // 무거운 기본값
  };                                                                                 // 폴백 구성 끝
  return chooseModel(modelSet, flags);                                               // 기존 규칙으로 선택
}

/**
 * OpenAI 우선 라우팅                                                                  // JSDoc 개요
 * @param {Object} p                                                                  // 파라미터 객체
 * @param {string} p.userDemand  - 사용자 프롬프트(본문)                               // 입력 텍스트
 * @param {boolean} p.planOnly   - 계획만 생성 모드                                    // 플랜 전용
 * @param {Object} p.tools       - config.toolkit.config.json 의 tools 섹션            // 도구 설정
 * @param {boolean} p.preferFast - 빠른 응답 선호                                     // 빠른 모드
 * @returns {{ llm: "openai"|"gemini", model: string, agent: "cursor"|"claude"|"none", agentModel: (string|null) }} // 반환 스키마
 */
export function pickLLMAndAgent({ userDemand, planOnly, tools = {}, preferFast }) {   // 라우팅 메인 함수
  const override = readProviderOverride(userDemand);                                  // 제공자 오버라이드 조회

  // 1) 기본은 OpenAI, 오버라이드가 'gemini'일 때만 Gemini로 변경                         // 제공자 결정
  let llm = "openai";                                                                 // 초기값 openai
  if (override === "gemini") llm = "gemini";                                          // 힌트로 gemini 강제
  else if (override === "openai") llm = "openai";                                     // 힌트가 openai면 유지

  // 2) 모델 고르기 (각 공급자에 설정된 default/heavy를 이용)                               // 모델 선택
  const openaiModel = chooseModel(tools.openai || {}, { planOnly, preferFast }) || "gpt-4o-mini"; // OpenAI 모델
  const geminiModel = chooseModel(tools.gemini || {}, { planOnly, preferFast }) || "gemini-2.5-flash"; // Gemini 모델

  // 만약 OpenAI 설정이 전혀 없으면(키 미설정 등) 안전하게 Gemini로 폴백                    // 공급자 폴백
  if (llm === "openai" && !tools.openai) {                                            // OpenAI 설정 없음
    llm = "gemini";                                                                    // Gemini로 폴백
  }
  // 반대로 Gemini 설정이 없는데 override로 강제된 경우엔 OpenAI로 폴백                     // 역폴백
  if (llm === "gemini" && !tools.gemini) {                                            // Gemini 설정 없음
    llm = "openai";                                                                     // OpenAI로 폴백
  }

  const model = llm === "openai" ? openaiModel : geminiModel;                          // 최종 LLM 모델

  // 3) Agent 선택 + Claude agentModel 선택                                              // 에이전트/모델
  const agent = chooseAgent(tools);                                                    // 에이전트 결정
  const agentModel = agent === "claude"                                               // Claude일 때만
    ? chooseAgentModel(tools, { planOnly, preferFast })                                // agentModel 선택
    : null;                                                                            // 아니면 null

  return { llm, model, agent, agentModel };                                            // 결과 반환
}

export { chooseModel };                                                                // 외부 재사용을 위해 export
