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
  const isDispatch = eventName === "workflow_dispatch";                                // 디스패치 여부

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

  // 산출물/메타 파일 경로
  const outDir = process.env.AUTO_OUT_DIR
    ? path.resolve(process.env.AUTO_OUT_DIR)
    : path.join(repoRoot, ".github", "auto");
  fs.mkdirSync(outDir, { recursive: true });
  const stageLogPath = path.join(outDir, "stage-log.json");
  const runMetaPath  = path.join(outDir, "run-meta.json");

  // 서비스 루트(sandbox) 고정: apps/auto-<runId> (또는 ENV로 재지정)
  const RUN_ID = Date.now();
  const SERVICE_ROOT = process.env.AUTO_SERVICE_ROOT
    ? path.resolve(repoRoot, process.env.AUTO_SERVICE_ROOT)
    : path.join(repoRoot, "apps", `auto-${RUN_ID}`);
  const REL_SERVICE_ROOT = path.relative(repoRoot, SERVICE_ROOT) || ".";
  fs.mkdirSync(path.join(SERVICE_ROOT, "app"),   { recursive: true });
  fs.mkdirSync(path.join(SERVICE_ROOT, "src"),   { recursive: true });
  fs.mkdirSync(path.join(SERVICE_ROOT, "tests"), { recursive: true });
  fs.mkdirSync(path.join(SERVICE_ROOT, "docs"),  { recursive: true });
  const readmePath = path.join(SERVICE_ROOT, "README.md");
  if (!existsSync(readmePath)) {
    fs.writeFileSync(
      readmePath,
      `# Auto Service Root

- This directory is the sandbox for generated code.
- Create app/src/docs/tests under here.

`,
      "utf8"
    );
  }

  // 스테이지 로그/메타 기록 도우미
  function appendStage(stage, ok, details){
    let arr = [];
    try { arr = JSON.parse(fs.readFileSync(stageLogPath, "utf8")); } catch {}
    arr.push({ stage, ok: !!ok, details: details ?? null, ts: nowIso() });
    fs.writeFileSync(stageLogPath, JSON.stringify(arr, null, 2), "utf8");
  }
  function writeRunMeta(extra){
    const base = {
      startedAt: nowIso(),
      event: evt.action || eventName || "n/a",
      source: isIssue ? "issue" : (isDispatch ? "dispatch" : "comment"),
      sourceIssueNumber,
      tokens: [], // 토큰은 아래에서 결정
      planOnly: false,
      longMode: false,
      llm: null, model: null, agent: null,
      branch: null, prNumber: null,
      serviceRoot: REL_SERVICE_ROOT
    };
    try {
      const prev = JSON.parse(fs.readFileSync(runMetaPath, "utf8"));
      fs.writeFileSync(runMetaPath, JSON.stringify({ ...prev, ...base, ...(extra||{}) }, null, 2), "utf8");
    } catch {
      fs.writeFileSync(runMetaPath, JSON.stringify({ ...base, ...(extra||{}) }, null, 2), "utf8");
    }
  }
  appendStage("scaffold:service-root", true, { serviceRoot: REL_SERVICE_ROOT });
  appendStage("bootstrap", true, {
    hasAuto: true,
    hasRunLabel: isDispatch ? "n/a(dispatch)" : labels.includes(labelsCfg.run || "automation:run")
  });
  writeRunMeta();

  // ===== 경로 검증/스테이징 헬퍼 (스테이지된 파일만 검증) =====
  function toRegexes(globs = []) {
    return globs.map(s => new RegExp(s.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*")));
  }
  function matchesAny(p, regs) { return regs.some(r => r.test(p)); }

  // 스테이징: 모두 추가 후 런타임 산출물은 언스테이지(커밋/검사 대상 제외)
  function stageForCommit() {
    try {
      execSync(`git add -A`, { stdio: "inherit" });
      execSync(`git restore --staged .github/auto || true`, { stdio: "inherit" });
    } catch (e) {
      console.log("stageForCommit: ignored error", e?.message || e);
    }
  }

  // 스테이지된 파일 목록(커밋 후보)
  function getStagedPaths() {
    const out = execSync(`git diff --name-only --cached`, { encoding: "utf8" }).trim();
    return out ? out.split("\n") : [];
  }

  // 스테이지된 파일만 정책 검증
  function validateStagedPathsOrThrow(pol) {
    const allowedRegs   = toRegexes(pol.allowed_globs   || ["^src/","^app/","^docs/","^apps/","^services/","^README\\.md$"]);
    const forbiddenRegs = toRegexes(pol.forbidden_globs || ["^\\.env","^secrets/","^\\.git/"]);
    const files = getStagedPaths();

    const offenders = [];
    for (const f of files) {
      if (matchesAny(f, forbiddenRegs)) { offenders.push({ path: f, reason: "forbidden" }); continue; }
      if (!matchesAny(f, allowedRegs))  { offenders.push({ path: f, reason: "outside_allowed" }); }
    }

    if (offenders.length) {
      appendStage("guard:path-offenders", false, { offenders, scope: "staged-only" });
      throw new Error("Changes include paths outside policy. See stage-log offenders.");
    }
    appendStage("guard:path-ok", true, { filesCount: files.length, files });
  }
  // ==========================================================

  // /auto 토큰/훅
  const { tokens, hooks: rawHooks } = await loadPlugins(pluginsPaths, repoRoot);
  const hooks = {
    beforeLLM: [], afterLLM: [], beforeAgent: [], afterAgent: [], beforePR: [], afterPR: [],
    ...(rawHooks || {}),
  };

  const after = rawBody.replace(/^\/auto\s*/i, "");
  const m = after.match(/^((?:[\w:-]+)\b\s*)+/i) || [""];
  const seq = (m[0] || "").trim().split(/\s+/).filter(Boolean);
  const rest = after.slice((m[0]||"").length).trim();

  const ctx = {
    repoRoot, cfg, tools, policy, labels, pipeline,
    tokens: seq, tokenFlags: {},
    userDemand: rest,
    llm: null, model: null, agent: null,
    agentPrompt: "",
    planOnly: false, preferFast: false,
    longMode: false, budgetMinutes: null, budgetSteps: null,
    loopSummary: { startedAt: nowIso(), steps: [] },
    usageTotals: { openai: { input:0, output:0 }, gemini: { input:0, output:0 } },
    diagnostics: { last: null },
    prNumber: null, branch: null
  };
  writeRunMeta({ tokens: ctx.tokens });

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
  writeRunMeta({ llm: ctx.llm, model: ctx.model, agent: ctx.agent, planOnly: ctx.planOnly });

  for (const h of (hooks.beforeLLM || [])) await h(ctx);
  appendStage("hooks:beforeLLM", true, null);

  const systemGuard = [
    "[에이전트 가드레일]",
    `- 허용 경로: ${(policy.allowed_globs||["src/**","app/**","docs/**","apps/**","services/**","README.md"]).join(", ")}`,
    `- 금지 경로: ${(policy.forbidden_globs||[".env*","secrets/**",".git/**"]).join(", ")}`,
    `- 서비스 루트(신규 생성 루트): ${REL_SERVICE_ROOT}/`,
    "- 'app/', 'src/', 'docs/', 'tests/' 경로는 반드시 서비스 루트 하위에 생성 (예: 'src/x' → '<서비스루트>/src/x')",
    "- 'packages/**' 경로는 편집/생성 금지(툴킷 오염 방지)",
    "- .env* / 비밀키 / .git 은 읽기·쓰기도 금지",
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

  // Part 2/2: 에이전트 실행·체크포인트·PR 생성·메타/스테이지 기록

  function checkpointCommit(msg){
    try {
      execSync(`git add -A`, { stdio: "inherit" });
      // 런타임 아티팩트 제외
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
  const branch = `auto/${RUN_ID}`;
  ctx.branch = branch;
  execSync(`git checkout -b ${branch}`, { stdio: "inherit" });
  appendStage("git:branch", true, { branch });
  writeRunMeta({ branch });

  const cancelPath = path.join(outDir, "CANCEL");
  const start = Date.now();

  async function runAgentWithFallback(promptText, toolsArg, policyArg) {
    const primary = (ctx.agent || "").toLowerCase();
    const fallback = primary === "claude" ? "cursor" : "claude";
    try {
      const safePrompt = normalizeAgentPrompt(promptText);
      if (primary === "claude") await runWithClaude(safePrompt, toolsArg, policyArg);
      else await runWithCursor(safePrompt, toolsArg, policyArg);
      appendStage("agent:primary", true, { used: primary });
      return { ok: true, used: primary };
    } catch (e1) {
      appendStage("agent:primary", false, { used: primary, error: String(e1?.message||e1) });
      try {
        const safePrompt2 = normalizeAgentPrompt(promptText);
        if (fallback === "claude") await runWithClaude(safePrompt2, toolsArg, policyArg);
        else await runWithCursor(safePrompt2, toolsArg, policyArg);
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

    // 에이전트는 서비스 루트(CWD)에서 실행 → 상대경로 생성이 apps/... 하위로 고정
    const originalCwd = process.cwd();
    try {
      process.chdir(SERVICE_ROOT);
      appendStage("cwd:enter-service-root", true, { cwd: REL_SERVICE_ROOT });
      const result = await runAgentWithFallback(ctx.agentPrompt, tools, policy);
      ctx.agentUsed = result.used || ctx.agent;
      appendStage("hooks:afterAgent", true, { step, ok: result.ok });

      // 커밋 전: 저장소 루트로 복귀 → 스테이징/검증/커밋/푸시
      process.chdir(repoRoot);

      // 커밋 대상만 검사하도록 스테이징 → 검증
      stageForCommit();
      validateStagedPathsOrThrow(policy);

      checkpointCommit(`auto: checkpoint step ${step}`);
      try { execSync(`git push origin ${branch}`, { stdio: "inherit" }); } catch {}
      appendStage("git:push", true, { step });
      ctx.loopSummary.steps.push({ step, at: nowIso(), agentUsed: result.used, ok: result.ok });
      writeRunMeta({ loopSummary: ctx.loopSummary });
      const diagFile = path.join(outDir, "diagnostics-last.json");
      writeFileSync(diagFile, JSON.stringify({
        when: nowIso(),
        logs: [{ stage: "agent", ok: true, out: result.used }]
      }, null, 2), "utf8");
    } finally {
      try { process.chdir(originalCwd); appendStage("cwd:leave-service-root", true, { restored: true }); } catch {}
    }
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

  // 결과 요약
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
    `- Agent (actual): **${agentUsed}**`,
    `- Branch: ${ctx.branch}`,
    `- Service Root: ${REL_SERVICE_ROOT}/`,
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

  const prBodyPath = path.join(outDir, `pr-body-${RUN_ID}.md`);
  const promptBodyPath = path.join(outDir, `prompt-${RUN_ID}.md`);
  writeFileSync(prBodyPath, infoMd, "utf8");
  writeFileSync(promptBodyPath, promptMd, "utf8");

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
  writeRunMeta({ prNumber: ctx.prNumber });
  appendStage("pr:number", !!ctx.prNumber, { prNumber: ctx.prNumber });

  if (prNumber) {
    execSync(
      `gh pr comment ${prNumber} --body-file ${JSON.stringify(promptBodyPath)}`,
      { stdio: "inherit" }
    );
    appendStage("pr:comment-prompt", true, { prNumber });

    // 안전망: 자동 라벨 부여(플러그인 실패 대비)
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

