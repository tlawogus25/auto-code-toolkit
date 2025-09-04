import { readFileSync, writeFileSync, existsSync } from "node:fs";             // 파일 읽기/쓰기/존재 확인
import { execSync } from "node:child_process";                                 // gh 등 외부 명령 실행
import path from "node:path";                                                  // 경로 처리
import fs from "node:fs";                                                      // 파일 시스템 유틸
import process from "node:process";                                            // 환경 변수 등 처리
import { loadPlugins } from "./tokens/registry.mjs";                           // /auto 토큰 확장 로더
import { pickLLMAndAgent } from "./router.mjs";                                // LLM/에이전트 라우팅
import { makeOpenAI, runOpenAI } from "./llm/openai.mjs";                      // OpenAI 클라이언트/호출
import { makeGemini, runGemini } from "./llm/gemini.mjs";                      // Gemini 클라이언트/호출
import { runWithClaude } from "./agents/claude.mjs";                            // Claude 에이전트 실행기
import { runWithCursor } from "./agents/cursor.mjs";                            // Cursor 에이전트 실행기

function nowIso(){ return new Date().toISOString(); }                          // ISO 타임스탬프 유틸

export async function runOrchestrator({ repoRoot, configPath, eventPath }) {   // 메인 오케스트레이터
  const cfg = JSON.parse(readFileSync(path.join(repoRoot, configPath), "utf8")); // 설정 JSON 로드
  const tools = cfg.tools || {};                                               // 도구 설정
  const policy = cfg.policy || {};                                             // 정책(경로, 제한 등)
  const labelsCfg = cfg.labels || {};                                          // 라벨 키 설정
  const pluginsPaths = cfg.plugins || [];                                      // 플러그인 경로
  const pipeline = cfg.pipeline || { commands: {} };                           // 파이프라인 훅

  const evt = JSON.parse(readFileSync(eventPath, "utf8"));                     // GitHub 이벤트 JSON
  const isIssue = !!evt.issue && !evt.comment;                                 // 이슈인지 여부
  const rawBody = (isIssue ? (evt.issue.body || "") : (evt.comment.body || "")).trim(); // /auto 본문
  const labels = (evt.issue?.labels || []).map(l => l.name || "");             // 라벨 목록

  if (!rawBody.startsWith("/auto")) return { skipped: true };                  // /auto 아닌 이벤트 스킵
  if (!labels.includes(labelsCfg.run || "automation:run")) return { skipped: true }; // 트리거 라벨 검증

  const { tokens, hooks } = await loadPlugins(pluginsPaths, repoRoot);         // 토큰/훅 로드
  const after = rawBody.replace(/^\/auto\s*/i, "");                             // /auto 제거 후 문자열
  const m = after.match(/^((?:[\w:-]+)\b\s*)+/i) || [""];                      // 토큰 시퀀스 매칭
  const seq = (m[0] || "").trim().split(/\s+/).filter(Boolean);               // 토큰 배열
  const rest = after.slice((m[0]||"").length).trim();                          // 사용자 요구 본문

  const ctx = {                                                                // 컨텍스트(상태 저장)
    repoRoot, cfg, tools, policy, labels, pipeline,                           // 환경/설정
    tokens: seq, tokenFlags: {},                                              // /auto 토큰과 플래그
    userDemand: rest,                                                         // 사용자 요구 텍스트
    llm: null, model: null, agent: null,                                      // 선택된 LLM/모델/에이전트
    agentPrompt: "",                                                          // 에이전트 입력 프롬프트
    planOnly: false, preferFast: false,                                       // 플랜 전용/속도 선호
    longMode: false, budgetMinutes: null, budgetSteps: null,                  // 장시간 모드 파라미터
    loopSummary: { startedAt: nowIso(), steps: [] },                          // 루프 요약
    usageTotals: { openai: { input:0, output:0 }, gemini: { input:0, output:0 } }, // 토큰 사용량
    diagnostics: { last: null },                                              // 마지막 진단 정보
    prNumber: null, branch: null                                              // PR 번호/작업 브랜치
  };

  for (const t of seq) { const h = tokens.get(t.toLowerCase()); if (h) await h(ctx); } // 토큰 핸들러 실행

  const highCost = labels.includes(labelsCfg.highCost || "automation:high-cost"); // 고비용 라벨 여부
  const max = policy.hard_stop_chars_without_high_cost_label ?? 20000;            // 허용 길이 상한
  const planThreshold = policy.plan_only_threshold_chars ?? 8000;                 // 플랜 전용 기준
  if (!(ctx.tokenFlags?.force && highCost)) {                                     // 강제+고비용 아니라면
    if (ctx.userDemand.length > max && !highCost) throw new Error("Input too long without high-cost label."); // 과길이 차단
  }
  ctx.planOnly = ctx.planOnly || (ctx.userDemand.length > planThreshold && !highCost); // 플랜 모드 전환

  const route = pickLLMAndAgent({ userDemand: ctx.userDemand, planOnly: ctx.planOnly, tools, preferFast: ctx.preferFast }); // 라우팅
  ctx.llm = route.llm; ctx.model = route.model; ctx.agent = route.agent;        // 선택 적용

  for (const h of hooks.beforeLLM) await h(ctx);                                // LLM 호출 전 훅

  const systemGuard = [                                                         // 가드레일 텍스트
    "[에이전트 가드레일]",
    `- 허용 경로: ${(policy.allowed_globs||["src/**","app/**","docs/**"]).join(", ")}`,
    `- 금지 경로: ${(policy.forbidden_globs||[".env*","secrets/**",".git/**"]).join(", ")}`,
    "- .env* / 비밀키 / .git 은 읽기·쓰기도 금지",
    "- 테스트가 있으면 실행 전략 제안",
    "- 변경은 설명 가능한 작은 커밋 단위 권장",
    "- 절대 쉘/Bash 명령을 실행하지 말 것(파일 편집/패치만 수행)",
    "- 존재하지 않는 디렉터리는 패치 내에서 생성 후 파일을 추가"
  ].join("\n");

  const content = [                                                             // LLM 입력 콘텐츠
    systemGuard, "\n[사용자 요구]", ctx.userDemand, "\n[원하는 산출물]",
    "- 변경 개요(목록)", "- 파일별 수정 계획", "- 안전 체크리스트",
    ctx.planOnly ? "- (플랜 전용: 실행명령 생략)" : "- 최종 실행할 수정 단계"
  ].join("\n");

  async function callOpenAIOnce({ userText }) {                                 // OpenAI 단발 호출(폴백용)
    const fallbackModel = (ctx.tools?.openai?.default) || "gpt-4o-mini";        // 기본 모델
    const { text, usage } = await runOpenAI({                                   // OpenAI 호출
      client: makeOpenAI(process.env.OPENAI_API_KEY),                           // 클라이언트
      model: fallbackModel,                                                     // 모델
      system: systemGuard,                                                      // 시스템 가드레일
      user: userText,                                                           // 사용자 입력
      reasoning: { effort: ctx.planOnly ? "medium" : "high" }                   // 추론 강도
    });
    if (usage) {                                                                // 토큰 집계
      ctx.usageTotals.openai.input += (usage.input_tokens||0);
      ctx.usageTotals.openai.output += (usage.output_tokens||0);
    }
    return text || "";                                                          // 텍스트 반환
  }

  async function genPrompt(){                                                   // 에이전트 프롬프트 생성
    if (ctx.llm === "openai") {                                                 // OpenAI 경로
      const { text, usage } = await runOpenAI({                                 // OpenAI 호출
        client: makeOpenAI(process.env.OPENAI_API_KEY),                         // 클라이언트
        model: ctx.model, system: systemGuard, user: content,                   // 파라미터
        reasoning: { effort: ctx.planOnly ? "medium" : "high" }                 // 추론 강도
      });
      if (usage) {                                                              // 토큰 집계
        ctx.usageTotals.openai.input += (usage.input_tokens||0);
        ctx.usageTotals.openai.output += (usage.output_tokens||0);
      }
      return text || "";                                                        // 텍스트
    } else {                                                                     // Gemini 경로
      try {
        const { text } = await runGemini({                                      // Gemini 호출
          client: makeGemini(process.env.GEMINI_API_KEY),                       // 클라이언트
          model: ctx.model,                                                     // 모델
          user: content                                                         // 입력
        });
        if (!text || !String(text).trim()) {                                    // 빈 응답이면
          const t = await callOpenAIOnce({ userText: content });                // OpenAI 폴백 1회
          return t || "";                                                       // 결과 반환
        }
        return text;                                                            // 정상 텍스트
      } catch (e) {                                                             // 예외 시
        ctx.diagnostics.last = { type: "llm-fallback", from: "gemini", to: "openai", message: String(e?.message || e) }; // 진단 기록
        const t = await callOpenAIOnce({ userText: content });                  // OpenAI 폴백
        return t || "";                                                         // 결과 반환
      }
    }
  }

  function synthesizePrompt() {                                                 // 안전 기본 프롬프트 합성
    return [
      "You are a senior full-stack engineer acting as an autonomous code agent.",
      "Follow these guardrails strictly:",
      systemGuard,
      "",
      "[Task]",
      ctx.userDemand || "No explicit task text was provided. Propose a minimal safe change within allowed paths.",
      "",
      "[Deliverables]",
      "- A short plan",
      "- File-by-file changes",
      "- Safety checklist",
      "- (If allowed) exact commands or edits"
    ].join("\n");
  }

  function normalizeAgentPrompt(text) {                                         // 빈 프롬프트 보정
    const trimmed = (text || "").trim();                                        // 공백 제거
    if (trimmed) return trimmed;                                                // 내용 있으면 그대로
    return synthesizePrompt();                                                  // 없으면 합성 프롬프트
  }

  ctx.agentPrompt = await genPrompt();                                          // 프롬프트 생성
  ctx.agentPrompt = normalizeAgentPrompt(ctx.agentPrompt);                      // 보정 적용
  for (const h of hooks.afterLLM) await h(ctx); 
  if (ctx.tokenFlags?.dryRun) return { dryRun: true, ctx };                     // 드라이런이면 종료
  if (ctx.agent === "none" || ctx.planOnly) return { planOnly: true, ctx };     // 플랜 전용이면 실행 생략

  function checkpointCommit(msg){                                               // 체크포인트 커밋
    try {
      execSync(`git add -A`, { stdio: "inherit" });                             // 변경 스테이징
      execSync(`git commit -m ${JSON.stringify(msg)}`, { stdio: "inherit" });   // 커밋
    } catch {
      console.log("No changes to commit for checkpoint.");                      // 변경 없을 때 메시지
    }
  }

  execSync(`git config user.name "github-actions[bot]"`, { stdio: "inherit" }); // 커밋 사용자 이름
  execSync(`git config user.email "github-actions[bot]@users.noreply.github.com"`, { stdio: "inherit" }); // 이메일
  const branch = `auto/${Date.now()}`;                                          // 작업 브랜치 이름
  ctx.branch = branch;                                                          // 컨텍스트에 저장
  execSync(`git checkout -b ${branch}`, { stdio: "inherit" });                  // 브랜치 생성/이동

  const outDir = process.env.AUTO_OUT_DIR                                       // 산출물 디렉토리
    ? path.resolve(process.env.AUTO_OUT_DIR)                                    // 환경변수 우선
    : path.join(repoRoot, ".github", "auto");                                   // 기본 경로
  fs.mkdirSync(outDir, { recursive: true });                                    // 디렉토리 생성
  const cancelPath = path.join(outDir, "CANCEL");                               // 취소 파일 경로
  const start = Date.now();                                                     // 시작 시간

  async function runAgentWithFallback(promptText, tools, policy) {              // 에이전트 실행(폴백 포함)
    const primary = (ctx.agent || "").toLowerCase();                            // 주 에이전트
    const fallback = primary === "claude" ? "cursor" : "claude";                // 폴백 에이전트
    try {
      const safePrompt = normalizeAgentPrompt(promptText);                      // 안전 프롬프트
      if (primary === "claude") await runWithClaude(safePrompt, tools, policy); // 주=Claude 실행
      else await runWithCursor(safePrompt, tools, policy);                      // 주=Cursor 실행
      return { ok: true, used: primary };                                       // 성공 리턴
    } catch (e1) {
      console.log("[Agent error primary]", e1?.message || e1);                  // 1차 에러 로그
      ctx.diagnostics.last = { type: "agent-error", used: primary, message: String(e1?.message || e1) }; // 진단 기록
      try {
        const safePrompt2 = normalizeAgentPrompt(promptText);                   // 폴백도 보정 적용
        if (fallback === "claude") await runWithClaude(safePrompt2, tools, policy); // 폴백=Claude
        else await runWithCursor(safePrompt2, tools, policy);                   // 폴백=Cursor
        return { ok: true, used: `${primary}->${fallback}` };                   // 폴백 성공
      } catch (e2) {
        console.log("[Agent error fallback]", e2?.message || e2);               // 폴백 에러 로그
        ctx.diagnostics.last = { type: "agent-error-fallback", chain: `${primary}->${fallback}`, message: String(e2?.message || e2) }; // 진단
        return { ok: false, used: `${primary}->${fallback}` };                  // 최종 실패
      }
    }
  }

  async function runOneStep(step) {                                             // 단일 스텝 실행
    for (const h of hooks.beforeAgent) await h(ctx);                            // 에이전트 전 훅
    const result = await runAgentWithFallback(ctx.agentPrompt, tools, policy);  // 에이전트+폴백 실행
    for (const h of hooks.afterAgent) await h(ctx);                             // 에이전트 후 훅
    checkpointCommit(`auto: checkpoint step ${step}`);                          // 체크포인트 커밋
    try { execSync(`git push origin ${branch}`, { stdio: "inherit" }); } catch {} // 원격 푸시
    ctx.loopSummary.steps.push({ step, at: new Date().toISOString(), agentUsed: result.used, ok: result.ok }); // 요약 기록
    const diagFile = path.join(outDir, "diagnostics-last.json");                // 진단 파일 경로
    writeFileSync(diagFile, JSON.stringify({ when: nowIso(), logs: [
      { stage: "agent", ok: !!result.ok, out: result.used }
    ]}, null, 2), "utf8");                                                      // 진단 파일 기록
  }

  if (ctx.longMode) {                                                           // 장시간 모드
    const maxMs = (ctx.budgetMinutes||60) * 60 * 1000;                          // 시간 예산
    const maxSteps = ctx.budgetSteps || 3;                                      // 스텝 예산
    for (let step=1; step<=maxSteps; step++) {                                  // 반복
      if (existsSync(cancelPath)) break;                                        // 취소 플래그
      if ((Date.now()-start) > maxMs) break;                                    // 시간 초과
      await runOneStep(step);                                                   // 스텝 수행
    }
  } else {                                                                      // 단발 모드
    await runOneStep(1);                                                        // 1회 수행
  }         
    for (const h of hooks.beforePR) await h(ctx);                                 // PR 전 훅

  const tokenList = (ctx.tokens||[]).join(", ") || "(none)";                    // 토큰 표시
  const labelList = labels.join(", ") || "(none)";                              // 라벨 표시
  const truncatedUserDemand = (ctx.userDemand || "").slice(0, 2000);            // 본문 트렁케이트
  const costLine = `OpenAI usage: in=${ctx.usageTotals.openai.input} out=${ctx.usageTotals.openai.output}`; // 비용 라인

  const infoMd = [                                                              // PR 본문(요약+트렁케이트)
    `## Auto-run Info`,
    ``,
    `- LLM: **${ctx.llm}** (${ctx.model})`,
    `- Agent: **${ctx.agent}**`,
    `- Branch: ${ctx.branch}`,
    `- Labels: ${labelList}`,
    `- Tokens: ${tokenList}`,
    `- ${costLine}`,
    ``,
    `## Prompt (truncated)`,
    "",
    "```",
    truncatedUserDemand,
    "```",
    ""
  ].join("\n");

  const promptMd = [                                                            // 전체 프롬프트 코멘트
    `# Original Prompt`,
    "",
    "```",
    ctx.userDemand,
    "```",
    "",
    "## Last Agent Prompt",
    "",
    "```",
    (ctx.agentPrompt || "").trim(),
    "```"
  ].join("\n");

  const prBodyPath = path.join(outDir, `pr-body-${Date.now()}.md`);             // 본문 파일
  const promptBodyPath = path.join(outDir, `prompt-${Date.now()}.md`);          // 코멘트 파일
  writeFileSync(prBodyPath, infoMd, "utf8");                                     // 본문 기록
  writeFileSync(promptBodyPath, promptMd, "utf8");                               // 코멘트 기록

  const title = `auto: ${ctx.branch} [${ctx.llm}/${ctx.agent}] (tokens: ${tokenList})`; // PR 제목
  execSync(                                                                      // PR 생성
    `gh pr create --title ${JSON.stringify(title)} --body-file ${JSON.stringify(prBodyPath)} --base main --head ${ctx.branch}`,
    { stdio: "inherit" }
  );

  const prNumber = execSync(                                                     // PR 번호 조회
    `gh pr list -s all --head ${ctx.branch} --json number --jq '.[0].number // empty'`
  ).toString().trim();                                                           // 문자열 변환
  ctx.prNumber = prNumber || null;                                               // 저장

  if (prNumber) {                                                                // 번호가 있으면
    execSync(                                                                    // 프롬프트 코멘트 추가
      `gh pr comment ${prNumber} --body-file ${JSON.stringify(promptBodyPath)}`,
      { stdio: "inherit" }
    );
  }

  for (const h of hooks.afterPR) await h(ctx);                                   // PR 후 훅

  return { success: true, branch: ctx.branch, long: ctx.longMode, usage: ctx.usageTotals, prNumber: ctx.prNumber }; // 종료 리턴
}             