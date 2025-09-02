// Part 1/1 — robust plugin registry (ESM, backward-compatible)                                    // 파일 파트: 리포 루트 기준 + 스펙 매핑 + 자동탐색(옵션)
// Dependencies: node:path, node:url, node:fs, node:fs/promises                                      // 의존성: 경로/URL, 파일 시스템
// Connectivity: imported by orchestrator.mjs                                                         // 연결: 오케스트레이터에서 사용

import path from "node:path";                                                                         // 경로 유틸
import { fileURLToPath, pathToFileURL } from "node:url";                                              // 파일 URL 변환
import fs from "node:fs";                                                                             // 동기 FS
import fsp from "node:fs/promises";                                                                   // 비동기 FS

const __FILENAME = fileURLToPath(import.meta.url);                                                    // __filename 대체
const __DIRNAME  = path.dirname(__FILENAME);                                                          // __dirname 대체

function findRepoRoot(startDir = __DIRNAME) {                                                         // 리포 루트 탐색
  let cur = startDir;                                                                                 // 현재 디렉터리 커서
  while (true) {                                                                                      // 상향 탐색 루프
    const gitPath = path.join(cur, ".git");                                                           // .git 경로
    const pkgPath = path.join(cur, "package.json");                                                   // package.json 경로
    if (fs.existsSync(gitPath) || fs.existsSync(pkgPath)) return cur;                                 // 둘 중 하나 있으면 루트
    const parent = path.dirname(cur);                                                                 // 부모 계산
    if (parent === cur) return startDir;                                                              // 파일시스템 루트면 시작점 반환
    cur = parent;                                                                                     // 한 단계 위로
  }                                                                                                   // while 종료
}                                                                                                     // findRepoRoot 종료

function getPluginsRoots(repoRoot) {                                                                  // 플러그인 루트 후보
  const c = [ path.join(repoRoot, "packages", "plugins"), path.join(repoRoot, "plugins") ];           // 후보 두 가지
  return c.filter(p => fs.existsSync(p) && fs.statSync(p).isDirectory());                              // 실제 존재하는 디렉터리만
}                                                                                                     // getPluginsRoots 종료

async function findPluginEntries(pluginsRoot) {                                                       // 자동탐색: 엔트리 찾기
  const out = [];                                                                                     // 결과 배열
  const items = await fsp.readdir(pluginsRoot, { withFileTypes: true });                              // 디렉터리 항목
  for (const it of items) {                                                                           // 반복
    if (!it.isDirectory()) continue;                                                                  // 디렉터리만 대상
    const dir = path.join(pluginsRoot, it.name);                                                      // 플러그인 디렉터리 경로
    const cand = [ path.join(dir, "src", "index.mjs"), path.join(dir, "index.mjs") ];                 // 기본 후보
    const pkgJson = path.join(dir, "package.json");                                                   // package.json 경로
    if (fs.existsSync(pkgJson)) {                                                                     // package.json 있으면
      try {                                                                                           // 안전 파싱
        const pkg = JSON.parse(fs.readFileSync(pkgJson, "utf-8"));                                    // JSON 파싱
        if (typeof pkg.module === "string") cand.push(path.join(dir, pkg.module));                    // module 후보
        if (typeof pkg.main   === "string") cand.push(path.join(dir, pkg.main));                      // main 후보
      } catch {}                                                                                      // 실패 무시
    }                                                                                                  // pkg 처리 끝
    const found = cand.find(p => fs.existsSync(p));                                                   // 존재하는 첫 후보
    if (found) out.push(found);                                                                        // 결과에 추가
  }                                                                                                   // for 종료
  return out;                                                                                         // 엔트리 리스트 반환
}                                                                                                     // findPluginEntries 종료

function mapSpecToEntry(spec, repoRoot) {                                                             // 문자열 스펙을 경로로 매핑
  if (!spec || typeof spec !== "string") return null;                                                 // 유효성 검사
  // 절대 경로면 그대로 사용
  if (path.isAbsolute(spec)) return spec;                                                             // 절대 경로는 그대로
  // 파일 상대경로면 repoRoot 기준으로 정규화
  if (spec.startsWith("./") || spec.startsWith("../")) return path.resolve(repoRoot, spec);           // 상대경로 → 절대
  // 워크스페이스 스타일 별칭 처리
  if (spec.startsWith("packages/plugins/")) return path.join(repoRoot, spec);                         // packages/plugins → 루트 기준
  if (spec.startsWith("plugins/"))          return path.join(repoRoot, spec);                         // plugins → 루트 기준
  // 그 외(bare spec)는 npm 패키지로 간주하여 그대로 import하도록 null 반환(동적 import는 spec 그대로 사용)
  return null;                                                                                        // null은 "bare spec" 신호
}                                                                                                     // mapSpecToEntry 종료

export async function loadPlugins(pluginSpecs = [], repoRootArg = undefined) {                        // 공개 API(호환): (스펙배열, repoRoot)
  const repoRoot = repoRootArg || findRepoRoot();                                                     // repoRoot 우선순위: 인자 → 탐색
  const mods = [];                                                                                    // 로드된 모듈 누적
  if (Array.isArray(pluginSpecs) && pluginSpecs.length > 0) {                                         // 스펙이 명시된 경우
    for (const spec of pluginSpecs) {                                                                 // 각 스펙 반복
      const mapped = mapSpecToEntry(spec, repoRoot);                                                  // 매핑 시도
      if (mapped) {                                                                                   // 파일 경로로 매핑된 경우
        const href = pathToFileURL(mapped).href;                                                      // 파일 URL 변환
        const mod  = await import(href);                                                              // 동적 import
        mods.push(mod?.default ?? mod);                                                               // default 우선
      } else {                                                                                        // bare spec (npm 패키지)
        const mod  = await import(spec);                                                              // spec 그대로 import
        mods.push(mod?.default ?? mod);                                                               // default 우선
      }                                                                                               // if-else 종료
    }                                                                                                 // for 종료
    return mods;                                                                                      // 명시 스펙 로딩 완료
  }                                                                                                   // if (스펙 존재) 종료

  // 스펙이 없으면 자동탐색 전략 사용
  const roots = getPluginsRoots(repoRoot);                                                            // 플러그인 루트 후보
  if (roots.length === 0) return [];                                                                  // 후보 없으면 빈 배열
  const entries = (await Promise.all(roots.map(findPluginEntries))).flat();                           // 엔트리 탐색
  for (const entry of entries) {                                                                      // 각 엔트리
    const href = pathToFileURL(entry).href;                                                           // 파일 URL
    const mod  = await import(href);                                                                   // 동적 import
    mods.push({ name: path.basename(path.dirname(entry)), module: mod });                             // 이름 추정 포함
  }                                                                                                   // for 종료
  return mods;                                                                                        // 결과 반환
}                                                                                                     // loadPlugins 종료
