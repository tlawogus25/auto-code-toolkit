import { execSync } from "node:child_process";

export async function runWithCursor(prompt, tools, policy) {
  const cli = tools.cursor?.cli || "cursor-agent";
  const force = tools.cursor?.force ? "--force" : "";
  const cmd = [cli,"-p",JSON.stringify(prompt),force,"--output-format","text"].join(" ");
  execSync(cmd, { stdio: "inherit" });
}
