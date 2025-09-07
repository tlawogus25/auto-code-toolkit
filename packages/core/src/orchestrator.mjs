// packages/core/src/orchestrator.mjs                                                                // 파일: 오케스트레이터 본체
// Part 1/2: 개요·의존성·컨텍스트·LLM 라우팅·프롬프트 생성                                           // 파트 개요

import { readFileSync, writeFileSync, existsSync } from "node:fs";                                   // 파일 입출력 유틸
import { execSync } from "node:child_process";                                                       // 외부 명령 실행(gh 등)
import path from "node:path";                                                                        // 경로 유틸
import fs from "node:fs";                                                                            // 파일시스템 유틸
import process from "node:process";                                                                  // 환경변수 접근
import { loadPlugins } from "./tokens/registry.mjs";                                                 // /auto 토큰 로더
import { pickLLMAndAgent } from "./router.mjs";                                                      // LLM/에이전트 라우팅
import { makeOpenAI, runOpenAI } from "./llm/openai.mjs";                                            // OpenAI 어댑터
import { makeGemini, runGemini } from "./llm/gemini.mjs";                                            // Gemini 어댑터
import { runWithClaude } from "./agents/claude.mjs";                                                 // Claude 실행기
import { runWithCursor } from "./agents/cursor.mjs";                                                 // Cursor 실행기

function nowIso(){ return new Date().toISOString(); }                                                // ISO 타임스탬프 유틸

