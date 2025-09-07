// Part 1/1 • 개요: Claude CLI 호출(모델 선택 옵션 지원, Bash 기본 제외)                         // 파일 개요
// 의존성: node:child_process 의 execSync                                                           // 의존성 설명
// 연결 지점: orchestrator에서 runWithClaude 호출 시 사용됨                                         // 연결 정보

import { execSync } from "node:child_process";                                                      // execSync 로컬 명령 실행용

function s(v) {                                                                                     // 문자열 정규화 유틸
  return (v ?? "").toString().trim();                                                               // null/undefined 방지 + trim
}

export async function runWithClaude(prompt, tools, policy, opts = {}) {                             // Claude 에이전트 실행(옵션 포함)
  const text = s(prompt);                                                                           // 프롬프트 문자열 정규화
  if (!text) {                                                                                      // 빈 프롬프트 처리
    console.error("[claude] Empty prompt; skip running claude CLI.");                               // 경고 로그
    return;                                                                                         // 실행 스킵
  }
  const claude = tools?.claude || {};                                                               // tools.claude 섹션
  const cli = claude.cli || "claude";                                                               // CLI 바이너리(기본 'claude')
  const perm = claude.permission_mode || "acceptEdits";                                             // 권한 모드(기본 허용)
  const allowed = (claude.allowed_tools || ["Read","Edits"]).join(",");                             // 허용 도구(기본 Bash 제외)

  // 모델 소스 우선순위: opts.model > ENV(CLAUDE_CODE_MODEL) > tools.claude.model                    // 모델 우선순위 규칙
  const modelFromOpts = s(opts.model);                                                               // 옵션 전달 모델
  const modelFromEnv  = s(process.env.CLAUDE_CODE_MODEL);                                            // ENV 오버라이드
  const modelFromCfg  = s(claude.model);                                                             // config 지정 모델(있다면)
  const model = modelFromOpts || modelFromEnv || modelFromCfg || "";                                 // 최종 모델 문자열(없으면 빈값)

  const tokens = [                                                                                   // 실행 토큰 배열
    cli,                                                                                              // 바이너리
    "-p", JSON.stringify(text),                                                                       // 프롬프트 본문(JSON 인코딩)
    "--permission-mode", perm,                                                                        // 권한 모드
    "--allowedTools", `"${allowed}"`,                                                                 // 허용 도구 집합
    "--output-format", "text"                                                                         // 출력 포맷(텍스트)
  ];                                                                                                  // 토큰 배열 끝

  if (model) {                                                                                        // 모델 지정이 있으면
    tokens.push("--model", model);                                                                    // --model 플래그 추가
  }                                                                                                   // 조건 종료

  const cmd = tokens.join(" ");                                                                       // 명령 문자열 구성
  execSync(cmd, { stdio: "inherit" });                                                                // 명령 실행(출력 계승)
}                                                                                                     // 함수 끝
