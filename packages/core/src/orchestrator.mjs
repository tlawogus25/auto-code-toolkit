// packages/core/src/orchestrator.mjs
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
import { runWithClaude } from "./agents/claude.mjs";                                   // Claude 실행기
import { runWithCursor } from "./agents/cursor.mjs";                                   // Cursor 실행기

function nowIso(){ return new Date().toISOString(); }                                  // ISO 타임스탬프 유틸

export async function runOrchestrator({ repoRoot, configPath, eventPath }) {           // 엔트리포인트
  const cfg = JSON.parse(readFileSync(path.join(repoRoot, configPath), "utf8"));       // 설정 로드
  const tools = cfg.tools || {};                                                       // 도구 설정
  const policy = cfg.policy || {};                                                     // 정책(경로/제한)
  const labelsCfg = cfg.labels || {};                                                  // 라벨 키 설정
  const pluginsPaths = cfg.plugins || [];                                              // 플러그인 경로
  const pipeline = cfg.pipeline || { commands: {} };                                   // 파이프라인 훅

  // 이벤트 로드(없거나 파싱 실패 시 빈 객체로)
  let evt = {};
  try { evt = JSON.parse(readFileSync(eventPath, "utf8")); } catch {}

  const eventName = process.env.GITHUB_EVENT_NAME || "";                               // 이벤트명
  const isIssue = !!evt.issue && !evt.comment;                                         // 이슈 이벤트 여부
  const isDispatch = eventName === "workflow_dispatch";                                 // 디스패치 여부

  // 본문(/auto 포함) 안전 추출: 이벤트별로 경로가 다름 + 디스패치 입력/ENV 폴백
  const dispatchBody = (evt?.inputs?.body ?? process.env.AUTO_INPUT_BODY ?? "");
  const issueBody    = (evt?.issue?.body ?? "");
  const commentBody  = (evt?.comment?.body ?? "");
  const rawBody = (isDispatch ? dispatchBody : (isIssue ? issueBody : commentBody)).trim();

  // 라벨: 이슈 컨텍스트가 있을 때만
  const labels = (evt.issue?.labels || []).map(l => l?.name || "");

  // 원 이슈 번호(있으면)
  const sourceIssueNumber = evt?.issue?.number || null;

  // 트리거 가드: /auto 필수(없으면 조용히 종료)
  if (!rawBody || !rawBody.startsWith("/auto")) return { skipped: true };

  // 라벨 가드: 이슈/댓글 이벤트에만 적용(디스패치는 라벨 없이 허용)
  if (!isDispatch) {
    if (!labels.includes(labelsCfg.run || "automation:run")) return { skipped: true };
  }

  const { tokens, hooks: rawHooks } = await loadPlugins(pluginsPaths, repoRoot);       // 토큰/훅 로드
  const hooks = {
    beforeLLM: [], afterLLM: [], beforeAgent: [], afterAgent: [], beforePR: [], afterPR: [],
    ...(rawHooks || {}),
  };

  const after = rawBody.replace(/^\/auto\s*/i, "");                                    // /auto 접두 제거
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
  const outDir = process.env.AUTO_OUT_DIR
    ? path.resolve(process.env.AUTO_OUT_DIR)
    : path.join(repoRoot, ".github", "auto");
  fs.mkdirSync(outDir, { recursive: true });
  const stageLogPath = path.join(outDir, "stage-log.json");
  const runMetaPath  = path.join(outDir, "run-meta.json");

  // ★ 스테이지 로그 헬퍼: {stage, ok, details, ts} 배열로 누적 기록
  function appendStage(stage, ok, details){
    let arr = [];
    try { arr = JSON.parse(fs.readFileSync(stageLogPath, "utf8")); } catch {}
    arr.push({ stage, ok: !!ok, details: details ?? null, ts: nowIso() });
    fs.writeFileSync(stageLogPath, JSON.stringify(arr, null, 2), "utf8");
  }

  // ★ 런 메타 기록: 트리거/출발점/소스 이슈/선택 LLM/모드 등 요약
  function writeRunMeta(extra){
    const base = {
      startedAt: ctx.loopSummary.startedAt,
      event: evt.action || eventName || "n/a",
      source: isIssue ? "issue" : (isDispatch ? "dispatch" : "comment"),
      sourceIssueNumber: sourceIssueNumber,
      tokens: ctx.tokens,
      planOnly: ctx.planOnly,
      longMode: ctx.longMode,
      llm: ctx.llm, model: ctx.model, agent: ctx.agent,
      branch: ctx.branch, prNumber: ctx.prNumber
    };
    fs.writeFileSync(runMetaPath, JSON.stringify({ ...base, ...(extra||{}) }, null, 2), "utf8");
  }

  appendStage("bootstrap", true, {
    hasAuto: true,
    hasRunLabel: isDispatch ? "n/a(dispatch)" : labels.includes(labelsCfg.run || "automation:run")
  });
  writeRunMeta();

  // ★★★ 안전 패치: 경로 검증 헬퍼 추가 (허용/금지 글롭 기반)
  function toRegexes(globs = []) {
    return globs.map(s => new RegExp(s.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*")));
  }
  function matchesAny(p, regs) { return regs.some(r => r.test(p)); }
  function validateChangedPathsOrThrow(pol) {
    const allowedRegs = toRegexes(pol.allowed_globs || ["^src/","^app/","^docs/","^apps/","^services/","^README\\.md$"]);
    const forbiddenRegs = toRegexes(pol.forbidden_globs || ["^\\.env","^secrets/","^\\.git/"]);
    const out = execSync(`git ls-files -mo --exclude-standard`, { encoding: "utf8" }).trim();
    const files = out ? out.split("\n") : [];
    const offenders = [];
    for (const f of files) {
      if (matchesAny(f, forbiddenRegs)) { offenders.push({ path: f, reason: "forbidden" }); continue; }
      if (!matchesAny(f, allowedRegs))  { offenders.push({ path: f, reason: "outside_allowed" }); }
    }
    if (offenders.length) {
      appendStage("guard:path-offenders", false, { offenders });
      throw new Error("Changes include paths outside policy. See stage-log offenders.");
    }
  }
  // ★★★ 끝

  // /auto 토큰 핸들러 실행
  for (const t of seq) {
    const h = tokens.get(t.toLowerCase());
    if (h) await h(ctx);
  }

  // 입력 길이 가드
  const highCost = labels.includes(labelsCfg.highCost || "automation:high-cost");
  const max = policy.hard_stop_chars_without_high_cost_label ?? 20000;
  const planThreshold = policy.plan_only_threshold_chars ?? 8000;
  if (!(ctx.tokenFlags?.force && highCost)) {
    if (ctx.userDemand.length > max && !highCost) {
      appendStage("guard:input-too-long", false, { len: ctx.userDemand.length });
      throw new Error("Input too long without high-cost label.");
    }
  }
  ctx.planOnly = ctx.planOnly || (ctx.userDemand.length > planThreshold && !highCost);
  appendStage("route:pre", true, { planOnly: ctx.planOnly });

  const route = pickLLMAndAgent({
    userDemand: ctx.userDemand,
    planOnly: ctx.planOnly,
    tools,
    preferFast: ctx.preferFast
  });
  ctx.llm = route.llm; ctx.model = route.model; ctx.agent = route.agent;
  appendStage("route:selected", true, { llm: ctx.llm, model: ctx.model, agent: ctx.agent });

  for (const h of (hooks.beforeLLM || [])) await h(ctx);
  appendStage("hooks:beforeLLM", true, null);

  const systemGuard = [
    "[에이전트 가드레일]",
    `- 허용 경로: ${(policy.allowed_globs||["src/**","app/**","docs/**"]).join(", ")}`,
    `- 금지 경로: ${(policy.forbidden_globs||[".env*","secrets/**",".git/**"]).join(", ")}`,
    "- .env* / 비밀키 / .git 은 읽기·쓰기도 금지",
    "- 테스트가 있으면 실행 전략 제안",
    "- 변경은 설명 가능한 작은 커밋 단위 권장",
    "- 절대 쉘/Bash 명령을 실행하지 말 것(파일 편집/패치만 수행)",
    "- 존재하지 않는 디렉터리는 패치 내에서 생성 후 파일을 추가"
  ].join("\n");

  const content = [
    systemGuard, "\n[사용자 요구]", ctx.userDemand, "\n[원하는 산출물]",
    "- 변경 개요(목록)", "- 파일별 수정 계획", "- 안전 체크리스트",
    ctx.planOnly ? "- (플랜 전용: 실행명령 생략)" : "- 최종 실행할 수정 단계"
  ].join("\n");

  async function callOpenAIOnce({ userText }) {
    const fallbackModel = (ctx.tools?.openai?.default) || "gpt-4o-mini";
    const { text, usage } = await runOpenAI({
      client: makeOpenAI(process.env.OPENAI_API_KEY),
      model: fallbackModel,
      system: systemGuard,
      user: userText,
      reasoning: { effort: ctx.planOnly ? "medium" : "high" }
    });
    if (usage) {
      ctx.usageTotals.openai.input += (usage.input_tokens||0);
      ctx.usageTotals.openai.output += (usage.output_tokens||0);
    }
    return text || "";
  }

  async function genPrompt(){
    try {
      if (ctx.llm === "openai") {
        const { text, usage } = await runOpenAI({
          client: makeOpenAI(process.env.OPENAI_API_KEY),
          model: ctx.model, system: systemGuard, user: content,
          reasoning: { effort: ctx.planOnly ? "medium" : "high" }
        });
        if (usage) {
          ctx.usageTotals.openai.input += (usage.input_tokens||0);
          ctx.usageTotals.openai.output += (usage.output_tokens||0);
        }
        appendStage("llm:openai", true, { model: ctx.model });
        return text || "";
      } else {
        const { text } = await runGemini({
          client: makeGemini(process.env.GEMINI_API_KEY),
          model: ctx.model, user: content
        });
        if (!text || !String(text).trim()) {
          appendStage("llm:gemini-empty", false, null);
          const t = await callOpenAIOnce({ userText: content });
          appendStage("llm:fallback-openai", !!t, { used: "openai:single" });
          return t || "";
        }
        appendStage("llm:gemini", true, { model: ctx.model });
        return text;
      }
    } catch (e) {
      appendStage("llm:error", false, { message: String(e?.message || e) });
      const t = await callOpenAIOnce({ userText: content });
      appendStage("llm:fallback-openai", !!t, { used: "openai:on-error" });
      return t || "";
    }
  }

  function synthesizePrompt() {
    return [
      "You are a senior full-stack engineer acting as an autonomous code agent.",
      "Follow these guardrails strictly:",
      systemGuard, "",
      "[Task]", ctx.userDemand || "No explicit task text was provided. Propose a minimal safe change within allowed paths.", "",
      "[Deliverables]", "- A short plan", "- File-by-file changes", "- Safety checklist", "- (If allowed) exact commands or edits"
    ].join("\n");
  }

  function normalizeAgentPrompt(text) {
    const trimmed = (text || "").trim();
    return trimmed || synthesizePrompt();
  }

  ctx.agentPrompt = normalizeAgentPrompt(await genPrompt());
  appendStage("llm:prompt-ready", true, { length: ctx.agentPrompt.length });
  for (const h of (hooks.afterLLM || [])) await h(ctx);
  appendStage("hooks:afterLLM", true, null);

  if (ctx.tokenFlags?.dryRun) { writeRunMeta({ dryRun: true }); return { dryRun: true, ctx }; }
  if (ctx.agent === "none" || ctx.planOnly) { writeRunMeta({ planOnly: ctx.planOnly }); return { planOnly: true, ctx }; }

// orchestrator.mjs                                                                    // 파일 동일
// Part 2/2: 에이전트 실행·체크포인트·PR 생성·메타/스테이지 기록                       // 파트 개요

  function checkpointCommit(msg){
    try {
      // 모든 변경 스테이징
      execSync(`git add -A`, { stdio: "inherit" });
      // ★ 안전 패치: 런타임 아티팩트(.github/auto)는 스테이징에서 제거하여 PR 포함 방지
      // (존재하지 않아도 no-op; Git 2.23+ 지원)
      execSync(`git restore --staged .github/auto || true`, { stdio: "inherit" });
    } catch {}
    try {
      execSync(`git commit -m ${JSON.stringify(msg)}`, { stdio: "inherit" });
    } catch {
      console.log("No changes to commit for checkpoint.");
    }
  }

  execSync(`git config user.name "github-actions[bot]"`, { stdio: "inherit" });
  execSync(`git config user.email "github-actions[bot]@users.noreply.github.com"`, { stdio: "inherit" });
  const branch = `auto/${Date.now()}`;
  ctx.branch = branch;
  execSync(`git checkout -b ${branch}`, { stdio: "inherit" });
  appendStage("git:branch", true, { branch });
  writeRunMeta();

  const cancelPath = path.join(outDir, "CANCEL");
  const start = Date.now();

  async function runAgentWithFallback(promptText, tools, policy) {
    const primary = (ctx.agent || "").toLowerCase();
    const fallback = primary === "claude" ? "cursor" : "claude";
    try {
      const safePrompt = normalizeAgentPrompt(promptText);
      if (primary === "claude") await runWithClaude(safePrompt, tools, policy);
      else await runWithCursor(safePrompt, tools, policy);
      appendStage("agent:primary", true, { used: primary });
      return { ok: true, used: primary };
    } catch (e1) {
      appendStage("agent:primary", false, { used: primary, error: String(e1?.message||e1) });
      try {
        const safePrompt2 = normalizeAgentPrompt(promptText);
        if (fallback === "claude") await runWithClaude(safePrompt2, tools, policy);
        else await runWithCursor(safePrompt2, tools, policy);
        appendStage("agent:fallback", true, { chain: `${primary}->${fallback}` });
        return { ok: true, used: `${primary}->${fallback}` };
      } catch (e2) {
        appendStage("agent:fallback", false, { chain: `${primary}->${fallback}`, error: String(e2?.message||e2) });
        return { ok: false, used: `${primary}->${fallback}` };
      }
    }
  }

  async function runOneStep(step) {
    for (const h of (hooks.beforeAgent || [])) await h(ctx);
    appendStage("hooks:beforeAgent", true, { step });
    const result = await runAgentWithFallback(ctx.agentPrompt, tools, policy);
    ctx.agentUsed = result.used || ctx.agent; // ★ 실제 사용 체인 기록
    for (const h of (hooks.afterAgent || [])) await h(ctx);
    appendStage("hooks:afterAgent", true, { step, ok: result.ok });

    // ★★★ 안전 패치: 커밋 직전 경로 검증(허용/금지 글롭 위반 시 즉시 실패)
    validateChangedPathsOrThrow(policy);

    checkpointCommit(`auto: checkpoint step ${step}`);
    try { execSync(`git push origin ${branch}`, { stdio: "inherit" }); } catch {}
    appendStage("git:push", true, { step });
    ctx.loopSummary.steps.push({ step, at: nowIso(), agentUsed: result.used, ok: result.ok });
    writeRunMeta({ loopSummary: ctx.loopSummary });
    const diagFile = path.join(outDir, "diagnostics-last.json");
    writeFileSync(diagFile, JSON.stringify({
      when: nowIso(),
      logs: [{ stage: "agent", ok: !!result.ok, out: result.used }]
    }, null, 2), "utf8");
  }

  if (ctx.longMode) {
    const maxMs = (ctx.budgetMinutes||60) * 60 * 1000;
    const maxSteps = ctx.budgetSteps || 3;
    for (let step=1; step<=maxSteps; step++) {
      if (existsSync(cancelPath)) { appendStage("long:cancel", true, null); break; }
      if ((Date.now()-start) > maxMs) { appendStage("long:timeout", false, { maxMs }); break; }
      await runOneStep(step);
    }
  } else {
    await runOneStep(1);
  }

  for (const h of (hooks.beforePR || [])) await h(ctx);
  appendStage("hooks:beforePR", true, null);

  // 결과 요약에 실제 사용된 에이전트 체인(result.used)을 합류
  const agentUsed = (ctx.agentUsed && String(ctx.agentUsed).trim()) || ctx.agent;
  const tokenList = (ctx.tokens||[]).join(", ") || "(none)";
  const labelList = labels.join(", ") || "(none)";
  const truncatedUserDemand = (ctx.userDemand || "").slice(0, 2000);
  const costLine = `OpenAI usage: in=${ctx.usageTotals.openai.input} out=${ctx.usageTotals.openai.output}`;
  const sourceIssueLine = sourceIssueNumber ? `Source-Issue: #${sourceIssueNumber}` : "Source-Issue: n/a";

  const infoMd = [
    `## Auto-run Info`,
    ``,
    `- LLM (plan): **${ctx.llm}** (${ctx.model})`,
    `- Agent (requested): **${ctx.agent}**`,
    `- Agent (actual): **${agentUsed}**`, // ★ 실제 사용 체인 표기
    `- Branch: ${ctx.branch}`,
    `- Labels: ${labelList}`,
    `- Tokens: ${tokenList}`,
    `- ${costLine}`,
    `- ${sourceIssueLine}`,
    ``,
    `## Prompt (truncated)`,
    "", "```", truncatedUserDemand, "```", ""
  ].join("\n");

  const promptMd = [
    `# Original Prompt`, "", "```", ctx.userDemand, "```", "",
    "## Last Agent Prompt", "", "```", (ctx.agentPrompt || "").trim(), "```"
  ].join("\n");

  const prBodyPath = path.join(outDir, `pr-body-${Date.now()}.md`);
  const promptBodyPath = path.join(outDir, `prompt-${Date.now()}.md`);
  writeFileSync(prBodyPath, infoMd, "utf8");
  writeFileSync(promptBodyPath, promptMd, "utf8");

  // ★ 제목에도 실제 사용 체인 반영
  const title = `auto: ${ctx.branch} [${ctx.llm}/${agentUsed}] (tokens: ${tokenList})`;
  execSync(
    `gh pr create --title ${JSON.stringify(title)} --body-file ${JSON.stringify(prBodyPath)} --base main --head ${ctx.branch}`,
    { stdio: "inherit" }
  );
  appendStage("pr:create", true, { title });

  const prNumber = execSync(
    `gh pr list -s all --head ${ctx.branch} --json number --jq '.[0].number // empty'`
  ).toString().trim();
  ctx.prNumber = prNumber || null;
  writeRunMeta();
  appendStage("pr:number", !!ctx.prNumber, { prNumber: ctx.prNumber });

  if (prNumber) {
    execSync(
      `gh pr comment ${prNumber} --body-file ${JSON.stringify(promptBodyPath)}`,
      { stdio: "inherit" }
    );
    appendStage("pr:comment-prompt", true, { prNumber });

    // ★ 안전망: 자동 라벨 부여(플러그인 실패 대비, 중복 부착 안전)
    const autoMerge = labelsCfg.autoMerge || "automation:auto-merge";
    const cont = labelsCfg.continue || "automation:continue";
    try {
      execSync(`gh pr edit ${prNumber} --add-label ${JSON.stringify(autoMerge)} --add-label ${JSON.stringify(cont)}`, { stdio: "inherit" });
      appendStage("pr:labels", true, { added: [autoMerge, cont] });
    } catch (e) {
      appendStage("pr:labels", false, { error: String(e?.message || e) });
    }
  }

  for (const h of (hooks.afterPR || [])) await h(ctx);
  appendStage("hooks:afterPR", true, null);

  writeRunMeta({ finishedAt: nowIso() });
  appendStage("done", true, { longMode: ctx.longMode });

  return { success: true, branch: ctx.branch, long: ctx.longMode, usage: ctx.usageTotals, prNumber: ctx.prNumber };
}
