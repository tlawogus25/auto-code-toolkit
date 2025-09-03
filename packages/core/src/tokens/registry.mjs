// registry.mjs — repoRoot 기준 플러그인 로더(2025-09-03, Asia/Seoul)                             // 파일 목적/버전
import { fileURLToPath, pathToFileURL } from "node:url";                                           // 파일URL↔경로 변환 유틸
import path from "node:path";                                                                       // 경로 유틸
import fs from "node:fs";                                                                           // 파일 존재 확인

const __filename = fileURLToPath(import.meta.url);                                                  // __filename 대체
const __dirname  = path.dirname(__filename);                                                        // __dirname 대체
const REPO_PACKAGES_DIR = path.resolve(__dirname, "..", "..", "..");                                // <repo>/packages 계산
const DEFAULT_PLUGINS_DIR  = process.env.PLUGINS_DIR                                                // 환경변수 우선
  ? path.resolve(process.env.PLUGINS_DIR)                                                           // 절대경로 정규화
  : path.join(REPO_PACKAGES_DIR, "plugins");                                                        // 기본값: <repo>/packages/plugins

function toFileURLIfPath(p) {                                                                       // 경로→file:URL 보조
  return p.startsWith("file:") ? p : pathToFileURL(p).href;                                         // 이미 file:이면 그대로
}                                                                                                   // 함수 끝

function normalizeWorkspaceSpec(spec) {                                                             // 워크스페이스 별칭 정규화
  if (spec.startsWith("packages/plugins/")) return spec;                                            // 절대 별칭
  if (spec.startsWith("./packages/plugins/")) return spec.slice(2);                                 // ./ 접두 제거
  if (spec.startsWith(".packages/plugins/")) return spec.slice(1);                                  // . 접두 오타 보정
  return null;                                                                                      // 아니면 null
}                                                                                                   // 함수 끝

function resolveFromPluginsDir(rel, pluginsDir) {                                                   // plugins 루트 기준 후보 탐색
  const cands = [                                                                                   // 엔트리 후보들
    path.join(pluginsDir, rel, "src", "index.mjs"),                                                 // src/index.mjs
    path.join(pluginsDir, rel, "index.mjs"),                                                        // index.mjs
    path.join(pluginsDir, rel + ".mjs"),                                                            // 단일 .mjs
    path.join(pluginsDir, rel + ".js"),                                                             // 단일 .js
    path.join(pluginsDir, rel, "main.mjs"),                                                         // main.mjs
    path.join(pluginsDir, rel, "main.js"),                                                          // main.js
  ];                                                                                                // 배열 끝
  for (const p of cands) if (fs.existsSync(p)) return toFileURLIfPath(p);                           // 존재 시 반환
  throw new Error(`Plugin not found under ${pluginsDir}: ${rel}`);                                   // 후보 전부 실패 시 에러
}                                                                                                   // 함수 끝

async function resolvePlugin(spec, { pluginsDir = DEFAULT_PLUGINS_DIR } = {}) {                     // 스펙→URL 해석기
  if (spec.startsWith("/") || spec.startsWith("file:")) return toFileURLIfPath(spec);               // 절대/URL 우선
  const norm = normalizeWorkspaceSpec(spec);                                                        // 별칭 정규화 시도
  if (norm) {                                                                                       // 별칭이면
    const rel = norm.replace(/^packages\/plugins\//, "");                                           // 접두 제거
    return resolveFromPluginsDir(rel, pluginsDir);                                                  // plugins 루트 기준 해석
  }                                                                                                 // 별칭 처리 끝
  if (spec.startsWith("../") || spec.startsWith("./")) return new URL(spec, import.meta.url).href;  // 기타 상대경로
  return spec;                                                                                      // 나머지는 npm 패키지
}                                                                                                   // 함수 끝

export async function loadPlugins(pluginSpecs = [], repoRoot = null) {                              // 공개 API
  const pluginsDir = repoRoot ? path.join(repoRoot, "packages", "plugins") : DEFAULT_PLUGINS_DIR;   // plugins 루트 확정
  const tokens = new Map();                                                                          // 토큰 레지스트리
  const hooks = { beforeLLM: [], afterLLM: [], beforeAgent: [], afterAgent: [], beforePR: [], afterPR: [] }; // 훅 레지스트리
  const reg = {                                                                                      // 플러그인이 사용할 인터페이스
    defineToken(name, fn) { tokens.set(String(name || "").toLowerCase(), fn); },                     // 토큰 등록
    addHook(when, fn) { if (hooks[when]) hooks[when].push(fn); }                                     // 훅 등록
  };                                                                                                 // 인터페이스 끝
  for (const spec of pluginSpecs) {                                                                  // 각 플러그인 반복
    const url = await resolvePlugin(spec, { pluginsDir });                                           // 스펙 해석→URL
    const mod = await import(url);                                                                   // 동적 import
    const register = mod?.register || mod?.default?.register;                                        // register 찾기
    if (typeof register !== "function") throw new Error(`Plugin "${spec}" lacks register(reg)`);     // 방어적 체크
    await register(reg);                                                                             // 플러그인 초기화
  }                                                                                                  // for 끝
  return { tokens, hooks };                                                                          // 집계 객체 반환(오케스트레이터 호환)
}                                                                                                    // 함수 끝
