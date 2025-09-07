// packages/core/src/orchestrator.mjs                                                        // 오케스트레이터 본체
// Part 1/2: 개요·의존성·컨텍스트·LLM/Agent 라우팅(독립 프리셋)·프롬프트 생성                 // 파트 개요

import { readFileSync, writeFileSync, existsSync } from "node:fs";                         // 파일 IO 유틸
import { execSync } from "node:child_process";                                             // 외부 명령 실행
import path from "node:path";                                                              // 경로 유틸
import fs from "node:fs";                                                                  // 파일시스템
import process from "node:process";                                                        // 프로세스/ENV
import { loadPlugins } from "./tokens/registry.mjs";                                       // /auto 토큰 로더
import { pickLLMAndAgent } from "./router.mjs";                                            // 라우터(독립 프리셋)
import { makeOpenAI, runOpenAI } from "./llm/openai.mjs";                                  // OpenAI 어댑터
import { makeGemini, runGemini } from "./llm/gemini.mjs";                                  // Gemini 어댑터
import { runWithClaude } from "./agents/claude.mjs";                                       // Claude 실행기
import { runWithCursor } from "./agents/cursor.mjs";                                       // Cursor 실행기

function nowIso(){ return new Date().toISOString(); }                                      // ISO 타임스탬프

