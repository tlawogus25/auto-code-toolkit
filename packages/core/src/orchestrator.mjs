// Orchestrator with long-run + self-heal/cost + hybrid-merge support                // 파일 목적: 자동 코딩 오케스트레이션
import { readFileSync, writeFileSync, existsSync } from "node:fs";                  // 파일 읽기/쓰기/존재확인을 위한 node:fs 네임드 임포트
import { execSync } from "node:child_process";                                      // git/gh 명령 실행을 위한 child_process 임포트
import path from "node:path";                                                       // 경로 계산 유틸
import fs from "node:fs";                                                           // mkdirSync 등 동기 FS 유틸
import process from "node:process";                                                 // 환경변수·프로세스 정보 접근
import { loadPlugins } from "./tokens/registry.mjs";                                // 플러그인 로더(토큰/훅 주입)
import { pickLLMAndAgent } from "./router.mjs";                                     // LLM/Agent 라우팅 결정
import { makeOpenAI, runOpenAI } from "./llm/openai.mjs";                           // OpenAI 어댑터
import { makeGemini, runGemini } from "./llm/gemini.mjs";                           // Gemini 어댑터
import { runWithClaude } from "./agents/claude.mjs";                                // Claude 에이전트 실행기
import { runWithCursor } from "./agents/cursor.mjs";                                // Cursor 에이전트 실행기

function nowIso(){ return new Date().toISOString(); }                               // ISO 타임스탬프 헬퍼(로그/기록용)

