/* Part 1/1 — 플러그인 로더(리포 루트 기준 경로 해석 + 엔트리 자동 탐색)                          */ // 이 파일의 목적을 설명
import fs from "node:fs";                                                                            // 파일 존재/정보 확인을 위해 fs 로드
import path from "node:path";                                                                        // 경로 결합/정규화를 위해 path 로드
import { pathToFileURL } from "node:url";                                                            // 파일 경로를 file:// URL로 바꾸기 위해 url 유틸 로드

/* 내부 헬퍼: repoRoot 기준으로 플러그인 스펙을 파일 시스템 경로로 변환                               */ // 스펙 → 절대 경로 변환기
function resolveToFsPath(repoRoot, spec) {                                                           // repoRoot와 스펙 문자열을 받음
  const base = path.resolve(repoRoot);                                                               // repoRoot를 절대 경로로 정규화
  let rel = spec;                                                                                    // 변환 작업을 위해 스펙을 로컬 변수로
  if (rel.startsWith("file:")) {                                                                     // 만약 file:// URL이면
    return new URL(rel).pathname;                                                                    // URL에서 파일 시스템 경로를 바로 반환
  }
  if (rel.startsWith("/")) {                                                                         // 절대 경로로 들어오면
    return path.normalize(rel);                                                                      // 그대로 정규화하여 반환
  }
  if (rel.startsWith("./") || rel.startsWith("../")) {                                               // ./ 또는 ../ 로 시작하면
    return path.resolve(base, rel);                                                                  // repoRoot 기준으로 상대 경로를 해석
  }
  // 여기까지 오면 bare/별칭 스펙(예: "packages/plugins/…")로 간주                                 // 점 없이 시작하는 경우 처리
  // 프로젝트 컨벤션: "packages/…"는 리포 루트 기준 상대경로로 취급                                 // repoRoot를 기준으로 해석
  return path.resolve(base, rel.replace(/^\.+/, ""));                                                // 선행 점 제거 후 repoRoot와 결합
}

/* 내부 헬퍼: 플러그인 디렉터리에서 실제 import할 엔트리 파일을 자동 탐색                             */ // 엔트리 파일 선택기
function pickEntryFile(fsPath) {                                                                     // 디렉터리 또는 파일 경로 입력
  try {                                                                                              // 파일/디렉터리 여부를 검사
    const st = fs.statSync(fsPath);                                                                  // 파일 상태를 동기 조회
    if (st.isFile()) {                                                                               // 이미 파일이면
      return fsPath;                                                                                 // 그대로 반환
    }
  } catch { /* 파일이 없으면 아래 후보 탐색으로 진행 */ }                                          // 존재하지 않으면 후보 탐색으로
  // 디렉터리로 가정하고 흔한 엔트리 후보들을 나열                                                   // 일반적인 엔트리 규칙
  const candidates = [                                                                               // 탐색할 후보 목록
    path.join(fsPath, "src", "index.mjs"),                                                           // 1) src/index.mjs
    path.join(fsPath, "index.mjs"),                                                                  // 2) index.mjs
    path.join(fsPath, "src", "index.js"),                                                            // 3) src/index.js
    path.join(fsPath, "index.js"),                                                                   // 4) index.js
    path.join(fsPath, "main.mjs"),                                                                   // 5) main.mjs (옵션)
    path.join(fsPath, "main.js"),                                                                    // 6) main.js  (옵션)
  ];                                                                                                 // 후보 나열 끝
  for (const f of candidates) {                                                                      // 각 후보 경로에 대해
    if (fs.existsSync(f)) return f;                                                                  // 존재하는 첫 번째 파일을 반환
  }                                                                                                  // 루프 끝
  const list = candidates.map(c => `- ${c}`).join("\n");                                             // 후보 목록을 문자열로 변환
  throw new Error(`Plugin entry not found under: ${fsPath}\nTried:\n${list}`);                       // 친절한 오류를 던짐
}

/* 메인: 플러그인들을 로드해 tokens/hook들을 수집                                                     */ // 외부에 제공할 API
export async function loadPlugins(pluginSpecs = [], repoRoot = process.cwd()) {                      // 스펙 배열과 리포 루트를 받음
  const tokens = new Map();                                                                          // 토큰 이름 → 핸들러 매핑
  const hooks = {                                                                                    // 훅 배열들 초기화
    beforeLLM: [], afterLLM: [],                                                                     // LLM 호출 전/후 훅
    beforeAgent: [], afterAgent: [],                                                                 // 에이전트 실행 전/후 훅
    beforePR: [], afterPR: [],                                                                       // PR 생성 전/후 훅
  };                                                                                                 // 훅 구조 정의 끝

  for (const spec of pluginSpecs) {                                                                  // 각 플러그인 스펙에 대해
    const fsPath = resolveToFsPath(repoRoot, spec);                                                  // 1) 스펙을 리포 루트 기준 경로로 변환
    const entry = pickEntryFile(fsPath);                                                             // 2) 실제 import할 엔트리 파일 결정
    const url = pathToFileURL(entry).href;                                                           // 3) 파일 경로를 file:// URL로 변환
    const mod = await import(url);                                                                   // 4) 동적 import로 모듈 로드

    const register = (typeof mod.default === "function") ? mod.default                               // 5) default 함수가 있으면 register로 사용
                   : (typeof mod.register === "function") ? mod.register                             //    아니면 register 함수 탐색
                   : null;                                                                           //    없으면 null
    if (register) {                                                                                  // 등록 함수가 있으면
      await register({ tokens, hooks });                                                             // tokens/hooks를 주입하여 등록 실행
      continue;                                                                                      // 다음 플러그인으로
    }

    // 대안: 모듈이 tokens/hooks 객체를 직접 노출하는 경우 병합                                        // 다른 플러그인 스타일 대응
    if (mod.tokens instanceof Map) {                                                                 // tokens가 Map이면
      for (const [k, v] of mod.tokens.entries()) tokens.set(k, v);                                   // 항목을 병합
    }
    if (mod.hooks && typeof mod.hooks === "object") {                                                // hooks가 객체면
      for (const k of Object.keys(hooks)) {                                                          // 우리가 아는 훅 키들에 대해
        if (Array.isArray(mod.hooks[k])) hooks[k].push(...mod.hooks[k]);                             // 배열이면 뒤에 붙임
      }                                                                                              // 훅 병합 끝
    }
  }                                                                                                  // 플러그인 for 루프 끝

  return { tokens, hooks };                                                                           // 수집된 tokens와 hooks 반환
}                                                                                                     // loadPlugins 끝