export async function runOrchestrator({ repoRoot, configPath, eventPath }) {               // 엔트리 포인트
  const cfg = JSON.parse(readFileSync(path.join(repoRoot, configPath), "utf8"));           // 설정 로드
  const tools = cfg.tools || {};                                                           // 도구 설정
  const policy = cfg.policy || {};                                                         // 정책 설정
  const labelsCfg = cfg.labels || {};                                                      // 라벨 키
  const pluginsPaths = cfg.plugins || [];                                                  // 플러그인 목록
  const pipeline = cfg.pipeline || { commands: {} };                                       // 파이프라인 훅

  let evt = {};                                                                            // 이벤트 객체
  try { evt = JSON.parse(readFileSync(eventPath, "utf8")); } catch {}                      // 로드 실패 허용

  const eventName = process.env.GITHUB_EVENT_NAME || "";                                   // 이벤트명
  const isIssue = !!evt.issue && !evt.comment;                                             // 이슈 이벤트 여부
  const isDispatch = eventName === "workflow_dispatch";                                    // 디스패치 여부

  const dispatchBody = (evt?.inputs?.body ?? process.env.AUTO_INPUT_BODY ?? "");           // 디스패치 본문
  const issueBody    = (evt?.issue?.body ?? "");                                           // 이슈 본문
  const commentBody  = (evt?.comment?.body ?? "");                                         // 코멘트 본문
  const rawBody = (isDispatch ? dispatchBody : (isIssue ? issueBody : commentBody)).trim();// 최종 본문

  const labels = (evt.issue?.labels || []).map(l => l?.name || "");                        // 라벨 목록
  const sourceIssueNumber = evt?.issue?.number || null;                                    // 원 이슈 번호

  if (!rawBody || !rawBody.startsWith("/auto")) return { skipped: true };                  // /auto 가드

  if (!isDispatch) {                                                                       // 디스패치 외
    if (!labels.includes(labelsCfg.run || "automation:run")) return { skipped: true };    // 라벨 가드
  }

  const outDir = process.env.AUTO_OUT_DIR                                                  // 산출물 디렉터리
    ? path.resolve(process.env.AUTO_OUT_DIR)                                               // ENV 우선
    : path.join(repoRoot, ".github", "auto");                                              // 기본 경로
  fs.mkdirSync(outDir, { recursive: true });                                               // 경로 보장
  const stageLogPath = path.join(outDir, "stage-log.json");                                // stage 로그 경로
  const runMetaPath  = path.join(outDir, "run-meta.json");                                 // run 메타 경로

  const RUN_ID = Date.now();                                                               // 실행 식별자
  const SERVICE_ROOT = process.env.AUTO_SERVICE_ROOT                                       // 서비스 루트
    ? path.resolve(repoRoot, process.env.AUTO_SERVICE_ROOT)                                // ENV 우선
    : path.join(repoRoot, "apps", `auto-${RUN_ID}`);                                       // 기본 apps/
  const REL_SERVICE_ROOT = path.relative(repoRoot, SERVICE_ROOT) || ".";                   // 상대 경로
  fs.mkdirSync(path.join(SERVICE_ROOT, "app"),   { recursive: true });                     // app/
  fs.mkdirSync(path.join(SERVICE_ROOT, "src"),   { recursive: true });                     // src/
  fs.mkdirSync(path.join(SERVICE_ROOT, "tests"), { recursive: true });                     // tests/
  fs.mkdirSync(path.join(SERVICE_ROOT, "docs"),  { recursive: true });                     // docs/
  const readmePath = path.join(SERVICE_ROOT, "README.md");                                 // README 경로
  if (!existsSync(readmePath)) {                                                           // 없으면
    fs.writeFileSync(                                                                      // 초기 파일 생성
      readmePath,                                                                          // 대상
      `# Auto Service Root

      - This directory is the sandbox for generated code.
      - Create app/src/docs/tests under here.

      `,                                                                                         // 내용
      "utf8"                                                                               // 인코딩
    );                                                                                     // 쓰기 끝
  }

  function appendStage(stage, ok, details){                                                // stage 기록 유틸
    let arr = [];                                                                          // 배열 초기화
    try { arr = JSON.parse(fs.readFileSync(stageLogPath, "utf8")); } catch {}              // 기존 로드
    arr.push({ stage, ok: !!ok, details: details ?? null, ts: nowIso() });                 // 항목 추가
    fs.writeFileSync(stageLogPath, JSON.stringify(arr, null, 2), "utf8");                  // 저장
  }
  function writeRunMeta(extra){                                                            // 메타 기록 유틸
    const base = {                                                                         // 기본 필드
      startedAt: nowIso(),                                                                 // 시작 시각
      event: evt.action || eventName || "n/a",                                             // 이벤트
      source: isIssue ? "issue" : (isDispatch ? "dispatch" : "comment"),                   // 소스 유형
      sourceIssueNumber,                                                                   // 원 이슈
      tokens: [],                                                                          // 토큰 목록
      planOnly: false,                                                                     // 플랜 전용
      longMode: false,                                                                     // 장기 모드
      llm: null, model: null, agent: null, agentModel: null,                               // LLM/Agent 메타
      branch: null, prNumber: null,                                                        // Git 메타
      serviceRoot: REL_SERVICE_ROOT                                                        // 서비스 루트
    };
    try {
      const prev = JSON.parse(fs.readFileSync(runMetaPath, "utf8"));                       // 기존 읽기
      fs.writeFileSync(runMetaPath, JSON.stringify({ ...prev, ...base, ...(extra||{}) }, null, 2), "utf8"); // 병합 저장
    } catch {
      fs.writeFileSync(runMetaPath, JSON.stringify({ ...base, ...(extra||{}) }, null, 2), "utf8");          // 신규 저장
    }
  }
  appendStage("scaffold:service-root", true, { serviceRoot: REL_SERVICE_ROOT });           // 스캐폴딩 로그
  appendStage("bootstrap", true, {                                                         // 부트스트랩 로그
    hasAuto: true,                                                                         // /auto 존재
    hasRunLabel: isDispatch ? "n/a(dispatch)" : labels.includes(labelsCfg.run || "automation:run") // 라벨 상태
  });
  writeRunMeta();                                                                          // 메타 초기화

  function toRegexes(globs = []) {                                                         // 글롭→정규식
    return globs.map(s => new RegExp(s.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*")));  // 치환 규칙
  }
  function matchesAny(p, regs) { return regs.some(r => r.test(p)); }                       // 경로 매칭

  function stageForCommit() {                                                              // 스테이징 함수
    try {
      execSync(`git add -A`, { stdio: "inherit" });                                        // 전체 스테이징
      execSync(`git restore --staged .github/auto || true`, { stdio: "inherit" });         // 산출물 제외
    } catch (e) {
      console.log("stageForCommit: ignored error", e?.message || e);                       // 무시 로그
    }
  }

  function getStagedPaths() {                                                              // 스테이지 목록
    const out = execSync(`git diff --name-only --cached`, { encoding: "utf8" }).trim();    // 변경 목록
    return out ? out.split("\n") : [];                                                     // 배열 반환
  }

  function validateStagedPathsOrThrow(pol) {                                               // 정책 검증
    const allowedRegs   = toRegexes(pol.allowed_globs   || ["^src/","^app/","^docs/","^apps/","^services/","^README\\.md$"]); // 허용
    const forbiddenRegs = toRegexes(pol.forbidden_globs || ["^\\.env","^secrets/","^\\.git/"]); // 금지
    const files = getStagedPaths();                                                        // 후보 파일

    const offenders = [];                                                                  // 위반 목록
    for (const f of files) {                                                               // 순회
      if (matchesAny(f, forbiddenRegs)) { offenders.push({ path: f, reason: "forbidden" }); continue; } // 금지 경로
      if (!matchesAny(f, allowedRegs))  { offenders.push({ path: f, reason: "outside_allowed" }); }     // 허용 외
    }

    if (offenders.length) {                                                                // 위반 존재
      appendStage("guard:path-offenders", false, { offenders, scope: "staged-only" });     // 로그
      throw new Error("Changes include paths outside policy. See stage-log offenders.");   // 중단
    }
    appendStage("guard:path-ok", true, { filesCount: files.length, files });               // OK 로그
  }

  const { tokens, hooks: rawHooks } = await loadPlugins(pluginsPaths, repoRoot);           // 플러그인 로드
  const hooks = {                                                                          // 훅 세트
    beforeLLM: [], afterLLM: [], beforeAgent: [], afterAgent: [], beforePR: [], afterPR: [],
    ...(rawHooks || {}),
  };

  const after = rawBody.replace(/^\/auto\s*/i, "");                                        // /auto 제거
  const m = after.match(/^((?:[\w:-]+)\b\s*)+/i) || [""];                                  // 토큰 시퀀스
  const seq = (m[0] || "").trim().split(/\s+/).filter(Boolean);                           // 토큰 배열
  const rest = after.slice((m[0]||"").length).trim();                                      // 사용자 요구

  const ctx = {                                                                            // 실행 컨텍스트
    repoRoot, cfg, tools, policy, labels, pipeline,                                       // 설정/환경
    tokens: seq, tokenFlags: {},                                                          // 토큰·플래그
    userDemand: rest,                                                                     // 사용자 요구
    llm: null, model: null, agent: null, agentModel: null,                                // LLM/Agent
    agentPrompt: "",                                                                      // 에이전트 프롬프트
    planOnly: false,                                                                      // 플랜 전용
    preferFast: false,                                                                    // (구) 빠른 모드
    preferFastAgent: null,                                                                // ★ Agent 전용 빠른 모드(null=미지정)
    longMode: false, budgetMinutes: null, budgetSteps: null,                              // 루프 설정
    loopSummary: { startedAt: nowIso(), steps: [] },                                      // 루프 요약
    usageTotals: { openai: { input:0, output:0 }, gemini: { input:0, output:0 } },        // 사용량
    diagnostics: { last: null },                                                          // 진단
    prNumber: null, branch: null                                                          // Git 메타
  };
  writeRunMeta({ tokens: ctx.tokens });                                                   // 메타 기록

  for (const t of seq) {                                                                  // 토큰 핸들러
    const h = tokens.get(t.toLowerCase());                                                // 핸들러 조회
    if (h) await h(ctx);                                                                  // 실행
  }

  const highCost = labels.includes(labelsCfg.highCost || "automation:high-cost");         // 고비용 라벨
  const max = policy.hard_stop_chars_without_high_cost_label ?? 20000;                    // 입력 최대
  const planThreshold = policy.plan_only_threshold_chars ?? 8000;                         // 플랜 임계
  if (!(ctx.tokenFlags?.force && highCost)) {                                             // 강제/고비용 예외
    if (ctx.userDemand.length > max && !highCost) {                                       // 초과 시
      appendStage("guard:input-too-long", false, { len: ctx.userDemand.length });         // 로그
      throw new Error("Input too long without high-cost label.");                         // 중단
    }
  }
  ctx.planOnly = ctx.planOnly || (ctx.userDemand.length > planThreshold && !highCost);    // 플랜 전용 판단
  appendStage("route:pre", true, { planOnly: ctx.planOnly });                             // 라우팅 전 로그

  // preferFastAgent가 명시되지 않았다면 preferFast 값을 기본으로 사용                          // 분리 기본값
  const preferFastLLM = ctx.preferFast === true;                                          // LLM 빠른 모드
  const preferFastAgent = (ctx.preferFastAgent == null) ? ctx.preferFast : !!ctx.preferFastAgent; // Agent 빠른 모드

  const route = pickLLMAndAgent({                                                         // 라우터 호출
    userDemand: ctx.userDemand,                                                           // 사용자 요구
    planOnly: ctx.planOnly,                                                               // 플랜 전용
    tools,                                                                                // 도구 설정
    preferFast: ctx.preferFast,                                                           // 레거시 fast
    preferFastLLM,                                                                        // LLM fast
    preferFastAgent                                                                       // Agent fast
  });
  ctx.llm = route.llm;                                                                    // LLM 공급자
  ctx.model = route.model;                                                                // LLM 모델
  ctx.agent = route.agent;                                                                // 에이전트 종류
  ctx.agentModel = route.agentModel || null;                                              // ★ Agent 모델
  appendStage("route:selected", true, { llm: ctx.llm, model: ctx.model, agent: ctx.agent, agentModel: ctx.agentModel }); // 라우팅 로그
  writeRunMeta({ llm: ctx.llm, model: ctx.model, agent: ctx.agent, agentModel: ctx.agentModel, planOnly: ctx.planOnly }); // 메타 기록
  for (const h of (hooks.beforeLLM || [])) await h(ctx);                                   // LLM 전 훅
  appendStage("hooks:beforeLLM", true, null);                                              // 훅 로그

  const systemGuard = [                                                                    // 가드레일
    "[에이전트 가드레일]",                                                                // 제목
    `- 허용 경로: ${(policy.allowed_globs||["src/**","app/**","docs/**","apps/**","services/**","README.md"]).join(", ")}`, // 허용
    `- 금지 경로: ${(policy.forbidden_globs||[".env*","secrets/**",".git/**"]).join(", ")}`, // 금지
    `- 서비스 루트(신규 생성 루트): ${path.relative(repoRoot, SERVICE_ROOT)}/`,           // 서비스 루트
    "- 'app/', 'src/', 'docs/', 'tests/'는 서비스 루트 하위에 생성",                       // 규칙
    "- 'packages/**'는 편집/생성 금지",                                                    // 보호
    "- .env* / 비밀키 / .git 금지",                                                        // 보안
    "- 작은 커밋 단위 권장",                                                               // 커밋
    "- 쉘/Bash 명령 실행 금지(파일 편집/패치만)",                                          // 실행 금지
    "- 없는 디렉터리는 패치 내에서 생성 후 파일 추가"                                       // 생성 규칙
  ].join("\n");                                                                            // 결합

  const content = [                                                                        // LLM 입력
    systemGuard, "\n[사용자 요구]", ctx.userDemand, "\n[원하는 산출물]",                   // 섹션
    "- 변경 개요(목록)", "- 파일별 수정 계획", "- 안전 체크리스트",                         // 산출물
    ctx.planOnly ? "- (플랜 전용: 실행명령 생략)" : "- 최종 실행할 수정 단계"               // 모드별
  ].join("\n");                                                                            // 결합

  async function callOpenAIOnce({ userText }) {                                            // OpenAI 단발
    const fallbackModel = (ctx.tools?.openai?.default) || "gpt-4o-mini";                   // 폴백
    const { text, usage } = await runOpenAI({                                              // 호출
      client: makeOpenAI(process.env.OPENAI_API_KEY),                                      // 클라이언트
      model: fallbackModel,                                                                // 모델
      system: systemGuard,                                                                 // 시스템
      user: userText,                                                                      // 사용자
      reasoning: { effort: ctx.planOnly ? "medium" : "high" }                              // 리즈닝
    });
    if (usage) {                                                                           // 사용량
      ctx.usageTotals.openai.input += (usage.input_tokens||0);                             // 입력
      ctx.usageTotals.openai.output += (usage.output_tokens||0);                           // 출력
    }
    return text || "";                                                                     // 반환
  }

  async function genPrompt(){                                                              // 프롬프트 생성
    try {
      if (ctx.llm === "openai") {                                                          // OpenAI 경로
        const { text, usage } = await runOpenAI({                                          // 호출
          client: makeOpenAI(process.env.OPENAI_API_KEY),                                  // 클라이언트
          model: ctx.model, system: systemGuard, user: content,                            // 모델/본문
          reasoning: { effort: ctx.planOnly ? "medium" : "high" }                          // 리즈닝
        });
        if (usage) {                                                                       // 사용량
          ctx.usageTotals.openai.input += (usage.input_tokens||0);                         // 입력
          ctx.usageTotals.openai.output += (usage.output_tokens||0);                       // 출력
        }
        appendStage("llm:openai", true, { model: ctx.model });                              // 로그
        return text || "";                                                                  // 반환
      } else {                                                                              // Gemini 경로
        const { text } = await runGemini({                                                  // 호출
          client: makeGemini(process.env.GEMINI_API_KEY),                                   // 클라이언트
          model: ctx.model, user: content                                                   // 모델/본문
        });
        if (!text || !String(text).trim()) {                                               // 빈 응답
          appendStage("llm:gemini-empty", false, null);                                     // 로그
          const t = await callOpenAIOnce({ userText: content });                            // 폴백
          appendStage("llm:fallback-openai", !!t, { used: "openai:single" });               // 로그
          return t || "";                                                                   // 반환
        }
        appendStage("llm:gemini", true, { model: ctx.model });                              // 로그
        return text;                                                                        // 반환
      }
    } catch (e) {                                                                           // 예외
      appendStage("llm:error", false, { message: String(e?.message || e) });               // 로그
      const t = await callOpenAIOnce({ userText: content });                                // 폴백
      appendStage("llm:fallback-openai", !!t, { used: "openai:on-error" });                 // 로그
      return t || "";                                                                       // 반환
    }
  }

  function synthesizePrompt() {                                                             // 합성 프롬프트
    return [
      "You are a senior full-stack engineer acting as an autonomous code agent.",           // 역할
      "Follow these guardrails strictly:",                                                  // 규칙
      systemGuard, "",                                                                      // 가드레일
      "[Task]", ctx.userDemand || "No explicit task text was provided. Propose a minimal safe change within allowed paths.", "", // 작업
      "[Deliverables]", "- A short plan", "- File-by-file changes", "- Safety checklist", "- (If allowed) exact commands or edits" // 산출물
    ].join("\n");                                                                           // 결합
  }

  function normalizeAgentPrompt(text) {                                                     // 프롬프트 정규화
    const trimmed = (text || "").trim();                                                    // 트림
    return trimmed || synthesizePrompt();                                                   // 폴백
  }

  ctx.agentPrompt = normalizeAgentPrompt(await genPrompt());                                 // 프롬프트 준비
  appendStage("llm:prompt-ready", true, { length: ctx.agentPrompt.length });                 // 로그
  for (const h of (hooks.afterLLM || [])) await h(ctx);                                      // 훅
  appendStage("hooks:afterLLM", true, null);                                                 // 로그

  if (ctx.tokenFlags?.dryRun) { writeRunMeta({ dryRun: true }); return { dryRun: true, ctx }; } // 드라이런
  if (ctx.agent === "none" || ctx.planOnly) { writeRunMeta({ planOnly: ctx.planOnly }); return { planOnly: true, ctx }; } // 스킵

  // Part 2/2: 에이전트 실행·체크포인트·PR 생성                                             // 파트 전환

  function checkpointCommit(msg){                                                           // 체크포인트 커밋
    try {
      execSync(`git add -A`, { stdio: "inherit" });                                         // 전체 스테이징
      execSync(`git restore --staged .github/auto || true`, { stdio: "inherit" });          // 산출물 제외
    } catch {}
    try {
      execSync(`git commit -m ${JSON.stringify(msg)}`, { stdio: "inherit" });               // 커밋
    } catch {
      console.log("No changes to commit for checkpoint.");                                  // 변경 없음
    }
  }

  execSync(`git config user.name "github-actions[bot]"`, { stdio: "inherit" });             // Git 이름
  execSync(`git config user.email "github-actions[bot]@users.noreply.github.com"`, { stdio: "inherit" }); // Git 메일
  const branch = `auto/${RUN_ID}`;                                                           // 브랜치명
  ctx.branch = branch;                                                                       // 컨텍스트 반영
  execSync(`git checkout -b ${branch}`, { stdio: "inherit" });                               // 체크아웃
  appendStage("git:branch", true, { branch });                                               // 로그
  writeRunMeta({ branch });                                                                  // 메타

  const cancelPath = path.join(outDir, "CANCEL");                                            // 취소 파일
  const start = Date.now();                                                                  // 시작 시각

  async function runAgentWithFallback(promptText, toolsArg, policyArg) {                     // 에이전트 실행
    const primary = (ctx.agent || "").toLowerCase();                                         // 주 에이전트
    const fallback = primary === "claude" ? "cursor" : "claude";                             // 폴백
    try {
      const safePrompt = normalizeAgentPrompt(promptText);                                   // 안전 프롬프트
      if (primary === "claude") await runWithClaude(safePrompt, toolsArg, policyArg, { model: ctx.agentModel }); // ★ 모델 전달
      else await runWithCursor(safePrompt, toolsArg, policyArg);                             // Cursor 실행
      appendStage("agent:primary", true, { used: primary, agentModel: ctx.agentModel || null }); // 로그
      return { ok: true, used: primary };                                                    // 결과
    } catch (e1) {
      appendStage("agent:primary", false, { used: primary, error: String(e1?.message||e1) }); // 실패 로그
      try {
        const safePrompt2 = normalizeAgentPrompt(promptText);                                 // 재시도 프롬프트
        if (fallback === "claude") await runWithClaude(safePrompt2, toolsArg, policyArg, { model: ctx.agentModel }); // 폴백 Claude
        else await runWithCursor(safePrompt2, toolsArg, policyArg);                           // 폴백 Cursor
        appendStage("agent:fallback", true, { chain: `${primary}->${fallback}` });            // 성공 로그
        return { ok: true, used: `${primary}->${fallback}` };                                 // 결과
      } catch (e2) {
        appendStage("agent:fallback", false, { chain: `${primary}->${fallback}`, error: String(e2?.message||e2) }); // 실패 로그
        return { ok: false, used: `${primary}->${fallback}` };                                // 결과
      }
    }
  }

  async function runOneStep(step) {                                                          // 단일 스텝
    for (const h of (hooks.beforeAgent || [])) await h(ctx);                                 // 훅
    appendStage("hooks:beforeAgent", true, { step });                                        // 로그

    const originalCwd = process.cwd();                                                       // 원 CWD
    try {
      process.chdir(SERVICE_ROOT);                                                           // 서비스 루트 이동
      appendStage("cwd:enter-service-root", true, { cwd: path.relative(repoRoot, SERVICE_ROOT) }); // 로그
      const result = await runAgentWithFallback(ctx.agentPrompt, tools, policy);             // 에이전트 실행
      ctx.agentUsed = result.used || ctx.agent;                                              // 실제 사용
      appendStage("hooks:afterAgent", true, { step, ok: result.ok });                        // 훅 로그

      process.chdir(repoRoot);                                                               // 루트 복귀

      stageForCommit();                                                                      // 스테이징
      validateStagedPathsOrThrow(policy);                                                    // 정책 검증

      checkpointCommit(`auto: checkpoint step ${step}`);                                     // 커밋
      try { execSync(`git push origin ${branch}`, { stdio: "inherit" }); } catch {}          // 푸시
      appendStage("git:push", true, { step });                                               // 로그
      ctx.loopSummary.steps.push({ step, at: nowIso(), agentUsed: result.used, ok: result.ok }); // 요약
      writeRunMeta({ loopSummary: ctx.loopSummary });                                        // 메타
      const diagFile = path.join(outDir, "diagnostics-last.json");                           // 진단 파일
      writeFileSync(diagFile, JSON.stringify({ when: nowIso(), logs: [{ stage: "agent", ok: true, out: result.used }] }, null, 2), "utf8"); // 저장
    } finally {
      try { process.chdir(originalCwd); appendStage("cwd:leave-service-root", true, { restored: true }); } catch {} // 복구
    }
  }

  if (ctx.longMode) {                                                                        // 장기 모드
    const maxMs = (ctx.budgetMinutes||60) * 60 * 1000;                                       // 시간 한도
    const maxSteps = ctx.budgetSteps || 3;                                                   // 스텝 한도
    for (let step=1; step<=maxSteps; step++) {                                               // 반복
      if (existsSync(cancelPath)) { appendStage("long:cancel", true, null); break; }         // 취소
      if ((Date.now()-start) > maxMs) { appendStage("long:timeout", false, { maxMs }); break; } // 타임아웃
      await runOneStep(step);                                                                 // 실행
    }
  } else {
    await runOneStep(1);                                                                      // 단발 실행
  }

  for (const h of (hooks.beforePR || [])) await h(ctx);                                       // PR 전 훅
  appendStage("hooks:beforePR", true, null);                                                  // 로그

  const agentUsed = (ctx.agentUsed && String(ctx.agentUsed).trim()) || ctx.agent;             // 실제 에이전트
  const tokenList = (ctx.tokens||[]).join(", ") || "(none)";                                  // 토큰
  const labelList = labels.join(", ") || "(none)";                                            // 라벨
  const truncatedUserDemand = (ctx.userDemand || "").slice(0, 2000);                          // 미리보기
  const costLine = `OpenAI usage: in=${ctx.usageTotals.openai.input} out=${ctx.usageTotals.openai.output}`; // 사용량
  const sourceIssueLine = sourceIssueNumber ? `Source-Issue: #${sourceIssueNumber}` : "Source-Issue: n/a"; // 소스 이슈

  const infoMd = [                                                                            // PR 본문
    `## Auto-run Info`,                                                                       // 제목
    ``,                                                                                       // 공백
    `- LLM (plan): **${ctx.llm}** (${ctx.model})`,                                            // LLM
    `- Agent (requested): **${ctx.agent}**`,                                                  // 요청
    `- Agent (actual): **${agentUsed}**`,                                                     // 실제
    `- Agent Model: ${ctx.agentModel || "(n/a)"}`,                                            // ★ Agent 모델
    `- Branch: ${ctx.branch}`,                                                                // 브랜치
    `- Service Root: ${path.relative(repoRoot, SERVICE_ROOT)}/`,                              // 서비스 루트
    `- Labels: ${labelList}`,                                                                 // 라벨
    `- Tokens: ${tokenList}`,                                                                 // 토큰
    `- ${costLine}`,                                                                          // 사용량
    `- ${sourceIssueLine}`,                                                                   // 소스 이슈
    ``,                                                                                       // 공백
    `## Prompt (truncated)`,                                                                  // 프롬프트
    "", "```", truncatedUserDemand, "```", ""                                                 // 본문
  ].join("\n");                                                                               // 결합

  const promptMd = [                                                                          // 컨텍스트 코멘트
    `# Original Prompt`, "", "```", ctx.userDemand, "```", "",                                // 원 프롬프트
    "## Last Agent Prompt", "", "```", (ctx.agentPrompt || "").trim(), "```"                  // 최종 프롬프트
  ].join("\n");                                                                               // 결합

  const prBodyPath = path.join(outDir, `pr-body-${RUN_ID}.md`);                               // PR 본문 파일
  const promptBodyPath = path.join(outDir, `prompt-${RUN_ID}.md`);                            // 프롬프트 파일
  writeFileSync(prBodyPath, infoMd, "utf8");                                                  // 저장
  writeFileSync(promptBodyPath, promptMd, "utf8");                                            // 저장

  const title = `auto: ${ctx.branch} [${ctx.llm}/${agentUsed}] (tokens: ${tokenList})`;       // PR 제목
  execSync(                                                                                   // gh pr create
    `gh pr create --title ${JSON.stringify(title)} --body-file ${JSON.stringify(prBodyPath)} --base main --head ${ctx.branch}`,
    { stdio: "inherit" }                                                                       // 출력 계승
  );
  appendStage("pr:create", true, { title });                                                   // 로그

  const prNumber = execSync(                                                                   // PR 번호 조회
    `gh pr list -s all --head ${ctx.branch} --json number --jq '.[0].number // empty'`
  ).toString().trim();                                                                         // 문자열화
  ctx.prNumber = prNumber || null;                                                             // 컨텍스트 반영
  writeRunMeta({ prNumber: ctx.prNumber });                                                    // 메타 저장
  appendStage("pr:number", !!ctx.prNumber, { prNumber: ctx.prNumber });                        // 로그

  if (prNumber) {                                                                              // 번호가 있으면
    execSync(                                                                                  // PR 코멘트
      `gh pr comment ${prNumber} --body-file ${JSON.stringify(promptBodyPath)}`,
      { stdio: "inherit" }
    );
    appendStage("pr:comment-prompt", true, { prNumber });                                      // 로그

    const autoMerge = labelsCfg.autoMerge || "automation:auto-merge";                           // 자동 병합 라벨
    const cont = labelsCfg.continue || "automation:continue";                                   // 컨티뉴 라벨
    try {
      execSync(`gh pr edit ${prNumber} --add-label ${JSON.stringify(autoMerge)} --add-label ${JSON.stringify(cont)}`, { stdio: "inherit" }); // 라벨
      appendStage("pr:labels", true, { added: [autoMerge, cont] });                             // 로그
    } catch (e) {
      appendStage("pr:labels", false, { error: String(e?.message || e) });                      // 실패 로그
    }
  }

  for (const h of (hooks.afterPR || [])) await h(ctx);                                          // PR 후 훅
  appendStage("hooks:afterPR", true, null);                                                     // 로그

  writeRunMeta({ finishedAt: nowIso() });                                                       // 종료 시각
  appendStage("done", true, { longMode: ctx.longMode });                                        // 완료 로그

  return { success: true, branch: ctx.branch, long: ctx.longMode, usage: ctx.usageTotals, prNumber: ctx.prNumber }; // 최종 결과
}
