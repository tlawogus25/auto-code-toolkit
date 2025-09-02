export function createRegistry() {
  const tokens = new Map();
  const hooks = { beforeLLM: [], afterLLM: [], beforeAgent: [], afterAgent: [], beforePR: [], afterPR: [] };
  return {
    defineToken(name, handler) { tokens.set(name, handler); },
    addHook(phase, fn) { if (hooks[phase]) hooks[phase].push(fn); },
    build() { return { tokens, hooks }; }
  };
}

export async function loadPlugins(paths, repoRoot) {
  const reg = createRegistry();
  for (const p of paths || []) {
    const full = p.startsWith(".") ? new URL(p, `file://${repoRoot.replace(/\\/g,"/")}/`).pathname : p;
    const mod = await import(full + (full.endsWith(".mjs") ? "" : "/src/index.mjs")).catch(async () => {
      try { return await import(full); } catch(e) { throw new Error("Failed to load plugin: "+p+" -> "+e.message); }
    });
    if (!mod.register) throw new Error("Plugin missing register(): " + p);
    await mod.register(reg);
  }
  return reg.build();
}
