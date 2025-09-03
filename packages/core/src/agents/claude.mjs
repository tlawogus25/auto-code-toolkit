import { execSync } from "node:child_process";

export async function runWithClaude(prompt, tools, policy) {
  const text = (prompt ?? "").toString().trim();
  if (!text) {
    console.error("[claude] Empty prompt; skip running claude CLI.");
    return;
  }
  const cli = tools.claude?.cli || "claude";
  const perm = tools.claude?.permission_mode || "acceptEdits";
  const allowed = (tools.claude?.allowed_tools || ["Read","Bash"]).join(",");
  const cmd = [
    cli,
    "-p", JSON.stringify(text),
    "--permission-mode", perm,
    "--allowedTools", `"${allowed}"`,
    "--cwd", ".",
    "--output-format", "text"
  ].join(" ");
  execSync(cmd, { stdio: "inherit" });
}
