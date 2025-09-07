// LLM/Agent 라우팅 규칙(독립 프리셋)                                                    // 파일 설명
// - 공급자: OpenAI 기본, 필요 시 Gemini로 전환                                         // 공급자 정책
// - 모델: OpenAI(LLM)와 Claude(Agent)를 **서로 다른 프리셋**으로 선택 가능             // 핵심 변경점
// - 오버라이드: 프롬프트 use:*, ENV, config.preset 순으로 적용                         // 오버라이드 우선순위

function normalize(str) {                                                                // 소문자 정규화 유틸
  return (str || "").toLowerCase();                                                      // 빈 값 방어
}

// 프롬프트 내 공급자 오버라이드(use:openai|gemini) 파싱                                 // 공급자 힌트
function readProviderOverride(userDemand) {                                              // 공급자 오버라이드
  const s = normalize(userDemand);                                                       // 정규화
  const m = s.match(/\buse:(openai|gemini)\b/);                                          // use:openai|gemini
  if (m) return m[1];                                                                    // 매칭 시 반환
  const env = normalize(process.env.LLM_PROVIDER);                                       // ENV 강제
  if (env === "openai" || env === "gemini") return env;                                  // 유효 시 반환
  return null;                                                                           // 없으면 null
}

// 프롬프트 내 **프리셋** 오버라이드 파싱                                                 // 프리셋 힌트
// - LLM(OpenAI/Gemini) : use:openai:default|heavy / use:gemini:default|heavy            // 예시
// - Agent(Claude)      : use:claude:default|heavy                                       // 예시
function readPresetOverrides(userDemand) {                                               // 프리셋 오버라이드
  const s = normalize(userDemand);                                                       // 정규화
  const grab = (re) => { const m = s.match(re); return m ? m[1] : null; };              // 헬퍼
  const llmPreset   = grab(/\buse:(?:openai|gemini):(default|heavy)\b/);                 // LLM 프리셋
  const agentPreset = grab(/\buse:claude:(default|heavy)\b/);                            // Agent 프리셋
  return { llmPreset, agentPreset };                                                     // 결과
}

// ENV/config에서 프리셋 오버라이드 수집                                                   // 외부 소스
function readExternalPresets(tools = {}) {                                               // 외부 프리셋
  const envLLM   = normalize(process.env.LLM_MODEL_PRESET);                              // ENV LLM
  const envAgent = normalize(process.env.CLAUDE_MODEL_PRESET);                           // ENV Agent
  const cfgLLM   = normalize(tools?.openai?.preset);                                     // config LLM
  const cfgAgent = normalize(tools?.claude?.preset);                                     // config Agent
  const canon = (v) => (v === "default" || v === "heavy") ? v : null;                    // 정규화 도우미
  return { llmPreset: canon(envLLM) || canon(cfgLLM), agentPreset: canon(envAgent) || canon(cfgAgent) }; // 병합
}

// 지정된 모드(default|heavy)에 따라 모델 문자열을 선택                                     // 선택기(모드 기반)
function chooseModelByMode(set = {}, mode = "heavy") {                                   // 모드 선택
  const def = set?.default;                                                              // 경량
  const heavy = set?.heavy || def;                                                       // 무거운
  return (mode === "default") ? (def || heavy) : (heavy || def);                         // 모드별 반환
}

// Agent 선택: cursor > claude > none                                                     // 에이전트 우선순위
function chooseAgent(tools = {}) {                                                       // 에이전트 선택
  if (tools.cursor?.cli) return "cursor";                                                // cursor 우선
  if (tools.claude?.cli) return "claude";                                                // 다음 claude
  return "none";                                                                         // 없으면 none
}

/**
 * LLM/Agent 동시 라우팅(프리셋 독립)                                                     // JSDoc
 * @param {Object} p                                                                      // 파라미터
 * @param {string}  p.userDemand         - 사용자 프롬프트                                 // 입력 텍스트
 * @param {boolean} p.planOnly           - 계획만 생성 여부                                // 플래그
 * @param {Object}  p.tools              - config.tools                                    // 설정
 * @param {boolean} p.preferFast         - (구) 전역 빠른 응답 선호                        // 레거시
 * @param {boolean} p.preferFastLLM      - LLM 전용 빠른 응답 선호                         // 분리 플래그
 * @param {boolean} p.preferFastAgent    - Agent 전용 빠른 응답 선호                       // 분리 플래그
 * @returns {{llm:"openai"|"gemini", model:string, agent:"cursor"|"claude"|"none", agentModel:(string|null)}} // 반환
 */
export function pickLLMAndAgent({
  userDemand,                                                                           // 사용자 텍스트
  planOnly,                                                                             // 플랜 전용
  tools = {},                                                                           // 도구 설정
  preferFast,                                                                           // 레거시 fast
  preferFastLLM,                                                                        // LLM fast
  preferFastAgent                                                                       // Agent fast
}) {                                                                                    // 함수 시작
  const providerOverride = readProviderOverride(userDemand);                             // 공급자 힌트
  const inline = readPresetOverrides(userDemand);                                        // 프롬프트 프리셋
  const external = readExternalPresets(tools);                                           // ENV/config 프리셋

  // 1) 공급자 결정(기본 openai, 힌트가 gemini면 전환)                                        // 공급자
  let llm = "openai";                                                                    // 초기값
  if (providerOverride === "gemini") llm = "gemini";                                     // gemini 강제
  else if (providerOverride === "openai") llm = "openai";                                // openai 유지

  // 2) LLM 모델 모드 계산 (default|heavy)                                                  // LLM 모드
  const modeLLM =
    inline.llmPreset ||                                                                  // 프롬프트 우선
    external.llmPreset ||                                                                // ENV/config 다음
    ((planOnly || preferFastLLM || preferFast) ? "default" : "heavy");                   // 규칙 폴백

  // 3) Agent(Claude) 모델 모드 계산 (default|heavy)                                        // Agent 모드
  const modeAgent =
    inline.agentPreset ||                                                                // 프롬프트 우선
    external.agentPreset ||                                                              // ENV/config 다음
    ((preferFastAgent ?? preferFast) ? "default" : "heavy");                              // 규칙 폴백

  // 4) 실제 모델 문자열 선택                                                                // 모델 선택
  const openaiModel = chooseModelByMode(tools.openai || {}, modeLLM) || "gpt-4o-mini";   // OpenAI 모델
  const geminiModel = chooseModelByMode(tools.gemini || {}, modeLLM) || "gemini-2.5-flash"; // Gemini 모델
  const model = (llm === "openai") ? openaiModel : geminiModel;                          // LLM 모델

  // 5) 에이전트/에이전트 모델 선택                                                          // 에이전트 선택
  const agent = chooseAgent(tools);                                                      // cursor/claude/none
  const agentModel = (agent === "claude")                                                // Claude일 때만
    ? chooseModelByMode({                                                                // Claude 모델셋
        default: tools?.claude?.default || "claude-3-haiku-latest",                     // 디폴트
        heavy:   tools?.claude?.heavy   || tools?.claude?.default || "claude-3.5-sonnet-latest" // 헤비
      }, modeAgent)                                                                      // 모드 적용
    : null;                                                                              // 없으면 null

  return { llm, model, agent, agentModel };                                              // 결과 반환
}                                                                                        // 함수 끝

export { chooseModelByMode as chooseModel };                                             // 하위 호환 export
