import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

function runCmd(cmd) {
  try {
    const out = execSync(cmd, { encoding: "utf-8" });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: e.stdout?.toString() || "", err: e.stderr?.toString() || e.message };
  }
}

export async function register(reg) {
  reg.defineToken("diagnose", async (ctx) => { ctx.tokenFlags.diagnose = true; });
  reg.defineToken("autorepair", async (ctx) => { ctx.tokenFlags.autorepair = true; });
  reg.defineToken("test-build", async (ctx) => { ctx.tokenFlags.testBuild = true; });
  reg.defineToken("lint-fix", async (ctx) => { ctx.tokenFlags.lintFix = true; });

  reg.addHook("afterAgent", async (ctx) => {
    if (!ctx.tokenFlags.diagnose && !ctx.tokenFlags.testBuild && !ctx.tokenFlags.lintFix) return;

    const cmds = ctx.pipeline?.commands || {};
    const logs = [];

    if (ctx.tokenFlags.lintFix && cmds.lint_fix) {
      const r = runCmd(cmds.lint_fix);
      logs.push({ stage: "lint-fix", ok: r.ok, out: r.out, err: r.err });
    }

    if (ctx.tokenFlags.testBuild && cmds.test) {
      const r = runCmd(cmds.test);
      logs.push({ stage: "test", ok: r.ok, out: r.out, err: r.err });
    }

    if (ctx.tokenFlags.testBuild && cmds.build) {
      const r = runCmd(cmds.build);
      logs.push({ stage: "build", ok: r.ok, out: r.out, err: r.err });
    }

    ctx.diagnostics.last = { logs };

    const failed = logs.find(l => l.ok === false);
    if (failed && ctx.tokenFlags.autorepair) {
      const truncated = (failed.err || failed.out || "").slice(-5000);
      const hint = [
        "[DIAGNOSTICS]",
        `- Stage: ${failed.stage}`,
        `- Error (tail):`,
        "```",
        truncated,
        "```",
        "",
        "Please patch the repository to resolve this failure.",
        "- Keep changes minimal and explainable.",
        "- Update or create tests if needed.",
        "- After patching, re-run the failing stage locally in the next step."
      ].join("\n");
      ctx.agentPrompt = (ctx.agentPrompt + "\n\n" + hint).slice(-30000);
    }

    try {
      writeFileSync(".github/auto/diagnostics-last.json", JSON.stringify({ when: new Date().toISOString(), logs }, null, 2), "utf8");
    } catch {}
  });
}
