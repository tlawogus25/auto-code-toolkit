// Part 1/1 • 개요: Claude CLI 호출 옵션 정리(작업 디렉터리 옵션 제거, Bash 도구 기본 제외)
// 의존성: node:child_process 의 execSync
// 연결 지점: orchestrator에서 runWithClaude 호출 시 사용됨
import { execSync } from "node:child_process";                  // execSync 로컬 명령 실행용

export async function runWithClaude(prompt, tools, policy) {     // Claude 에이전트 실행 함수
  const text = (prompt ?? "").toString().trim();                 // 프롬프트 문자열 정규화
  if (!text) {                                                   // 빈 프롬프트 방지
    console.error("[claude] Empty prompt; skip running claude CLI."); // 안내 로그
    return;                                                      // 실행 스킵
  }
  const cli = tools.claude?.cli || "claude";                     // 사용할 claude CLI 바이너리 결정
  const perm = tools.claude?.permission_mode || "acceptEdits";   // 편집 허용 모드 기본값
  // 기본 도구 세트를 Read,Edits 위주로 제한(Bash 제외) → 쉘 실행 오남용 최소화
  const allowed = (tools.claude?.allowed_tools || ["Read","Edits"]).join(","); 
  // 실행 커맨드 구성: --cwd 제거(일부 버전 미지원) 및 출력은 텍스트 유지
  const cmd = [
    cli,                                                         // CLI 바이너리
    "-p", JSON.stringify(text),                                  // 프롬프트 본문
    "--permission-mode", perm,                                   // 권한 모드 지정
    "--allowedTools", `"${allowed}"`,                            // 허용 도구 집합
    "--output-format", "text"                                    // 출력 포맷
  ].join(" ");                                                   // 공백으로 합쳐 최종 명령 문자열 생성
  execSync(cmd, { stdio: "inherit" });                           // 명령 실행(표준 입출력 계승)
}
