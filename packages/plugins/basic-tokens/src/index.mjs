export async function register(reg) {
  reg.defineToken("plan", async (ctx) => { ctx.planOnly = true; ctx.tokenFlags.plan = true; });
  reg.defineToken("edit", async (ctx) => { ctx.planOnly = false; ctx.tokenFlags.edit = true; });
  reg.defineToken("dry-run", async (ctx) => { ctx.tokenFlags.dryRun = true; });
  reg.defineToken("fast", async (ctx) => { ctx.preferFast = true; ctx.tokenFlags.fast = true; });
  reg.defineToken("force", async (ctx) => { ctx.tokenFlags.force = true; });
}
