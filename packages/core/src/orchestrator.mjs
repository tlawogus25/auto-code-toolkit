// orchestrator.mjs                                                                    // 파일: 오케스트레이터 본체
// Part 1/2: 개요·의존성·컨텍스트·LLM 라우팅·프롬프트 생성                             // 파트 개요

import { readFileSync, writeFileSync, existsSync } from "node:fs";                     // 파일 입출력 유틸
import { execSync } from "node:child_process";                                         // 외부 명령 실행(gh 등)
import path from "node:path";                                                          // 경로 유틸
import fs from "node:fs";                                                              // 파일시스템 유틸
import process from "node:process";                                                    // 환경변수 접근
import { loadPlugins } from "./tokens/registry.mjs";                                   // /auto 토큰 로더
import { pickLLMAndAgent } from "./router.mjs";                                        // LLM/에이전트 라우팅
import { makeOpenAI, runOpenAI } from "./llm/openai.mjs";                              // OpenAI 어댑터
import { makeGemini, runGemini } from "./llm/gemini.mjs";                              // Gemini 어댑터
import { runWithClaude } from "./agents/claude.mjs";                                    // Claude 실행기
import { runWithCursor } from "./agents/cursor.mjs";                                    // Cursor 실행기

function nowIso(){ return new Date().toISOString(); }                                  // ISO 타임스탬프 유틸

