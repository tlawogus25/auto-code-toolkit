/* Part 1/1 — registry.mjs 플러그인 경로 리졸버 추가 (의존성: node:url, node:path, node:fs) */
/* 이 파일의 목적: "packages/plugins/..." 같은 워크스페이스 별칭을 실제 파일 경로(파일 URL)로 변환하여 import()가 동작하도록 보정한다. */
import { fileURLToPath, pathToFileURL } from "node:url";      // ESM 파일 경로 변환 유틸을 불러온다.
import path from "node:path";                                 // 경로 결합/정규화에 사용한다.
import fs from "node:fs";                                     // 파일 존재 여부 점검에 사용한다.

/* __filename/__dirname 대체(ESM 환경): 현재 모듈의 실제 파일 시스템 경로를 구한다. */
const __filename = fileURLToPath(import.meta.url);            // 현재 모듈의 파일 경로를 문자열로 얻는다.
const __dirname  = path.dirname(__filename);                  // 현재 모듈이 위치한 디렉터리 경로를 구한다.

/* 워크스페이스의 packages 디렉터리를 계산한다.
   현재 파일은 packages/core/src/tokens/registry.mjs 라고 가정하므로,
   여기서 ../../.. 를 올라가면 packages 디렉터리에 도달한다. */
const PACKAGES_DIR = path.resolve(__dirname, "..", "..", "..");  // 예: /repo/packages
const PLUGINS_DIR  = process.env.PLUGINS_DIR                    // 환경변수로 오버라이드 가능하게 한다.
  ? path.resolve(process.env.PLUGINS_DIR)                       // 지정되면 절대경로로 정규화한다.
  : path.join(PACKAGES_DIR, "plugins");                         // 기본값: /repo/packages/plugins

/* 주어진 스펙 문자열(spec)을 import() 가능한 "파일 URL" 문자열로 변환한다. */
async function resolvePlugin(spec) {                            // 비동기 함수: 필요 시 파일 검사 수행
  /* 1) 절대경로/상대경로/파일URL은 그대로 처리한다. */
  if (spec.startsWith("./") || spec.startsWith("../")) {        // 상대경로라면
    const url = new URL(spec, import.meta.url);                 // 현재 파일 기준으로 상대경로를 절대 파일 URL로 바꾼다.
    return url.href;                                            // import()가 사용할 href를 반환한다.
  }
  if (spec.startsWith("/") || spec.startsWith("file:")) {       // 절대경로나 file: URL이면
    return spec.startsWith("file:") ? spec : pathToFileURL(spec).href;  // file:면 그대로, 아니면 파일 URL로 변환한다.
  }

  /* 2) "packages/plugins/..." 같은 워크스페이스 별칭을 파일 경로로 치환한다. */
  if (spec.startsWith("packages/plugins/")) {                   // 문제의 케이스를 감지한다.
    const rel = spec.replace(/^packages\/plugins\//, "");       // 앞부분을 떼고 플러그인 상대경로만 남긴다.
    /* 후보 경로들을 나열한다(확장자/엔트리파일 다양성 대응). */
    const candidates = [
      path.join(PLUGINS_DIR, rel, "index.mjs"),                 // 1순위: index.mjs
      path.join(PLUGINS_DIR, rel, "index.js"),                  // 2순위: index.js
      path.join(PLUGINS_DIR, rel + ".mjs"),                     // 3순위: 단일 파일(.mjs)
      path.join(PLUGINS_DIR, rel + ".js"),                      // 4순위: 단일 파일(.js)
      path.join(PLUGINS_DIR, rel, "main.mjs"),                  // 5순위: main.mjs (옵션)
      path.join(PLUGINS_DIR, rel, "main.js"),                   // 6순위: main.js  (옵션)
    ];                                                          // 위 순서는 일반적인 모듈 엔트리를 포괄한다.
    for (const p of candidates) {                               // 각 후보 경로에 대해
      if (fs.existsSync(p)) {                                   // 파일이 실제로 존재한다면
        return pathToFileURL(p).href;                           // 파일 URL로 변환해 반환한다.
      }
    }
    /* 어떤 후보도 존재하지 않으면 친절한 오류 메시지로 실패한다. */
    throw new Error(
      `Plugin "${spec}" not found under workspace plugins dir.\n` +
      `Tried:\n- ${candidates.join("\n- ")}\n` +
      `Resolved PLUGINS_DIR=${PLUGINS_DIR}`
    );                                                          // 사용자가 바로 원인 파악 가능하도록 경로들을 출력한다.
  }

  /* 3) 그 외(진짜 npm 패키지명)는 그대로 반환한다. Node가 node_modules에서 해상도한다. */
  return spec;                                                  // bare specifier는 npm 패키지로 간주해 import(spec) 하도록 그대로 둔다.
}

/* 기존의 플러그인 로더(loadPlugins)를 사용 중이라면, 내부 import(spec)를 import(await resolvePlugin(spec))로 교체한다.
   아래는 drop-in 예시 구현(프로젝트에 이미 구현이 있다면 import 호출부만 교체하면 된다). */
export async function loadPlugins(pluginSpecs = []) {           // plugin 스펙 문자열 배열을 받는다.
  const mods = [];                                              // 로드된 모듈들을 담을 배열
  for (const spec of pluginSpecs) {                             // 각 스펙에 대해
    const resolved = await resolvePlugin(spec);                 // 스펙을 파일 URL 또는 원래 스펙으로 해석한다.
    const mod = await import(resolved);                         // 동적으로 모듈을 로드한다.
    mods.push(mod?.default ?? mod);                             // default export가 있으면 우선 사용하고 없으면 모듈 객체를 넣는다.
  }
  return mods;                                                  // 모든 플러그인을 로드해 반환한다.
}
