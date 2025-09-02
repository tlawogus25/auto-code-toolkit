import { execSync } from "node:child_process";

export async function runWithClaude(prompt, tools, policy) {
  const cli = tools.claude?.cli || "claude";
  const perm = tools.claude?.permission_mode || "acceptEdits";
  const allowed = (tools.claude?.allowed_tools || ["Read","Bash"]).join(",");
  const cmd = [
    cli,
    "-p", JSON.stringify(prompt),
    "--permission-mode", perm,
    "--allowedTools", `"${allowed}"`,
    "--cwd", ".",
    "--output-format", "text"
  ].join(" ");
  execSync(cmd, { stdio: "inherit" });
}