export async function runOrchestrator({ repoRoot, configPath, eventPath }) {           // 엔트리포인트
  const cfg = JSON.parse(readFileSync(path.join(repoRoot, configPath), "utf8"));       // 설정 로드
  const tools = cfg.tools || {};                                                       // 도구 설정
  const policy = cfg.policy || {};                                                     // 정책(경로/제한)
  const labelsCfg = cfg.labels || {};                                                  // 라벨 키 설정
  const pluginsPaths = cfg.plugins || [];                                              // 플러그인 경로
  const pipeline = cfg.pipeline || { commands: {} };                                   // 파이프라인 훅

  const evt = JSON.parse(readFileSync(eventPath, "utf8"));                             // GitHub 이벤트 JSON
  const isIssue = !!evt.issue && !evt.comment;                                         // 이슈 이벤트 여부
  const rawBody = (isIssue ? (evt.issue.body || "") : (evt.comment.body || "")).trim();// 원문(/auto 포함)
  const labels = (evt.issue?.labels || []).map(l => l.name || "");                     // 라벨 목록
  const sourceIssueNumber = evt?.issue?.number || null;                                // ★ 원 이슈 번호 확보

  if (!rawBody.startsWith("/auto")) return { skipped: true };                          // /auto 아니면 스킵
  if (!labels.includes(labelsCfg.run || "automation:run")) return { skipped: true };   // 트리거 라벨 필수

  const { tokens, hooks } = await loadPlugins(pluginsPaths, repoRoot);                 // 토큰/훅 로드
  const after = rawBody.replace(/^\/auto\s*/i, "");                                     // /auto 접두 제거
  const m = after.match(/^((?:[\w:-]+)\b\s*)+/i) || [""];                              // 토큰 시퀀스 추출
  const seq = (m[0] || "").trim().split(/\s+/).filter(Boolean);                       // 토큰 배열
  const rest = after.slice((m[0]||"").length).trim();                                  // 사용자 요구 본문

  const ctx = {                                                                        // 실행 컨텍스트
    repoRoot, cfg, tools, policy, labels, pipeline,                                   // 설정/라벨/훅
    tokens: seq, tokenFlags: {},                                                      // /auto 토큰 상태
    userDemand: rest,                                                                 // 사용자 요구
    llm: null, model: null, agent: null,                                              // 선택된 LLM/모델/에이전트
    agentPrompt: "",                                                                  // 에이전트 프롬프트
    planOnly: false, preferFast: false,                                               // 플랜 전용/속도 선호
    longMode: false, budgetMinutes: null, budgetSteps: null,                          // 장시간 모드 파라미터
    loopSummary: { startedAt: nowIso(), steps: [] },                                  // 루프 요약(스텝별)
    usageTotals: { openai: { input:0, output:0 }, gemini: { input:0, output:0 } },    // 토큰 사용량
    diagnostics: { last: null },                                                      // 마지막 진단
    prNumber: null, branch: null                                                      // 생성된 PR/브랜치
  };

  // ★ 메타로그/스테이지 로그 파일 경로 정의(아티팩트 업로드 대상)
  const outDir = process.env.AUTO_OUT_DIR                                             // 산출물 디렉터리
    ? path.resolve(process.env.AUTO_OUT_DIR)                                          // 환경변수 우선
    : path.join(repoRoot, ".github", "auto");                                         // 기본 경로
  fs.mkdirSync(outDir, { recursive: true });                                          // 디렉터리 생성
  const stageLogPath = path.join(outDir, "stage-log.json");                           // 스테이지 로그 경로
  const runMetaPath  = path.join(outDir, "run-meta.json");                            // 런 메타 경로

  // ★ 스테이지 로그 헬퍼: {stage, ok, details, ts} 배열로 누적 기록
  function appendStage(stage, ok, details){                                           // 단계 로깅 함수
    let arr = [];                                                                     // 초기 배열
    try { arr = JSON.parse(fs.readFileSync(stageLogPath, "utf8")); } catch {}         // 기존 로그 로드
    arr.push({ stage, ok: !!ok, details: details ?? null, ts: nowIso() });            // 새 항목 추가
    fs.writeFileSync(stageLogPath, JSON.stringify(arr, null, 2), "utf8");             // 파일 저장
  }

  // ★ 런 메타 기록: 트리거/출발점/소스 이슈/선택 LLM/모드 등 요약
  function writeRunMeta(extra){                                                       // 메타 쓰기 함수
    const base = {                                                                    // 기본 필드
      startedAt: ctx.loopSummary.startedAt,                                           // 시작 시각
      event: evt.action || "n/a",                                                     // 이벤트 액션
      source: isIssue ? "issue" : "comment",                                          // 소스 타입
      sourceIssueNumber: sourceIssueNumber,                                           // 원 이슈 번호
      tokens: ctx.tokens,                                                             // /auto 토큰들
      planOnly: ctx.planOnly,                                                         // 플랜 전용 여부
      longMode: ctx.longMode,                                                         // 장시간 모드 여부
      llm: ctx.llm, model: ctx.model, agent: ctx.agent,                               // 선택 체인
      branch: ctx.branch, prNumber: ctx.prNumber                                      // 브랜치/PR
    };                                                                                // base 끝
    fs.writeFileSync(runMetaPath, JSON.stringify({ ...base, ...(extra||{}) }, null, 2),"utf8"); // 저장
  }

  appendStage("bootstrap", true, { hasAuto: true, hasRunLabel: true });               // 부트스트랩 기록
  writeRunMeta();                                                                      // 초기 메타 저장

  for (const t of seq) { const h = tokens.get(t.toLowerCase()); if (h) await h(ctx); } // 토큰 핸들러

  const highCost = labels.includes(labelsCfg.highCost || "automation:high-cost");     // 고비용 라벨
  const max = policy.hard_stop_chars_without_high_cost_label ?? 20000;                // 입력 상한
  const planThreshold = policy.plan_only_threshold_chars ?? 8000;                     // 플랜 상한
  if (!(ctx.tokenFlags?.force && highCost)) {                                         // 강제+고비용 제외
    if (ctx.userDemand.length > max && !highCost) {                                   // 상한 초과
      appendStage("guard:input-too-long", false, { len: ctx.userDemand.length });     // 스테이지 기록
      throw new Error("Input too long without high-cost label.");                     // 예외
    }
  }
  ctx.planOnly = ctx.planOnly || (ctx.userDemand.length > planThreshold && !highCost);// 플랜 모드 전환
  appendStage("route:pre", true, { planOnly: ctx.planOnly });                          // 라우트 전 기록

  const route = pickLLMAndAgent({ userDemand: ctx.userDemand, planOnly: ctx.planOnly, tools, preferFast: ctx.preferFast }); // 라우팅
  ctx.llm = route.llm; ctx.model = route.model; ctx.agent = route.agent;              // 선택 적용
  appendStage("route:selected", true, { llm: ctx.llm, model: ctx.model, agent: ctx.agent }); // 라우팅 결과 기록

  for (const h of hooks.beforeLLM) await h(ctx);                                      // LLM 전 훅
  appendStage("hooks:beforeLLM", true, null);                                         // 스테이지 기록

  const systemGuard = [                                                               // 에이전트 가드 문구
    "[에이전트 가드레일]",
    `- 허용 경로: ${(policy.allowed_globs||["src/**","app/**","docs/**"]).join(", ")}`,
    `- 금지 경로: ${(policy.forbidden_globs||[".env*","secrets/**",".git/**"]).join(", ")}`,
    "- .env* / 비밀키 / .git 은 읽기·쓰기도 금지",
    "- 테스트가 있으면 실행 전략 제안",
    "- 변경은 설명 가능한 작은 커밋 단위 권장",
    "- 절대 쉘/Bash 명령을 실행하지 말 것(파일 편집/패치만 수행)",
    "- 존재하지 않는 디렉터리는 패치 내에서 생성 후 파일을 추가"
  ].join("\n");                                                                       // 조합

  const content = [                                                                   // LLM 사용자 입력
    systemGuard, "\n[사용자 요구]", ctx.userDemand, "\n[원하는 산출물]",
    "- 변경 개요(목록)", "- 파일별 수정 계획", "- 안전 체크리스트",
    ctx.planOnly ? "- (플랜 전용: 실행명령 생략)" : "- 최종 실행할 수정 단계"
  ].join("\n");                                                                       // 조합

  async function callOpenAIOnce({ userText }) {                                       // OpenAI 단발 폴백
    const fallbackModel = (ctx.tools?.openai?.default) || "gpt-4o-mini";              // 폴백 모델
    const { text, usage } = await runOpenAI({                                         // 호출
      client: makeOpenAI(process.env.OPENAI_API_KEY),                                 // 클라이언트
      model: fallbackModel,                                                           // 모델
      system: systemGuard,                                                            // 시스템 프롬프트
      user: userText,                                                                 // 유저 텍스트
      reasoning: { effort: ctx.planOnly ? "medium" : "high" }                         // 추론 강도
    });
    if (usage) {                                                                      // 사용량 집계
      ctx.usageTotals.openai.input += (usage.input_tokens||0);                        // 입력 토큰
      ctx.usageTotals.openai.output += (usage.output_tokens||0);                      // 출력 토큰
    }
    return text || "";                                                                // 텍스트 반환
  }

  async function genPrompt(){                                                         // 프롬프트 생성
    try {                                                                             // 예외 처리 래핑
      if (ctx.llm === "openai") {                                                     // OpenAI 경로
        const { text, usage } = await runOpenAI({                                     // 호출
          client: makeOpenAI(process.env.OPENAI_API_KEY),                             // 클라이언트
          model: ctx.model, system: systemGuard, user: content,                       // 파라미터
          reasoning: { effort: ctx.planOnly ? "medium" : "high" }                     // 추론 강도
        });
        if (usage) {                                                                  // 집계
          ctx.usageTotals.openai.input += (usage.input_tokens||0);                    // 입력
          ctx.usageTotals.openai.output += (usage.output_tokens||0);                  // 출력
        }
        appendStage("llm:openai", true, { model: ctx.model });                        // 스테이지 기록
        return text || "";                                                            // 프롬프트 반환
      } else {                                                                         // Gemini 경로
        const { text } = await runGemini({                                            // 호출
          client: makeGemini(process.env.GEMINI_API_KEY),                             // 클라이언트
          model: ctx.model, user: content                                            // 입력
        });
        if (!text || !String(text).trim()) {                                          // 빈 응답
          appendStage("llm:gemini-empty", false, null);                                // 기록
          const t = await callOpenAIOnce({ userText: content });                      // OpenAI 폴백
          appendStage("llm:fallback-openai", !!t, { used: "openai:single" });         // 기록
          return t || "";                                                             // 반환
        }
        appendStage("llm:gemini", true, { model: ctx.model });                        // 기록
        return text;                                                                  // 텍스트 반환
      }
    } catch (e) {                                                                      // 예외
      appendStage("llm:error", false, { message: String(e?.message || e) });          // 에러 기록
      const t = await callOpenAIOnce({ userText: content });                          // OpenAI 폴백
      appendStage("llm:fallback-openai", !!t, { used: "openai:on-error" });           // 기록
      return t || "";                                                                 // 반환
    }
  }

  function synthesizePrompt() {                                                       // 빈값 대비 합성
    return [
      "You are a senior full-stack engineer acting as an autonomous code agent.",
      "Follow these guardrails strictly:",
      systemGuard, "",
      "[Task]", ctx.userDemand || "No explicit task text was provided. Propose a minimal safe change within allowed paths.", "",
      "[Deliverables]", "- A short plan", "- File-by-file changes", "- Safety checklist", "- (If allowed) exact commands or edits"
    ].join("\n");                                                                      // 조합
  }

  function normalizeAgentPrompt(text) {                                               // 빈 프롬프트 보정
    const trimmed = (text || "").trim();                                              // 트림
    return trimmed || synthesizePrompt();                                             // 비면 합성으로 대체
  }

  ctx.agentPrompt = normalizeAgentPrompt(await genPrompt());                           // 프롬프트 생성/보정
  appendStage("llm:prompt-ready", true, { length: ctx.agentPrompt.length });          // 프롬프트 준비 기록
  for (const h of hooks.afterLLM) await h(ctx);                                       // LLM 후 훅
  appendStage("hooks:afterLLM", true, null);                                          // 스테이지 기록

  if (ctx.tokenFlags?.dryRun) { writeRunMeta({ dryRun: true }); return { dryRun: true, ctx }; } // 드라이런 종료
  if (ctx.agent === "none" || ctx.planOnly) { writeRunMeta({ planOnly: ctx.planOnly }); return { planOnly: true, ctx }; } // 플랜 전용 종료
// orchestrator.mjs                                                                    // 파일 동일
// Part 2/2: 에이전트 실행·체크포인트·PR 생성·메타/스테이지 기록                       // 파트 개요

  function checkpointCommit(msg){                                                     // 체크포인트 커밋
    try { execSync(`git add -A`, { stdio: "inherit" }); } catch {}                    // 전체 스테이징
    try { execSync(`git commit -m ${JSON.stringify(msg)}`, { stdio: "inherit" }); }   // 메시지 커밋
    catch { console.log("No changes to commit for checkpoint."); }                    // 변경 없음 안내
  }

  execSync(`git config user.name "github-actions[bot]"`, { stdio: "inherit" });       // 커밋 사용자명
  execSync(`git config user.email "github-actions[bot]@users.noreply.github.com"`, { stdio: "inherit" }); // 이메일
  const branch = `auto/${Date.now()}`;                                                // 작업 브랜치명
  ctx.branch = branch;                                                                 // 컨텍스트 저장
  execSync(`git checkout -b ${branch}`, { stdio: "inherit" });                        // 브랜치 생성/전환
  appendStage("git:branch", true, { branch });                                         // 스테이지 기록
  writeRunMeta();                                                                       // 브랜치 반영 저장

  const cancelPath = path.join(outDir, "CANCEL");                                      // 취소 플래그 경로
  const start = Date.now();                                                            // 시작 시각

  async function runAgentWithFallback(promptText, tools, policy) {                     // 에이전트 실행기
    const primary = (ctx.agent || "").toLowerCase();                                   // 주 에이전트
    const fallback = primary === "claude" ? "cursor" : "claude";                       // 폴백 에이전트
    try {                                                                              // 1차 시도
      const safePrompt = normalizeAgentPrompt(promptText);                             // 안전 프롬프트
      if (primary === "claude") await runWithClaude(safePrompt, tools, policy);        // Claude 실행
      else await runWithCursor(safePrompt, tools, policy);                             // Cursor 실행
      appendStage("agent:primary", true, { used: primary });                           // 성공 기록
      return { ok: true, used: primary };                                              // 결과
    } catch (e1) {                                                                      // 1차 실패
      appendStage("agent:primary", false, { used: primary, error: String(e1?.message||e1) }); // 실패 기록
      try {                                                                            // 폴백 시도
        const safePrompt2 = normalizeAgentPrompt(promptText);                          // 프롬프트 재사용
        if (fallback === "claude") await runWithClaude(safePrompt2, tools, policy);    // Claude 폴백
        else await runWithCursor(safePrompt2, tools, policy);                          // Cursor 폴백
        appendStage("agent:fallback", true, { chain: `${primary}->${fallback}` });     // 폴백 성공 기록
        return { ok: true, used: `${primary}->${fallback}` };                          // 결과
      } catch (e2) {                                                                    // 폴백 실패
        appendStage("agent:fallback", false, { chain: `${primary}->${fallback}`, error: String(e2?.message||e2) }); // 실패 기록
        return { ok: false, used: `${primary}->${fallback}` };                         // 최종 실패
      }
    }
  }

  async function runOneStep(step) {                                                    // 스텝 실행기
    for (const h of hooks.beforeAgent) await h(ctx);                                   // 에이전트 전 훅
    appendStage("hooks:beforeAgent", true, { step });                                   // 기록
    const result = await runAgentWithFallback(ctx.agentPrompt, tools, policy);         // 에이전트+폴백
    for (const h of hooks.afterAgent) await h(ctx);                                    // 에이전트 후 훅
    appendStage("hooks:afterAgent", true, { step, ok: result.ok });                     // 기록
    checkpointCommit(`auto: checkpoint step ${step}`);                                  // 체크포인트 커밋
    try { execSync(`git push origin ${branch}`, { stdio: "inherit" }); } catch {}      // 원격 푸시
    appendStage("git:push", true, { step });                                            // 푸시 기록
    ctx.loopSummary.steps.push({ step, at: nowIso(), agentUsed: result.used, ok: result.ok }); // 요약 누적
    writeRunMeta({ loopSummary: ctx.loopSummary });                                     // 메타 갱신
    const diagFile = path.join(outDir, "diagnostics-last.json");                        // 진단 파일 경로
    writeFileSync(diagFile, JSON.stringify({ when: nowIso(), logs: [                   // 간단 진단
      { stage: "agent", ok: !!result.ok, out: result.used }                             // 결과
    ]}, null, 2), "utf8");                                                              // 저장
  }

  if (ctx.longMode) {                                                                   // 장시간 모드
    const maxMs = (ctx.budgetMinutes||60) * 60 * 1000;                                  // 시간 예산
    const maxSteps = ctx.budgetSteps || 3;                                              // 스텝 예산
    for (let step=1; step<=maxSteps; step++) {                                          // 루프
      if (existsSync(cancelPath)) { appendStage("long:cancel", true, null); break; }    // 취소 감지
      if ((Date.now()-start) > maxMs) { appendStage("long:timeout", false, { maxMs }); break; } // 타임아웃
      await runOneStep(step);                                                           // 스텝 실행
    }
  } else {                                                                              // 단발 모드
    await runOneStep(1);                                                                // 1회 실행
  }

  for (const h of hooks.beforePR) await h(ctx);                                         // PR 전 훅
  appendStage("hooks:beforePR", true, null);                                            // 기록

  const tokenList = (ctx.tokens||[]).join(", ") || "(none)";                            // 토큰 나열
  const labelList = labels.join(", ") || "(none)";                                      // 라벨 나열
  const truncatedUserDemand = (ctx.userDemand || "").slice(0, 2000);                    // 요구 트렁케이트
  const costLine = `OpenAI usage: in=${ctx.usageTotals.openai.input} out=${ctx.usageTotals.openai.output}`; // 비용 요약
  const sourceIssueLine = sourceIssueNumber ? `Source-Issue: #${sourceIssueNumber}` : "Source-Issue: n/a"; // ★ 원 이슈 라인

  const infoMd = [                                                                      // PR 본문(요약)
    `## Auto-run Info`,                                                                 // 제목
    ``,                                                                                 // 공백
    `- LLM: **${ctx.llm}** (${ctx.model})`,                                             // LLM
    `- Agent: **${ctx.agent}**`,                                                        // 에이전트
    `- Branch: ${ctx.branch}`,                                                          // 브랜치
    `- Labels: ${labelList}`,                                                           // 라벨
    `- Tokens: ${tokenList}`,                                                           // 토큰
    `- ${costLine}`,                                                                    // 비용
    `- ${sourceIssueLine}`,                                                             // ★ 원 이슈 참조
    ``,                                                                                 // 공백
    `## Prompt (truncated)`,                                                            // 섹션
    "", "```", truncatedUserDemand, "```", ""                                           // 코드펜스
  ].join("\n");                                                                         // 조합

  const promptMd = [                                                                    // 프롬프트 코멘트
    `# Original Prompt`, "", "```", ctx.userDemand, "```", "",                          // 원문
    "## Last Agent Prompt", "", "```", (ctx.agentPrompt || "").trim(), "```"            // 최종 에이전트 프롬프트
  ].join("\n");                                                                         // 조합

  const prBodyPath = path.join(outDir, `pr-body-${Date.now()}.md`);                     // 본문 파일
  const promptBodyPath = path.join(outDir, `prompt-${Date.now()}.md`);                  // 코멘트 파일
  writeFileSync(prBodyPath, infoMd, "utf8");                                            // 본문 저장
  writeFileSync(promptBodyPath, promptMd, "utf8");                                      // 코멘트 저장

  const title = `auto: ${ctx.branch} [${ctx.llm}/${ctx.agent}] (tokens: ${tokenList})`; // PR 제목
  execSync(                                                                              // gh PR 생성
    `gh pr create --title ${JSON.stringify(title)} --body-file ${JSON.stringify(prBodyPath)} --base main --head ${ctx.branch}`,
    { stdio: "inherit" }                                                                 // 표준 입출력
  );
  appendStage("pr:create", true, { title });                                             // PR 생성 기록

  const prNumber = execSync(                                                             // PR 번호 조회
    `gh pr list -s all --head ${ctx.branch} --json number --jq '.[0].number // empty'`   // jq로 번호 추출
  ).toString().trim();                                                                    // 문자열 변환
  ctx.prNumber = prNumber || null;                                                        // 저장
  writeRunMeta();                                                                          // 메타 갱신
  appendStage("pr:number", !!ctx.prNumber, { prNumber: ctx.prNumber });                   // 번호 기록

  if (prNumber) {                                                                          // 번호 있으면
    execSync(                                                                              // 프롬프트 코멘트 추가
      `gh pr comment ${prNumber} --body-file ${JSON.stringify(promptBodyPath)}`,
      { stdio: "inherit" }                                                                 // 표준 입출력
    );
    appendStage("pr:comment-prompt", true, { prNumber });                                   // 기록
  }

  for (const h of hooks.afterPR) await h(ctx);                                             // PR 후 훅
  appendStage("hooks:afterPR", true, null);                                                // 기록

  writeRunMeta({ finishedAt: nowIso() });                                                  // 종료 메타 저장
  appendStage("done", true, { longMode: ctx.longMode });                                   // 완료 기록

  return { success: true, branch: ctx.branch, long: ctx.longMode, usage: ctx.usageTotals, prNumber: ctx.prNumber }; // 반환
}                                                                                          // 함수 끝

