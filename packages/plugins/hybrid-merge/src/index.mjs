import { execSync } from "node:child_process";

export async function register(reg) {
  reg.defineToken("auto-merge-when-green", async (ctx) => { ctx.tokenFlags.autoMergeWhenGreen = true; });
  reg.defineToken("continue-after-merge", async (ctx) => { ctx.tokenFlags.continueAfterMerge = true; });

  reg.addHook("afterPR", async (ctx) => {
    if (!ctx.prNumber) return;
    const labels = [];
    if (ctx.tokenFlags.autoMergeWhenGreen) labels.push("automation:auto-merge");
    if (ctx.tokenFlags.continueAfterMerge) labels.push("automation:continue");
    if (!labels.length) return;

    try {
      execSync(`gh pr edit ${ctx.prNumber} --add-label "${labels.join(",")}"`, { stdio: "inherit" });
      const note = [
        "### Hybrid merge",
        labels.includes("automation:auto-merge") ? "- Auto-merge: enabled (when all gates are green)" : "",
        labels.includes("automation:continue") ? "- Post-merge continue: enabled" : ""
      ].filter(Boolean).join("\n");
      execSync(`gh pr comment ${ctx.prNumber} --body ${JSON.stringify(note)}`, { stdio: "inherit" });
    } catch (e) {
      console.log("[hybrid-merge] labeling/comment failed:", e.message);
    }
  });
}
