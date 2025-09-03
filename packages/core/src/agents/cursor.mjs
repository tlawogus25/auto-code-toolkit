import { execSync } from "node:child_process";

export async function runWithCursor(prompt, tools, policy) {
  const text = (prompt ?? "").toString().trim();
  if (!text) {
    console.error("[cursor-agent] Empty prompt; skip running cursor-agent.");
    return;
  }
  const cli = tools.cursor?.cli || "cursor-agent";
  const force = tools.cursor?.force ? "--force" : "";
  const cmd = [cli, "-p", JSON.stringify(text), force, "--output-format", "text"]
    .filter(Boolean)
    .join(" ");
  execSync(cmd, { stdio: "inherit" });
}