export async function runOrchestrator({ repoRoot, configPath, eventPath }) {        // 메인 진입점: 리포 루트/설정/이벤트 경로 인자
  const cfg = JSON.parse(readFileSync(path.join(repoRoot, configPath), "utf8"));    // 툴킷 설정 JSON 로드
  const tools = cfg.tools || {};                                                    // 도구 설정(모델/CLI 등)
  const policy = cfg.policy || {};                                                  // 정책(허용/금지 글롭, 길이 한도 등)
  const labelsCfg = cfg.labels || {};                                               // 라벨 키 설정(run/highCost 등)
  const pluginsPaths = cfg.plugins || [];                                           // 플러그인 경로 목록
  const pipeline = cfg.pipeline || { commands: {} };                                // 파이프라인 명령(빌드/테스트 등)

  const evt = JSON.parse(readFileSync(eventPath, "utf8"));                          // GitHub 이벤트 페이로드 로드
  const isIssue = !!evt.issue && !evt.comment;                                      // 이슈인지(코멘트가 아닌지) 판별
  const rawBody = (isIssue ? (evt.issue.body || "") : (evt.comment.body || "")).trim(); // /auto 원문 추출
  const labels = (evt.issue?.labels || []).map(l => l.name || "");                  // 라벨명 배열 추출

  if (!rawBody.startsWith("/auto")) return { skipped: true };                       // /auto 아닌 이벤트는 스킵
  if (!labels.includes(labelsCfg.run || "automation:run")) return { skipped: true };// 필수 라벨 없으면 스킵

  const { tokens, hooks } = await loadPlugins(pluginsPaths, repoRoot);              // 플러그인 로드(토큰 핸들러/훅 획득)
  const after = rawBody.replace(/^\/auto\s*/i, "");                                 // /auto 접두어 제거
  const m = after.match(/^((?:[\w:-]+)\b\s*)+/i) || [""];                           // 토큰 시퀀스(키워드) 매칭
  const seq = (m[0] || "").trim().split(/\s+/).filter(Boolean);                    // 토큰을 공백 분리하여 배열화
  const rest = after.slice((m[0]||"").length).trim();                               // 나머지 본문(자유 프롬프트)

  const ctx = {                                                                     // 실행 컨텍스트(오케스트레이터 상태)
    repoRoot, cfg, tools, policy, labels, pipeline,                                 // 환경/정책/라벨/파이프라인
    tokens: seq, tokenFlags: {},                                                    // 토큰 목록/플래그
    userDemand: rest,                                                                // 사용자 요구(프롬프트)
    llm: null, model: null, agent: null,                                            // 선택된 LLM/모델/에이전트
    agentPrompt: "",                                                                 // 에이전트에 줄 최종 프롬프트
    planOnly: false, preferFast: false,                                             // 플랜 전용/빠른 모델 선호
    longMode: false, budgetMinutes: null, budgetSteps: null,                        // 장시간 모드/예산
    loopSummary: { startedAt: nowIso(), steps: [] },                                // 루프 요약(체크포인트 메타)
    usageTotals: { openai: { input:0, output:0 }, gemini: { input:0, output:0 } },  // 토큰 사용량 누적
    diagnostics: { last: null },                                                    // 최근 진단(에러 등)
    prNumber: null,                                                                  // 생성된 PR 번호
    branch: null                                                                     // 작업 브랜치명
  };

  for (const t of seq) { const h = tokens.get(t.toLowerCase()); if (h) await h(ctx); } // 토큰별 핸들러 실행(옵션/플래그 세팅)

  const highCost = labels.includes(labelsCfg.highCost || "automation:high-cost");  // 고비용 라벨 유무
  const max = policy.hard_stop_chars_without_high_cost_label ?? 20000;             // 라벨 없을 때 입력 최대 길이
  const planThreshold = policy.plan_only_threshold_chars ?? 8000;                  // 플랜 전용 임계치
  if (!(ctx.tokenFlags?.force && highCost)) {                                      // force+고비용이 아니면
    if (ctx.userDemand.length > max && !highCost)                                  // 입력 길이 제한 초과 시
      throw new Error("Input too long without high-cost label.");                  // 즉시 중단(비용 보호)
  }
  ctx.planOnly = ctx.planOnly || (ctx.userDemand.length > planThreshold && !highCost); // 길면 플랜 전용으로 강등

  const route = pickLLMAndAgent({ userDemand: ctx.userDemand, planOnly: ctx.planOnly, tools, preferFast: ctx.preferFast }); // 라우팅 결정
  ctx.llm = route.llm; ctx.model = route.model; ctx.agent = route.agent;          // 선택 결과 저장

  for (const h of hooks.beforeLLM) await h(ctx);                                   // LLM 호출 전 훅 실행

  const systemGuard = [                                                            // 에이전트 가드레일(시스템 프롬프트)
    "[에이전트 가드레일]",
    `- 허용 경로: ${(policy.allowed_globs||["src/**","app/**","docs/**"]).join(", ")}`,
    `- 금지 경로: ${(policy.forbidden_globs||[".env*","secrets/**",".git/**"]).join(", ")}`,
    "- .env* / 비밀키 / .git 은 읽기·쓰기도 금지",
    "- 테스트가 있으면 실행 전략 제안",
    "- 변경은 설명 가능한 작은 커밋 단위 권장"
  ].join("\n");                                                                     // 가드레일 문자열 병합

  const content = [                                                                 // 사용자 요구/산출물 템플릿 결합
    systemGuard, "\n[사용자 요구]", ctx.userDemand, "\n[원하는 산출물]",
    "- 변경 개요(목록)", "- 파일별 수정 계획", "- 안전 체크리스트",
    ctx.planOnly ? "- (플랜 전용: 실행명령 생략)" : "- 최종 실행할 수정 단계"
  ].join("\n");                                                                     // 최종 LLM 입력 본문

  async function genPrompt(){                
  if (ctx.llm === "openai") {                                                     // OpenAI 선택 시
    const { text, usage } = await runOpenAI({                                     // OpenAI Responses 호출
      client: makeOpenAI(process.env.OPENAI_API_KEY),                             // OpenAI 클라이언트 생성(키 필요)
      model: ctx.model, system: systemGuard, user: content,                       // 모델/시스템/유저 입력
      reasoning: { effort: ctx.planOnly ? "medium" : "high" }                     // 추론 노력도 설정
    });                                                                            // 호출 종료
    if (usage) { ctx.usageTotals.openai.input += (usage.input_tokens||0); ctx.usageTotals.openai.output += (usage.output_tokens||0); } // 사용량 누적
    return text;                                                                   // 응답 텍스트 반환
  } else {                                                                         // Gemini 우선 경로
    try {                                                                          // 예외를 잡아 대체(fallback)로 전환합니다.
      const { text } = await runGemini({                                           // Gemini 호출(재시도 포함)
        client: makeGemini(process.env.GEMINI_API_KEY),                            // Gemini 클라이언트 생성
        model: ctx.model,                                                          // 선택된 모델 사용
        user: content                                                              // 사용자 입력 전달
      });                                                                          // 호출 종료
      return text;                                                                 // 성공 시 텍스트 반환
    } catch (e) {                                                                  // 실패 시
      ctx.diagnostics.last = {                                                     // 진단 정보를 기록합니다.
        type: "llm-fallback",                                                      // 유형: LLM 대체
        from: "gemini",                                                            // 원 공급자
        to: "openai",                                                              // 대체 공급자
        message: String(e?.message || e)                                           // 에러 메시지 기록
      };                                                                           // 진단 객체 종료
      const fallbackModel = (ctx.tools?.openai?.default) || "gpt-4o-mini";         // 설정에 정의된 기본 OpenAI 모델 사용
      const { text, usage } = await runOpenAI({                                    // OpenAI로 대체 호출
        client: makeOpenAI(process.env.OPENAI_API_KEY),                            // OpenAI 클라이언트 생성
        model: fallbackModel,                                                      // 대체 모델
        system: systemGuard,                                                       // 동일한 시스템 프롬프트
        user: content,                                                             // 동일한 사용자 입력
        reasoning: { effort: ctx.planOnly ? "medium" : "high" }                    // 추론 노력도 유지
      });                                                                          // 호출 종료
      if (usage) {                                                                 // 사용량이 보고되면
        ctx.usageTotals.openai.input += (usage.input_tokens||0);                   // 입력 토큰을 누적하고
        ctx.usageTotals.openai.output += (usage.output_tokens||0);                 // 출력 토큰을 누적합니다.
      }                                                                            // 사용량 누적 종료
      return text;                                                                 // 대체 결과를 반환합니다.
    }                                                                              // catch 종료
  }                                                                                // 분기 끝
}                                                                                                                   // 함수 끝

  ctx.agentPrompt = await genPrompt();                                               // 에이전트에 줄 최종 프롬프트 생성
  for (const h of hooks.afterLLM) await h(ctx);                                      // LLM 호출 후 훅 실행

  if (ctx.tokenFlags?.dryRun) return { dryRun: true, ctx };                          // 드라이런 플래그면 여기서 종료
  if (ctx.agent === "none" || ctx.planOnly) return { planOnly: true, ctx };          // 에이전트 없음/플랜 전용이면 종료

  function checkpointCommit(msg){                                                    // 체크포인트 커밋 헬퍼
    try { execSync(`git add -A`, { stdio: "inherit" }); execSync(`git commit -m ${JSON.stringify(msg)}`, { stdio: "inherit" }); } // 변경이 있으면 커밋
    catch { console.log("No changes to commit for checkpoint."); }                   // 변경이 없으면 안내
  }                                                                                  // 함수 끝

  execSync(`git config user.name "github-actions[bot]"`, { stdio: "inherit" });      // 커밋 사용자명 설정
  execSync(`git config user.email "github-actions[bot]@users.noreply.github.com"`, { stdio: "inherit" }); // 커밋 이메일 설정
  const branch = `auto/${Date.now()}`;                                               // 작업 브랜치명(시간 기반)
  ctx.branch = branch;                                                                // 컨텍스트에 저장
  execSync(`git checkout -b ${branch}`, { stdio: "inherit" });                       // 새 브랜치 생성/체크아웃

  // ✅ 출력 디렉터리 보장(핵심 수정): AUTO_OUT_DIR 우선, 없으면 .github/auto 사용                                   // *** 핵심 변경 시작 ***
  const outDir = process.env.AUTO_OUT_DIR                                           // 환경변수 지정 시
    ? path.resolve(process.env.AUTO_OUT_DIR)                                        // 절대 경로로 정규화
    : path.join(repoRoot, ".github", "auto");                                       // 기본값: 리포/.github/auto
  fs.mkdirSync(outDir, { recursive: true });                                        // 상위까지 재귀 생성(ENOENT 방지)
  // ✅ 취소 파일 경로도 동일 outDir 아래로 통일                                                                       // CANCEL 파일 경로 일관화
  const cancelPath = path.join(outDir, "CANCEL");                                   // CANCEL 파일 경로
  const start = Date.now();                                                         // 실행 시작 시각(ms)
  // ✅ 핵심 변경 끝                                                                                                   // *** 핵심 변경 종료 ***

  async function runOneStep(step) {                                                 // 한 단계 실행(에이전트→커밋→푸시)
    for (const h of hooks.beforeAgent) await h(ctx);                                // 에이전트 전 훅
    try {                                                                            // 예외 처리 시작
      if (ctx.agent === "claude") await runWithClaude(ctx.agentPrompt, tools, policy); // Claude 에이전트 실행
      else await runWithCursor(ctx.agentPrompt, tools, policy);                     // Cursor 에이전트 실행
    } catch(e) {                                                                     // 에러 발생 시
      console.log("[Agent error]", e.message);                                      // 에러 메시지 로깅
      ctx.diagnostics.last = { type: "agent-error", message: e.message };           // 진단 정보 보관
    }                                                                                // try/catch 끝
    for (const h of hooks.afterAgent) await h(ctx);                                 // 에이전트 후 훅
    checkpointCommit(`auto: checkpoint step ${step}`);                               // 체크포인트 커밋 시도
    try { execSync(`git push origin ${branch}`, { stdio: "inherit" }); } catch {}   // 브랜치 푸시(실패 무시)
    ctx.loopSummary.steps.push({ step, at: new Date().toISOString() });             // 단계 메타 누적
  }                                                                                  // 함수 끝

  if (ctx.longMode) {                                                                // 장시간 모드 분기
    const maxMs = (ctx.budgetMinutes||60) * 60 * 1000;                               // 시간 예산(ms)
    const maxSteps = ctx.budgetSteps || 3;                                           // 단계 예산(기본 3)
    for (let step=1; step<=maxSteps; step++) {                                       // 단계 루프
      if (existsSync(cancelPath)) break;                                             // CANCEL 파일 있으면 중단
      if ((Date.now()-start) > maxMs) break;                                         // 시간 예산 초과 시 중단
      await runOneStep(step);                                                        // 단계 실행
      if (!ctx.agentPrompt || typeof ctx.agentPrompt !== "string") ctx.agentPrompt = "Continue."; // 프롬프트 보정
    }                                                                                // 루프 끝
  } else {                                                                           // 단발 모드
    await runOneStep(1);                                                             // 1단계만 실행
  }                                                                                  // 분기 끝
  for (const h of hooks.beforePR) await h(ctx);                                      // PR 생성 전 훅 실행

  const tokenList = (ctx.tokens||[]).join(", ") || "(none)";                         // 사용 토큰(키워드) 목록 문자열
  const labelList = labels.join(", ") || "(none)";                                   // 라벨 목록 문자열
  const truncatedUserDemand = ctx.userDemand.slice(0, 2000);                         // 사용자 본문 일부(2k)만 발췌
  const costLine = `OpenAI usage: in=${ctx.usageTotals.openai.input} out=${ctx.usageTotals.openai.output}`; // OpenAI 사용량 표기

  const infoMd = [                                                                    // PR 본문(요약) 마크다운
    `## Auto-run Info`,
    ``,
    `- LLM: **${ctx.llm}** (${ctx.model})`,
    `- Agent: **${ctx.agent}**`,
    `- Branch: ${ctx.branch}`,
    `- Labels: ${labelList}`,
    `- Tokens: ${tokenList}`,
    `- ${costLine}`,
    ``,
    `## Prompt (truncated)`,
    "",
    "```",
    truncatedUserDemand,
    "```",
    "",
    ctx.longMode ? `> Long-run: budget ${ctx.budgetMinutes} min / ${ctx.budgetSteps} steps.` : ""
  ].join("\n");                                                                       // 문자열 결합 완료

  const promptMd = [                                                                  // 전체 프롬프트/마지막 에이전트 입력 기록
    `# Original Prompt`,
    "",
    "```",
    ctx.userDemand,
    "```",
    "",
    "## Last Agent Prompt",
    "",
    "```",
    ctx.agentPrompt,
    "```"
  ].join("\n");                                                                       // 문자열 결합 완료

  // ✅ 디렉터리 보장 후 파일 경로를 outDir 기반으로 생성(핵심 수정 반영)                                            // *** 핵심 저장 경로 ***
  const prBodyPath = path.join(outDir, `pr-body-${Date.now()}.md`);                  // PR 본문 파일 경로
  const promptBodyPath = path.join(outDir, `prompt-${Date.now()}.md`);               // 프롬프트 파일 경로
  writeFileSync(prBodyPath, infoMd, "utf8");                                         // PR 본문 파일 쓰기
  writeFileSync(promptBodyPath, promptMd, "utf8");                                   // 프롬프트 파일 쓰기

  const title = `auto: ${ctx.branch} [${ctx.llm}/${ctx.agent}] (tokens: ${tokenList})`; // PR 제목 생성
  execSync(`gh pr create --title ${JSON.stringify(title)} --body-file ${JSON.stringify(prBodyPath)} --base main --head ${ctx.branch}`, { stdio: "inherit" }); // gh로 PR 생성

  const prNumber = execSync(`gh pr view --json number --head ${ctx.branch} --jq .number`).toString().trim(); // 생성된 PR 번호 조회
  ctx.prNumber = prNumber || null;                                                   // 컨텍스트에 저장(없으면 null)

  if (prNumber) {                                                                    // PR 번호가 있으면
    execSync(`gh pr comment ${prNumber} --body-file ${JSON.stringify(promptBodyPath)}`, { stdio: "inherit" }); // 프롬프트 전문을 코멘트로 추가
  }                                                                                  // 분기 끝

  for (const h of hooks.afterPR) await h(ctx);                                       // PR 생성 후 훅 실행

  return { success: true, branch: ctx.branch, long: ctx.longMode, usage: ctx.usageTotals, prNumber: ctx.prNumber }; // 실행 결과 요약 반환
}                                                                                    // runOrchestrator 끝