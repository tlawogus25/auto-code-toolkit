# Auto Code Toolkit (Long-run + Self-heal + Cost + Hybrid Merge)

이 툴킷은 GitHub 이슈/댓글의 `/auto` 프롬프트로:
- LLM(OpenAI/Gemini) → 에이전트(Claude Code/Cursor) 명령 프롬프트 생성
- 에이전트가 코드 패치/생성 → 브랜치 푸시 → **PR 생성**
- **장시간 루프(long)**, **자가 치유(Self-heal)**, **비용/요율(Cost)** 제어
- **혼합 머지(Hybrid Merge)**: PR에서 **커밋 누적** + 조건 충족 시 **Auto-merge 켜기**, 머지 후 **다음 작업 자동 이슈** 생성

## 자동화 동작 과정
1. **트리거**: `/auto` + 라벨 `automation:run`
2. **오케스트레이션**: 모델/에이전트 선택 → (옵션) 장시간 반복 → 체크포인트 커밋
3. **Self-heal**: test/build/lint 실패 로그를 다음 스텝 프롬프트에 자동 삽입
4. **Cost**: `budget-tokens-*`/`cooldown-*s`로 비용/속도 제어
5. **PR 생성 + 혼합 머지**: `auto-merge-when-green`/`continue-after-merge` 토큰으로 자동화

## 필수 사전 준비
- Secrets: `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `CURSOR_API_KEY`
- 브랜치 보호: Required checks(`build`, `test`, 필요 시 `e2e`)
- 라벨: `automation:run`, (옵션) `automation:auto-merge`, `automation:continue`, …
- **중요**: PR에 “필수 체크” 상태를 만들려면 **`.github/workflows/ci.yml`가 필요**합니다. (본 리포 포함)

## 사용 예시(실전)
