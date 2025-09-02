import { execSync } from "node:child_process";
export async function register(reg) {
  reg.defineToken("crawl", async (ctx) => { ctx.tokenFlags.crawl = true; });
  reg.addHook("beforeAgent", async (ctx) => {
    if (!ctx.tokenFlags.crawl) return;
    try { execSync("npx --yes playwright install chromium", { stdio: "inherit" }); }
    catch(e) { console.log("Playwright install failed (continuing).", e.message); }
  });
}
