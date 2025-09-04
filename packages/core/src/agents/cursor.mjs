// Part 1/1 • 개요: Cursor CLI 호출 시 프롬프트에 금지 규칙을 앞에 주입
// 의존성: node:child_process 의 execSync
// 연결 지점: orchestrator에서 runWithCursor 호출 시 사용됨
import { execSync } from "node:child_process";                                    // execSync 임포트

export async function runWithCursor(prompt, tools, policy) {                      // Cursor 에이전트 실행
  const text = (prompt ?? "").toString().trim();                                  // 프롬프트 정규화
  if (!text) {                                                                    // 빈 프롬프트 방지
    console.error("[cursor-agent] Empty prompt; skip running cursor-agent.");     // 안내 로그
    return;                                                                        // 실행 스킵
  }
  const cli = tools.cursor?.cli || "cursor-agent";                                // Cursor CLI 경로
  const force = tools.cursor?.force ? "--force" : "";                              // 강제 실행 플래그(옵션)
  // ⚠ 안전 삽입: 쉘 실행 금지, 통합 패치(diff) 또는 파일별 편집 지시만 허용
  const hardGuard = [
    "=== SAFETY RULES ===",
    "- Do NOT execute shell or Bash.",
    "- Produce unified diffs or explicit file edits only.",
    "- If a path does not exist, create the directory and file as part of the patch."
  ].join("\n");                                                                    // 안전 규칙 문자열
  const guarded = [hardGuard, "", text].join("\n");                                // 안전 규칙 + 원 프롬프트 결합
  const cmd = [cli, "-p", JSON.stringify(guarded), force, "--output-format", "text"] // 최종 명령
    .filter(Boolean)                                                               // 빈 토큰 제거
    .join(" ");                                                                    // 공백 결합
  execSync(cmd, { stdio: "inherit" });                                             // 명령 실행
}
