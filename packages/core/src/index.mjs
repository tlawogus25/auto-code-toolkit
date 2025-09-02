import { runOrchestrator } from "./orchestrator.mjs";
const repoRoot = process.cwd();
const eventPath = process.env.GITHUB_EVENT_PATH;
const configPath = process.env.TOOLKIT_CONFIG_PATH || "config/toolkit.config.json";
if (!eventPath) { console.error("GITHUB_EVENT_PATH is required"); process.exit(1); }
runOrchestrator({ repoRoot, configPath, eventPath })
  .then((r) => { console.log("Done:", r); })
  .catch((e) => { console.error(e); process.exit(1); });