export async function runOrchestrator({ repoRoot, configPath, eventPath }) {                         // 엔트리포인트
  const cfg = JSON.parse(readFileSync(path.join(repoRoot, configPath), "utf8"));                     // 설정 로드
  const tools = cfg.tools || {};                                                                     // 도구 설정
  const policy = cfg.policy || {};                                                                   // 정책(경로/제한)
  const labelsCfg = cfg.labels || {};                                                                // 라벨 키 설정
  const pluginsPaths = cfg.plugins || [];                                                            // 플러그인 경로
  const pipeline = cfg.pipeline || { commands: {} };                                                 // 파이프라인 훅

  let evt = {};                                                                                      // 이벤트 객체 초기값
  try { evt = JSON.parse(readFileSync(eventPath, "utf8")); } catch {}                                // 이벤트 로드(실패 허용)

  const eventName = process.env.GITHUB_EVENT_NAME || "";                                             // 이벤트명
  const isIssue = !!evt.issue && !evt.comment;                                                       // 이슈 이벤트 여부
  const isDispatch = eventName === "workflow_dispatch";                                              // 디스패치 여부

  const dispatchBody = (evt?.inputs?.body ?? process.env.AUTO_INPUT_BODY ?? "");                     // 디스패치 본문
  const issueBody    = (evt?.issue?.body ?? "");                                                     // 이슈 본문
  const commentBody  = (evt?.comment?.body ?? "");                                                   // 코멘트 본문
  const rawBody = (isDispatch ? dispatchBody : (isIssue ? issueBody : commentBody)).trim();          // 최종 본문

  const labels = (evt.issue?.labels || []).map(l => l?.name || "");                                  // 라벨 목록
  const sourceIssueNumber = evt?.issue?.number || null;                                              // 원 이슈 번호

  if (!rawBody || !rawBody.startsWith("/auto")) return { skipped: true };                            // /auto 가드

  if (!isDispatch) {                                                                                 // 라벨 가드(이슈/코멘트만)
    if (!labels.includes(labelsCfg.run || "automation:run")) return { skipped: true };               // 라벨 없으면 스킵
  }

  const outDir = process.env.AUTO_OUT_DIR                                                             // 산출물 경로
    ? path.resolve(process.env.AUTO_OUT_DIR)                                                          // ENV 우선
    : path.join(repoRoot, ".github", "auto");                                                         // 기본 경로
  fs.mkdirSync(outDir, { recursive: true });                                                          // 경로 보장
  const stageLogPath = path.join(outDir, "stage-log.json");                                           // stage-log 경로
  const runMetaPath  = path.join(outDir, "run-meta.json");                                            // run-meta 경로

  const RUN_ID = Date.now();                                                                          // 런 ID(타임스탬프)
  const SERVICE_ROOT = process.env.AUTO_SERVICE_ROOT                                                  // 서비스 루트(고정)
    ? path.resolve(repoRoot, process.env.AUTO_SERVICE_ROOT)                                           // ENV 우선
    : path.join(repoRoot, "apps", `auto-${RUN_ID}`);                                                  // 기본 apps/ 경로
  const REL_SERVICE_ROOT = path.relative(repoRoot, SERVICE_ROOT) || ".";                              // 상대 경로
  fs.mkdirSync(path.join(SERVICE_ROOT, "app"),   { recursive: true });                                // app/ 생성
  fs.mkdirSync(path.join(SERVICE_ROOT, "src"),   { recursive: true });                                // src/ 생성
  fs.mkdirSync(path.join(SERVICE_ROOT, "tests"), { recursive: true });                                // tests/ 생성
  fs.mkdirSync(path.join(SERVICE_ROOT, "docs"),  { recursive: true });                                // docs/ 생성
  const readmePath = path.join(SERVICE_ROOT, "README.md");                                            // README 경로
  if (!existsSync(readmePath)) {                                                                      // 없으면
    fs.writeFileSync(                                                                                 // 작성
      readmePath,                                                                                     // 대상
      `# Auto Service Root

- This directory is the sandbox for generated code.
- Create app/src/docs/tests under here.

`,                                                                                                    // 내용
      "utf8"                                                                                          // 인코딩
    );                                                                                                // 쓰기 끝
  }

  function appendStage(stage, ok, details){                                                           // stage-log 유틸
    let arr = [];                                                                                     // 기존 배열
    try { arr = JSON.parse(fs.readFileSync(stageLogPath, "utf8")); } catch {}                         // 읽기 실패 허용
    arr.push({ stage, ok: !!ok, details: details ?? null, ts: nowIso() });                            // 항목 추가
    fs.writeFileSync(stageLogPath, JSON.stringify(arr, null, 2), "utf8");                             // 저장
  }                                                                                                   // 함수 끝
  function writeRunMeta(extra){                                                                       // run-meta 유틸
    const base = {                                                                                    // 기본 필드
      startedAt: nowIso(),                                                                            // 시작 시각
      event: evt.action || eventName || "n/a",                                                        // 이벤트명
      source: isIssue ? "issue" : (isDispatch ? "dispatch" : "comment"),                              // 소스 유형
      sourceIssueNumber,                                                                              // 소스 이슈 번호
      tokens: [],                                                                                     // 토큰 목록
      planOnly: false,                                                                                // 플랜 전용 플래그
      longMode: false,                                                                                // 장기 모드 플래그
      llm: null, model: null, agent: null, agentModel: null,                                          // LLM/모델/에이전트/에이전트모델
      branch: null, prNumber: null,                                                                   // Git 메타
      serviceRoot: REL_SERVICE_ROOT                                                                   // 서비스 루트
    };                                                                                                // base 끝
    try {                                                                                             // 기존 병합
      const prev = JSON.parse(fs.readFileSync(runMetaPath, "utf8"));                                  // 이전 값
      fs.writeFileSync(runMetaPath, JSON.stringify({ ...prev, ...base, ...(extra||{}) }, null, 2), "utf8"); // 병합 저장
    } catch {                                                                                          // 실패 시
      fs.writeFileSync(runMetaPath, JSON.stringify({ ...base, ...(extra||{}) }, null, 2), "utf8");     // 신규 저장
    }                                                                                                  // try-catch 끝
  }                                                                                                    // 함수 끝
  appendStage("scaffold:service-root", true, { serviceRoot: REL_SERVICE_ROOT });                       // 스캐폴딩 로그
  appendStage("bootstrap", true, {                                                                     // 부트스트랩 로그
    hasAuto: true,                                                                                     // /auto 존재
    hasRunLabel: isDispatch ? "n/a(dispatch)" : labels.includes(labelsCfg.run || "automation:run")     // 라벨 상태
  });                                                                                                  // 로그 끝
  writeRunMeta();                                                                                      // 메타 초기 저장

  function toRegexes(globs = []) {                                                                     // 글롭→정규식
    return globs.map(s => new RegExp(s.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*")));              // 치환 규칙
  }                                                                                                    // 함수 끝
  function matchesAny(p, regs) { return regs.some(r => r.test(p)); }                                   // 경로 매칭 유틸

  function stageForCommit() {                                                                          // 스테이징 함수
    try {                                                                                              // git add
      execSync(`git add -A`, { stdio: "inherit" });                                                    // 모든 변경 스테이징
      execSync(`git restore --staged .github/auto || true`, { stdio: "inherit" });                     // 런타임 산출물 제외
    } catch (e) {                                                                                      // 예외시
      console.log("stageForCommit: ignored error", e?.message || e);                                   // 무시 로그
    }                                                                                                   // try-catch 끝
  }                                                                                                     // 함수 끝

  function getStagedPaths() {                                                                          // 스테이징 목록
    const out = execSync(`git diff --name-only --cached`, { encoding: "utf8" }).trim();               // 캐시드 변경
    return out ? out.split("\n") : [];                                                                 // 배열 반환
  }                                                                                                    // 함수 끝

  function validateStagedPathsOrThrow(pol) {                                                           // 정책 검증
    const allowedRegs   = toRegexes(pol.allowed_globs   || ["^src/","^app/","^docs/","^apps/","^services/","^README\\.md$"]); // 허용 정규식
    const forbiddenRegs = toRegexes(pol.forbidden_globs || ["^\\.env","^secrets/","^\\.git/"]);       // 금지 정규식
    const files = getStagedPaths();                                                                    // 스테이징 파일

    const offenders = [];                                                                              // 위반 목록
    for (const f of files) {                                                                           // 파일 순회
      if (matchesAny(f, forbiddenRegs)) { offenders.push({ path: f, reason: "forbidden" }); continue; } // 금지 경로
      if (!matchesAny(f, allowedRegs))  { offenders.push({ path: f, reason: "outside_allowed" }); }    // 비허용 경로
    }                                                                                                   // 반복 끝

    if (offenders.length) {                                                                            // 위반이 있으면
      appendStage("guard:path-offenders", false, { offenders, scope: "staged-only" });                 // 로그 남김
      throw new Error("Changes include paths outside policy. See stage-log offenders.");               // 예외 발생
    }                                                                                                   // 조건 끝
    appendStage("guard:path-ok", true, { filesCount: files.length, files });                           // OK 로그
  }                                                                                                    // 함수 끝

  const { tokens, hooks: rawHooks } = await loadPlugins(pluginsPaths, repoRoot);                       // 플러그인 로드
  const hooks = {                                                                                      // 훅 기본 셋
    beforeLLM: [], afterLLM: [], beforeAgent: [], afterAgent: [], beforePR: [], afterPR: [],           // 훅 배열
    ...(rawHooks || {}),                                                                               // 외부 훅 병합
  };                                                                                                   // 객체 끝

  const after = rawBody.replace(/^\/auto\s*/i, "");                                                    // /auto 제거
  const m = after.match(/^((?:[\w:-]+)\b\s*)+/i) || [""];                                              // 토큰 시퀀스 추출
  const seq = (m[0] || "").trim().split(/\s+/).filter(Boolean);                                       // 토큰 배열
  const rest = after.slice((m[0]||"").length).trim();                                                  // 사용자 요구 텍스트

  const ctx = {                                                                                        // 실행 컨텍스트
    repoRoot, cfg, tools, policy, labels, pipeline,                                                   // 환경/설정
    tokens: seq, tokenFlags: {},                                                                      // 토큰/플래그
    userDemand: rest,                                                                                  // 사용자 요구
    llm: null, model: null, agent: null, agentModel: null,                                             // LLM/모델/에이전트/에이전트모델
    agentPrompt: "",                                                                                   // 에이전트 프롬프트
    planOnly: false, preferFast: false,                                                                 // 동작 플래그
    longMode: false, budgetMinutes: null, budgetSteps: null,                                            // 루프 설정
    loopSummary: { startedAt: nowIso(), steps: [] },                                                    // 루프 요약
    usageTotals: { openai: { input:0, output:0 }, gemini: { input:0, output:0 } },                      // 사용량 집계
    diagnostics: { last: null },                                                                        // 진단 정보
    prNumber: null, branch: null                                                                        // Git 메타
  };                                                                                                    // 컨텍스트 끝
  writeRunMeta({ tokens: ctx.tokens });                                                                 // 메타에 토큰 기록

  for (const t of seq) {                                                                                // 토큰 핸들러
    const h = tokens.get(t.toLowerCase());                                                              // 핸들러 조회
    if (h) await h(ctx);                                                                                // 실행(있을 때만)
  }                                                                                                     // 반복 끝

  const highCost = labels.includes(labelsCfg.highCost || "automation:high-cost");                       // 고비용 라벨
  const max = policy.hard_stop_chars_without_high_cost_label ?? 20000;                                  // 입력 최대치
  const planThreshold = policy.plan_only_threshold_chars ?? 8000;                                       // 플랜 전용 임계
  if (!(ctx.tokenFlags?.force && highCost)) {                                                           // 강제/고비용 예외
    if (ctx.userDemand.length > max && !highCost) {                                                     // 초과면
      appendStage("guard:input-too-long", false, { len: ctx.userDemand.length });                       // 로그
      throw new Error("Input too long without high-cost label.");                                       // 종료
    }                                                                                                   // 조건 끝
  }                                                                                                     // if 끝
  ctx.planOnly = ctx.planOnly || (ctx.userDemand.length > planThreshold && !highCost);                  // 플랜 모드
  appendStage("route:pre", true, { planOnly: ctx.planOnly });                                           // 라우팅 전 로그

  const route = pickLLMAndAgent({                                                                       // 라우터 호출
    userDemand: ctx.userDemand,                                                                         // 사용자 요구
    planOnly: ctx.planOnly,                                                                             // 플랜 전용
    tools,                                                                                              // 도구 설정
    preferFast: ctx.preferFast                                                                          // 빠른 응답
  });                                                                                                   // 호출 끝
  ctx.llm = route.llm; ctx.model = route.model; ctx.agent = route.agent; ctx.agentModel = route.agentModel || null; // ★ agentModel 저장
  appendStage("route:selected", true, { llm: ctx.llm, model: ctx.model, agent: ctx.agent, agentModel: ctx.agentModel }); // ★ 모델 로그
  writeRunMeta({ llm: ctx.llm, model: ctx.model, agent: ctx.agent, agentModel: ctx.agentModel, planOnly: ctx.planOnly }); // ★ 메타 기록
  for (const h of (hooks.beforeLLM || [])) await h(ctx);                                               // LLM 전 훅
  appendStage("hooks:beforeLLM", true, null);                                                          // 훅 로그

  const systemGuard = [                                                                                // 가드레일 텍스트
    "[에이전트 가드레일]",                                                                            // 섹션 제목
    `- 허용 경로: ${(policy.allowed_globs||["src/**","app/**","docs/**","apps/**","services/**","README.md"]).join(", ")}`, // 허용 경로
    `- 금지 경로: ${(policy.forbidden_globs||[".env*","secrets/**",".git/**"]).join(", ")}`,           // 금지 경로
    `- 서비스 루트(신규 생성 루트): ${path.relative(repoRoot, SERVICE_ROOT)}/`,                        // 서비스 루트
    "- 'app/', 'src/', 'docs/', 'tests/' 경로는 반드시 서비스 루트 하위에 생성",                        // 루트 제약
    "- 'packages/**' 경로는 편집/생성 금지(툴킷 오염 방지)",                                           // 보호 규칙
    "- .env* / 비밀키 / .git 은 읽기·쓰기도 금지",                                                       // 보안 규칙
    "- 변경은 설명 가능한 작은 커밋 단위 권장",                                                          // 커밋 규칙
    "- 절대 쉘/Bash 명령을 실행하지 말 것(파일 편집/패치만 수행)",                                      // 실행 금지
    "- 존재하지 않는 디렉터리는 패치 내에서 생성 후 파일을 추가"                                         // 생성 규칙
  ].join("\n");                                                                                        // 문자열 결합

  const content = [                                                                                    // LLM 입력 본문
    systemGuard, "\n[사용자 요구]", ctx.userDemand, "\n[원하는 산출물]",                               // 섹션 구성
    "- 변경 개요(목록)", "- 파일별 수정 계획", "- 안전 체크리스트",                                     // 산출물 리스트
    ctx.planOnly ? "- (플랜 전용: 실행명령 생략)" : "- 최종 실행할 수정 단계"                           // 모드별 지시
  ].join("\n");                                                                                        // 결합

  async function callOpenAIOnce({ userText }) {                                                        // OpenAI 단발 호출
    const fallbackModel = (ctx.tools?.openai?.default) || "gpt-4o-mini";                               // 폴백 모델
    const { text, usage } = await runOpenAI({                                                          // 호출 실행
      client: makeOpenAI(process.env.OPENAI_API_KEY),                                                  // 클라이언트 생성
      model: fallbackModel,                                                                            // 모델 지정
      system: systemGuard,                                                                             // 시스템 프롬프트
      user: userText,                                                                                  // 사용자 텍스트
      reasoning: { effort: ctx.planOnly ? "medium" : "high" }                                          // 리즈닝 강도
    });                                                                                                // 호출 끝
    if (usage) {                                                                                       // 사용량 있으면
      ctx.usageTotals.openai.input += (usage.input_tokens||0);                                         // 입력 토큰 합산
      ctx.usageTotals.openai.output += (usage.output_tokens||0);                                       // 출력 토큰 합산
    }                                                                                                   // 조건 끝
    return text || "";                                                                                 // 텍스트 반환
  }                                                                                                     // 함수 끝

  async function genPrompt(){                                                                          // 본 프롬프트 생성
    try {                                                                                               // 예외 처리
      if (ctx.llm === "openai") {                                                                       // OpenAI 경로
        const { text, usage } = await runOpenAI({                                                       // 호출
          client: makeOpenAI(process.env.OPENAI_API_KEY),                                               // 클라이언트
          model: ctx.model, system: systemGuard, user: content,                                         // 모델/본문
          reasoning: { effort: ctx.planOnly ? "medium" : "high" }                                       // 리즈닝
        });                                                                                              // 호출 끝
        if (usage) {                                                                                    // 사용량 합산
          ctx.usageTotals.openai.input += (usage.input_tokens||0);                                      // 입력 토큰
          ctx.usageTotals.openai.output += (usage.output_tokens||0);                                    // 출력 토큰
        }                                                                                                // 조건 끝
        appendStage("llm:openai", true, { model: ctx.model });                                          // 로그
        return text || "";                                                                              // 프롬프트 문자열
      } else {                                                                                           // Gemini 경로
        const { text } = await runGemini({                                                              // 호출
          client: makeGemini(process.env.GEMINI_API_KEY),                                               // 클라이언트
          model: ctx.model, user: content                                                               // 모델/본문
        });                                                                                              // 호출 끝
        if (!text || !String(text).trim()) {                                                            // 빈 응답이면
          appendStage("llm:gemini-empty", false, null);                                                 // 로그
          const t = await callOpenAIOnce({ userText: content });                                        // OpenAI 폴백
          appendStage("llm:fallback-openai", !!t, { used: "openai:single" });                           // 폴백 로그
          return t || "";                                                                               // 프롬프트 반환
        }                                                                                                // 조건 끝
        appendStage("llm:gemini", true, { model: ctx.model });                                          // 로그
        return text;                                                                                    // 프롬프트 반환
      }                                                                                                  // if-else 끝
    } catch (e) {                                                                                        // 예외
      appendStage("llm:error", false, { message: String(e?.message || e) });                            // 오류 로그
      const t = await callOpenAIOnce({ userText: content });                                            // OpenAI 폴백
      appendStage("llm:fallback-openai", !!t, { used: "openai:on-error" });                             // 폴백 로그
      return t || "";                                                                                   // 프롬프트 반환
    }                                                                                                    // try-catch 끝
  }                                                                                                      // 함수 끝

  function synthesizePrompt() {                                                                         // 프롬프트 합성
    return [
      "You are a senior full-stack engineer acting as an autonomous code agent.",                       // 역할
      "Follow these guardrails strictly:",                                                              // 규칙 안내
      systemGuard, "",                                                                                  // 가드레일 포함
      "[Task]", ctx.userDemand || "No explicit task text was provided. Propose a minimal safe change within allowed paths.", "", // 작업
      "[Deliverables]", "- A short plan", "- File-by-file changes", "- Safety checklist", "- (If allowed) exact commands or edits" // 산출물
    ].join("\n");                                                                                       // 결합
  }                                                                                                      // 함수 끝

  function normalizeAgentPrompt(text) {                                                                  // 에이전트 프롬프트 정규화
    const trimmed = (text || "").trim();                                                                // 트림
    return trimmed || synthesizePrompt();                                                                // 비어있으면 합성본
  }                                                                                                      // 함수 끝

  ctx.agentPrompt = normalizeAgentPrompt(await genPrompt());                                             // 최종 프롬프트
  appendStage("llm:prompt-ready", true, { length: ctx.agentPrompt.length });                             // 준비 로그
  for (const h of (hooks.afterLLM || [])) await h(ctx);                                                  // LLM 후 훅
  appendStage("hooks:afterLLM", true, null);                                                             // 훅 로그

  if (ctx.tokenFlags?.dryRun) { writeRunMeta({ dryRun: true }); return { dryRun: true, ctx }; }          // 드라이런 종료
  if (ctx.agent === "none" || ctx.planOnly) { writeRunMeta({ planOnly: ctx.planOnly }); return { planOnly: true, ctx }; } // 에이전트 스킵

  // Part 2/2: 에이전트 실행·체크포인트·PR 생성·메타/스테이지 기록                               // 파트 전환

  function checkpointCommit(msg){                                                                        // 체크포인트 커밋
    try {
      execSync(`git add -A`, { stdio: "inherit" });                                                      // 전체 스테이징
      execSync(`git restore --staged .github/auto || true`, { stdio: "inherit" });                       // 산출물 제외
    } catch {}
    try {
      execSync(`git commit -m ${JSON.stringify(msg)}`, { stdio: "inherit" });                            // 커밋 실행
    } catch {
      console.log("No changes to commit for checkpoint.");                                               // 변경 없음 로그
    }
  }

  execSync(`git config user.name "github-actions[bot]"`, { stdio: "inherit" });                          // Git 사용자
  execSync(`git config user.email "github-actions[bot]@users.noreply.github.com"`, { stdio: "inherit" }); // Git 이메일
  const branch = `auto/${RUN_ID}`;                                                                        // 브랜치명
  ctx.branch = branch;                                                                                    // ctx 반영
  execSync(`git checkout -b ${branch}`, { stdio: "inherit" });                                            // 새 브랜치
  appendStage("git:branch", true, { branch });                                                            // 브랜치 로그
  writeRunMeta({ branch });                                                                               // 메타 반영

  const cancelPath = path.join(outDir, "CANCEL");                                                         // 취소 파일 경로
  const start = Date.now();                                                                               // 시작 시각

  async function runAgentWithFallback(promptText, toolsArg, policyArg) {                                  // 에이전트 실행(폴백)
    const primary = (ctx.agent || "").toLowerCase();                                                      // 기본 에이전트
    const fallback = primary === "claude" ? "cursor" : "claude";                                          // 폴백 에이전트
    try {
      const safePrompt = normalizeAgentPrompt(promptText);                                                // 안전 프롬프트
      if (primary === "claude") await runWithClaude(safePrompt, toolsArg, policyArg, { model: ctx.agentModel }); // ★ Claude에 모델 전달
      else await runWithCursor(safePrompt, toolsArg, policyArg);                                          // Cursor 실행
      appendStage("agent:primary", true, { used: primary, agentModel: ctx.agentModel || null });          // 실행 로그
      return { ok: true, used: primary };                                                                 // 결과
    } catch (e1) {
      appendStage("agent:primary", false, { used: primary, error: String(e1?.message||e1) });             // 실패 로그
      try {
        const safePrompt2 = normalizeAgentPrompt(promptText);                                             // 재시도 프롬프트
        if (fallback === "claude") await runWithClaude(safePrompt2, toolsArg, policyArg, { model: ctx.agentModel }); // 폴백 Claude
        else await runWithCursor(safePrompt2, toolsArg, policyArg);                                       // 폴백 Cursor
        appendStage("agent:fallback", true, { chain: `${primary}->${fallback}` });                        // 폴백 성공 로그
        return { ok: true, used: `${primary}->${fallback}` };                                             // 결과
      } catch (e2) {
        appendStage("agent:fallback", false, { chain: `${primary}->${fallback}`, error: String(e2?.message||e2) }); // 폴백 실패 로그
        return { ok: false, used: `${primary}->${fallback}` };                                            // 결과
      }
    }
  }

  async function runOneStep(step) {                                                                       // 단일 스텝 실행
    for (const h of (hooks.beforeAgent || [])) await h(ctx);                                              // 에이전트 전 훅
    appendStage("hooks:beforeAgent", true, { step });                                                      // 훅 로그

    const originalCwd = process.cwd();                                                                     // 원 CWD 보관
    try {
      process.chdir(SERVICE_ROOT);                                                                         // 서비스 루트로 이동
      appendStage("cwd:enter-service-root", true, { cwd: path.relative(repoRoot, SERVICE_ROOT) });         // 이동 로그
      const result = await runAgentWithFallback(ctx.agentPrompt, tools, policy);                           // 에이전트 실행
      ctx.agentUsed = result.used || ctx.agent;                                                            // 실제 사용 에이전트 저장
      appendStage("hooks:afterAgent", true, { step, ok: result.ok });                                      // 에이전트 후 훅

      process.chdir(repoRoot);                                                                             // 저장소 루트 복귀

      stageForCommit();                                                                                    // 스테이징
      validateStagedPathsOrThrow(policy);                                                                  // 정책 검증

      checkpointCommit(`auto: checkpoint step ${step}`);                                                   // 체크포인트 커밋
      try { execSync(`git push origin ${branch}`, { stdio: "inherit" }); } catch {}                        // 푸시(실패 허용)
      appendStage("git:push", true, { step });                                                             // 푸시 로그
      ctx.loopSummary.steps.push({ step, at: nowIso(), agentUsed: result.used, ok: result.ok });           // 루프 요약 기록
      writeRunMeta({ loopSummary: ctx.loopSummary });                                                      // 메타 반영
      const diagFile = path.join(outDir, "diagnostics-last.json");                                         // 진단 파일
      writeFileSync(diagFile, JSON.stringify({                                                             // 진단 저장
        when: nowIso(),                                                                                    // 시각
        logs: [{ stage: "agent", ok: true, out: result.used }]                                             // 간단 로그
      }, null, 2), "utf8");                                                                                // 저장
    } finally {
      try { process.chdir(originalCwd); appendStage("cwd:leave-service-root", true, { restored: true }); } catch {} // CWD 복구
    }
  }

  if (ctx.longMode) {                                                                                     // 장기 모드
    const maxMs = (ctx.budgetMinutes||60) * 60 * 1000;                                                    // 시간 한도
    const maxSteps = ctx.budgetSteps || 3;                                                                 // 스텝 한도
    for (let step=1; step<=maxSteps; step++) {                                                             // 반복
      if (existsSync(cancelPath)) { appendStage("long:cancel", true, null); break; }                       // 취소 파일
      if ((Date.now()-start) > maxMs) { appendStage("long:timeout", false, { maxMs }); break; }           // 타임아웃
      await runOneStep(step);                                                                              // 스텝 실행
    }
  } else {                                                                                                 // 단발 모드
    await runOneStep(1);                                                                                   // 1스텝 실행
  }

  for (const h of (hooks.beforePR || [])) await h(ctx);                                                    // PR 전 훅
  appendStage("hooks:beforePR", true, null);                                                               // 훅 로그

  const agentUsed = (ctx.agentUsed && String(ctx.agentUsed).trim()) || ctx.agent;                          // 실제 에이전트
  const tokenList = (ctx.tokens||[]).join(", ") || "(none)";                                               // 토큰 표시
  const labelList = labels.join(", ") || "(none)";                                                         // 라벨 목록
  const truncatedUserDemand = (ctx.userDemand || "").slice(0, 2000);                                       // 본문 미리보기
  const costLine = `OpenAI usage: in=${ctx.usageTotals.openai.input} out=${ctx.usageTotals.openai.output}`;// 사용량 요약
  const sourceIssueLine = sourceIssueNumber ? `Source-Issue: #${sourceIssueNumber}` : "Source-Issue: n/a"; // 소스 이슈

  const infoMd = [                                                                                         // PR 본문(정보)
    `## Auto-run Info`,                                                                                    // 섹션 제목
    ``,                                                                                                    // 공백
    `- LLM (plan): **${ctx.llm}** (${ctx.model})`,                                                         // LLM 정보
    `- Agent (requested): **${ctx.agent}**`,                                                               // 요청 에이전트
    `- Agent (actual): **${agentUsed}**`,                                                                  // 실제 에이전트
    `- Agent Model: ${ctx.agentModel || "(n/a)"}`,                                                         // ★ 에이전트 모델
    `- Branch: ${ctx.branch}`,                                                                             // 브랜치
    `- Service Root: ${path.relative(repoRoot, SERVICE_ROOT)}/`,                                           // 서비스 루트
    `- Labels: ${labelList}`,                                                                              // 라벨
    `- Tokens: ${tokenList}`,                                                                              // 토큰
    `- ${costLine}`,                                                                                       // 사용량
    `- ${sourceIssueLine}`,                                                                                // 소스 이슈
    ``,                                                                                                    // 공백
    `## Prompt (truncated)`,                                                                               // 프롬프트 미리보기
    "", "```", truncatedUserDemand, "```", ""                                                              // 코드블록
  ].join("\n");                                                                                            // 결합

  const promptMd = [                                                                                       // 컨텍스트 코멘트
    `# Original Prompt`, "", "```", ctx.userDemand, "```", "",                                             // 원 프롬프트
    "## Last Agent Prompt", "", "```", (ctx.agentPrompt || "").trim(), "```"                               // 마지막 에이전트 프롬프트
  ].join("\n");                                                                                            // 결합

  const prBodyPath = path.join(outDir, `pr-body-${RUN_ID}.md`);                                            // PR 본문 파일
  const promptBodyPath = path.join(outDir, `prompt-${RUN_ID}.md`);                                         // 프롬프트 파일
  writeFileSync(prBodyPath, infoMd, "utf8");                                                               // 저장
  writeFileSync(promptBodyPath, promptMd, "utf8");                                                         // 저장

  const title = `auto: ${ctx.branch} [${ctx.llm}/${agentUsed}] (tokens: ${tokenList})`;                    // PR 제목
  execSync(                                                                                                // gh pr create
    `gh pr create --title ${JSON.stringify(title)} --body-file ${JSON.stringify(prBodyPath)} --base main --head ${ctx.branch}`,
    { stdio: "inherit" }                                                                                   // 출력 계승
  );                                                                                                       // 실행 끝
  appendStage("pr:create", true, { title });                                                               // PR 생성 로그

  const prNumber = execSync(                                                                               // PR 번호 조회
    `gh pr list -s all --head ${ctx.branch} --json number --jq '.[0].number // empty'`
  ).toString().trim();                                                                                     // 문자열화
  ctx.prNumber = prNumber || null;                                                                         // ctx 반영
  writeRunMeta({ prNumber: ctx.prNumber });                                                                 // 메타 저장
  appendStage("pr:number", !!ctx.prNumber, { prNumber: ctx.prNumber });                                     // 번호 로그

  if (prNumber) {                                                                                           // 번호가 있으면
    execSync(                                                                                                // PR 코멘트
      `gh pr comment ${prNumber} --body-file ${JSON.stringify(promptBodyPath)}`,
      { stdio: "inherit" }                                                                                   // 출력 계승
    );                                                                                                       // 실행 끝
    appendStage("pr:comment-prompt", true, { prNumber });                                                    // 코멘트 로그

    const autoMerge = labelsCfg.autoMerge || "automation:auto-merge";                                        // 오토머지 라벨
    const cont = labelsCfg.continue || "automation:continue";                                                // 컨티뉴 라벨
    try {
      execSync(`gh pr edit ${prNumber} --add-label ${JSON.stringify(autoMerge)} --add-label ${JSON.stringify(cont)}`, { stdio: "inherit" }); // 라벨 추가
      appendStage("pr:labels", true, { added: [autoMerge, cont] });                                          // 라벨 로그
    } catch (e) {
      appendStage("pr:labels", false, { error: String(e?.message || e) });                                   // 실패 로그
    }
  }

  for (const h of (hooks.afterPR || [])) await h(ctx);                                                       // PR 후 훅
  appendStage("hooks:afterPR", true, null);                                                                  // 훅 로그

  writeRunMeta({ finishedAt: nowIso() });                                                                    // 종료 시각 기록
  appendStage("done", true, { longMode: ctx.longMode });                                                     // 완료 로그

  return { success: true, branch: ctx.branch, long: ctx.longMode, usage: ctx.usageTotals, prNumber: ctx.prNumber }; // 최종 결과
}                                                                                                            // 함수 끝
