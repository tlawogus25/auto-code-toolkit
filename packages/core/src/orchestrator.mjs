// Orchestrator with long-run + self-heal/cost + hybrid-merge support
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import process from "node:process";
import { loadPlugins } from "./tokens/registry.mjs";
import { pickLLMAndAgent } from "./router.mjs";
import { makeOpenAI, runOpenAI } from "./llm/openai.mjs";
import { makeGemini, runGemini } from "./llm/gemini.mjs";
import { runWithClaude } from "./agents/claude.mjs";
import { runWithCursor } from "./agents/cursor.mjs";

function nowIso(){ return new Date().toISOString(); }

export async function runOrchestrator({ repoRoot, configPath, eventPath }) {
  const cfg = JSON.parse(readFileSync(path.join(repoRoot, configPath), "utf8"));
  const tools = cfg.tools || {};
  const policy = cfg.policy || {};
  const labelsCfg = cfg.labels || {};
  const pluginsPaths = cfg.plugins || [];
  const pipeline = cfg.pipeline || { commands: {} };

  const evt = JSON.parse(readFileSync(eventPath, "utf8"));
  const isIssue = !!evt.issue && !evt.comment;
  const rawBody = (isIssue ? (evt.issue.body || "") : (evt.comment.body || "")).trim();
  const labels = (evt.issue?.labels || []).map(l => l.name || "");

  if (!rawBody.startsWith("/auto")) return { skipped: true };
  if (!labels.includes(labelsCfg.run || "automation:run")) return { skipped: true };

  const { tokens, hooks } = await loadPlugins(pluginsPaths, repoRoot);
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
    prNumber: null,
    branch: null
  };

  for (const t of seq) { const h = tokens.get(t.toLowerCase()); if (h) await h(ctx); }

  const highCost = labels.includes(labelsCfg.highCost || "automation:high-cost");
  const max = policy.hard_stop_chars_without_high_cost_label ?? 20000;
  const planThreshold = policy.plan_only_threshold_chars ?? 8000;
  if (!(ctx.tokenFlags?.force && highCost)) {
    if (ctx.userDemand.length > max && !highCost)
      throw new Error("Input too long without high-cost label.");
  }
  ctx.planOnly = ctx.planOnly || (ctx.userDemand.length > planThreshold && !highCost);

  const route = pickLLMAndAgent({ userDemand: ctx.userDemand, planOnly: ctx.planOnly, tools, preferFast: ctx.preferFast });
  ctx.llm = route.llm; ctx.model = route.model; ctx.agent = route.agent;

  for (const h of hooks.beforeLLM) await h(ctx);

  const systemGuard = [
    "[에이전트 가드레일]",
    `- 허용 경로: ${(policy.allowed_globs||["src/**","app/**","docs/**"]).join(", ")}`,
    `- 금지 경로: ${(policy.forbidden_globs||[".env*","secrets/**",".git/**"]).join(", ")}`,
    "- .env* / 비밀키 / .git 은 읽기·쓰기도 금지",
    "- 테스트가 있으면 실행 전략 제안",
    "- 변경은 설명 가능한 작은 커밋 단위 권장"
  ].join("\n");

  const content = [
    systemGuard, "\n[사용자 요구]", ctx.userDemand, "\n[원하는 산출물]",
    "- 변경 개요(목록)", "- 파일별 수정 계획", "- 안전 체크리스트",
    ctx.planOnly ? "- (플랜 전용: 실행명령 생략)" : "- 최종 실행할 수정 단계"
  ].join("\n");

  async function genPrompt(){
    if (ctx.llm === "openai") {
      const { text, usage } = await runOpenAI({
        client: makeOpenAI(process.env.OPENAI_API_KEY),
        model: ctx.model, system: systemGuard, user: content,
        reasoning: { effort: ctx.planOnly ? "medium" : "high" }
      });
      if (usage) { ctx.usageTotals.openai.input += (usage.input_tokens||0); ctx.usageTotals.openai.output += (usage.output_tokens||0); }
      return text;
    } else {
      try {
        const { text } = await runGemini({
          client: makeGemini(process.env.GEMINI_API_KEY),
          model: ctx.model,
          user: content
        });
        return text;
      } catch (e) {
        ctx.diagnostics.last = {
          type: "llm-fallback",
          from: "gemini",
          to: "openai",
          message: String(e?.message || e)
        };
        const fallbackModel = (ctx.tools?.openai?.default) || "gpt-4o-mini";
        const { text, usage } = await runOpenAI({
          client: makeOpenAI(process.env.OPENAI_API_KEY),
          model: fallbackModel,
          system: systemGuard,
          user: content,
          reasoning: { effort: ctx.planOnly ? "medium" : "high" }
        });
        if (usage) {
          ctx.usageTotals.openai.input += (usage.input_tokens||0);
          ctx.usageTotals.openai.output += (usage.output_tokens||0);
        }
        return text;
      }
    }
  }

  ctx.agentPrompt = await genPrompt();
  for (const h of hooks.afterLLM) await h(ctx);

  if (ctx.tokenFlags?.dryRun) return { dryRun: true, ctx };
  if (ctx.agent === "none" || ctx.planOnly) return { planOnly: true, ctx };

  function checkpointCommit(msg){
    try { execSync(`git add -A`, { stdio: "inherit" }); execSync(`git commit -m ${JSON.stringify(msg)}`, { stdio: "inherit" }); }
    catch { console.log("No changes to commit for checkpoint."); }
  }

  execSync(`git config user.name "github-actions[bot]"`, { stdio: "inherit" });
  execSync(`git config user.email "github-actions[bot]@users.noreply.github.com"`, { stdio: "inherit" });
  const branch = `auto/${Date.now()}`;
  ctx.branch = branch;
  execSync(`git checkout -b ${branch}`, { stdio: "inherit" });

  // 보장된 출력 디렉터리 (.github/auto 또는 AUTO_OUT_DIR)
  const outDir = process.env.AUTO_OUT_DIR
    ? path.resolve(process.env.AUTO_OUT_DIR)
    : path.join(repoRoot, ".github", "auto");
  fs.mkdirSync(outDir, { recursive: true });
  const cancelPath = path.join(outDir, "CANCEL");
  const start = Date.now();

  async function runOneStep(step) {
    for (const h of hooks.beforeAgent) await h(ctx);
    try {
      if (ctx.agent === "claude") await runWithClaude(ctx.agentPrompt, tools, policy);
      else await runWithCursor(ctx.agentPrompt, tools, policy);
    } catch(e) {
      console.log("[Agent error]", e.message);
      ctx.diagnostics.last = { type: "agent-error", message: e.message };
    }
    for (const h of hooks.afterAgent) await h(ctx);
    checkpointCommit(`auto: checkpoint step ${step}`);
    try { execSync(`git push origin ${branch}`, { stdio: "inherit" }); } catch {}
    ctx.loopSummary.steps.push({ step, at: new Date().toISOString() });
  }

  if (ctx.longMode) {
    const maxMs = (ctx.budgetMinutes||60) * 60 * 1000;
    const maxSteps = ctx.budgetSteps || 3;
    for (let step=1; step<=maxSteps; step++) {
      if (existsSync(cancelPath)) break;
      if ((Date.now()-start) > maxMs) break;
      await runOneStep(step);
      // 빈 프롬프트 방지: 다음 스텝 입력이 비면 보정
      if (!ctx.agentPrompt || typeof ctx.agentPrompt !== "string" || !ctx.agentPrompt.trim()) {
        ctx.agentPrompt = "Continue.";
      }
    }
  } else {
    await runOneStep(1);
  }

  for (const h of hooks.beforePR) await h(ctx);

  const tokenList = (ctx.tokens||[]).join(", ") || "(none)";
  const labelList = labels.join(", ") || "(none)";
  const truncatedUserDemand = (ctx.userDemand || "").slice(0, 2000);
  const agentSnippet = (ctx.agentPrompt || "").slice(0, 500); // ✅ PR 본문에 agentPrompt 일부 포함
  const costLine = `OpenAI usage: in=${ctx.usageTotals.openai.input} out=${ctx.usageTotals.openai.output}`;

  const infoMd = [
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
    "",
    "## Agent Prompt (snippet)",
    "",
    "```",
    agentSnippet,
    "```",
    "",
    ctx.longMode ? `> Long-run: budget ${ctx.budgetMinutes} min / ${ctx.budgetSteps} steps.` : ""
  ].join("\n");

  const promptMd = [
    `# Original Prompt`,
    "",
    "```",
    ctx.userDemand,
    "```",
    "",
    "## Last Agent Prompt",
    "",
    "```",
    ctx.agentPrompt,
    "```"
  ].join("\n");

  const prBodyPath = path.join(outDir, `pr-body-${Date.now()}.md`);
  const promptBodyPath = path.join(outDir, `prompt-${Date.now()}.md`);
  writeFileSync(prBodyPath, infoMd, "utf8");
  writeFileSync(promptBodyPath, promptMd, "utf8");

  // PR 생성
  const title = `auto: ${ctx.branch} [${ctx.llm}/${ctx.agent}] (tokens: ${tokenList})`;
  execSync(
    `gh pr create --title ${JSON.stringify(title)} --body-file ${JSON.stringify(prBodyPath)} --base main --head ${ctx.branch}`,
    { stdio: "inherit" }
  );

  // 🔧 안전한 PR 번호 조회(gh pr view --head 미사용)
  const prNumber = execSync(
    `gh pr list -s all --head ${ctx.branch} --json number --jq '.[0].number // empty'`
  ).toString().trim();

  ctx.prNumber = prNumber || null;

  if (prNumber) {
    execSync(
      `gh pr comment ${prNumber} --body-file ${JSON.stringify(promptBodyPath)}`,
      { stdio: "inherit" }
    );
  }

  for (const h of hooks.afterPR) await h(ctx);

  return { success: true, branch: ctx.branch, long: ctx.longMode, usage: ctx.usageTotals, prNumber: ctx.prNumber };
}
