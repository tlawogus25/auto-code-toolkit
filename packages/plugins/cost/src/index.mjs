export async function register(reg) {
  reg.defineToken("budget-tokens-1k", async (ctx) => { ctx.tokenFlags.budgetTokens = 1000; });
  reg.defineToken("budget-tokens-5k", async (ctx) => { ctx.tokenFlags.budgetTokens = 5000; });
  reg.defineToken("cooldown-5s", async (ctx) => { ctx.tokenFlags.cooldownSec = 5; });
  reg.defineToken("cooldown-15s", async (ctx) => { ctx.tokenFlags.cooldownSec = 15; });

  reg.addHook("afterLLM", async (ctx) => {
    const budget = ctx.tokenFlags.budgetTokens;
    if (budget && (ctx.usageTotals?.openai)) {
      const used = (ctx.usageTotals.openai.input||0) + (ctx.usageTotals.openai.output||0);
      if (used > budget) {
        ctx.planOnly = true; // Over budget → design-only mode
      }
    }
  });

  reg.addHook("afterAgent", async (ctx) => {
    if (ctx.tokenFlags.cooldownSec) {
      await new Promise(r => setTimeout(r, ctx.tokenFlags.cooldownSec * 1000));
    }
  });

  reg.addHook("beforeLLM", async (ctx) => {
    const plan = ctx.cfg?.providers?.anthropic?.plan || "free";
    if (plan === "pro") {
      ctx.preferFast = false;
    }
  });
}
