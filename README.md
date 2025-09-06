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
- **중요**: PR에 "필수 체크" 상태를 만들려면 **`.github/workflows/ci.yml`가 필요**합니다. (본 리포 포함)

---

# Omok Game Package

이 프로젝트에는 실시간 멀티플레이어 오목 게임이 포함되어 있습니다. WebSocket을 사용한 서버-클라이언트 통신과 React 기반 프론트엔드를 제공합니다.

## 🎮 게임 소개

오목(Omok)은 15x15 바둑판에서 흑돌과 백돌을 번갈아 놓으며, 가로, 세로, 대각선 중 한 방향으로 5개의 돌을 먼저 연결하는 플레이어가 승리하는 게임입니다.

### 게임 규칙
- 15x15 크기의 바둑판 사용
- 흑돌이 먼저 시작
- 가로, 세로, 대각선 중 한 방향으로 정확히 5개의 돌을 연결하면 승리
- 실시간 멀티플레이어 지원
- WebSocket을 통한 실시간 게임 상태 동기화

## 🚀 빠른 시작

### 설치

```bash
# 프로젝트 루트에서
npm install

# omok-game 패키지로 이동
cd packages/omok-game
npm install
```

### 개발 환경 실행

```bash
# 개발 서버 실행 (Next.js)
npm run dev

# 또는 게임 서버만 실행
npm run server
```

### 프로덕션 빌드

```bash
# 빌드
npm run build

# 프로덕션 서버 실행
npm start
```

## 🧪 테스트

### 모든 테스트 실행
```bash
npm test
```

### 단위 테스트만 실행
```bash
npm run test:unit
```

### E2E 테스트만 실행
```bash
npm run test:e2e
```

### 타입 체크
```bash
npm run typecheck
```

## 📁 프로젝트 구조

```
packages/omok-game/
├── src/
│   ├── client/           # WebSocket 클라이언트
│   ├── logic/            # 게임 로직
│   ├── server/           # WebSocket 서버
│   ├── store/            # 상태 관리 (Zustand)
│   ├── types/            # TypeScript 타입 정의
│   └── tests/            # 테스트 파일
│       ├── gameLogic.test.ts    # 게임 로직 단위 테스트
│       ├── gameStore.test.ts    # 상태 관리 테스트
│       └── playtest.test.ts     # E2E 테스트
├── package.json
├── vitest.config.ts
└── tsconfig.json
```

## 🛠 기술 스택

- **Frontend**: React, Next.js, TypeScript
- **Backend**: Node.js, WebSocket (ws)
- **State Management**: Zustand
- **Testing**: Vitest
- **Styling**: Tailwind CSS
- **Build**: Next.js

## 🎯 주요 기능

### 게임 로직
- 15x15 바둑판 구현
- 승리 조건 검사 (가로, 세로, 대각선)
- 돌 놓기 유효성 검사
- 게임 상태 관리

### 실시간 멀티플레이어
- WebSocket 기반 실시간 통신
- 방 생성 및 참여
- 게임 상태 동기화
- 플레이어 연결 상태 관리

### 상태 관리
- Zustand를 사용한 클라이언트 상태 관리
- 게임 상태, 플레이어 정보, 연결 상태 관리
- 불변성 보장

## 📊 테스트 커버리지

프로젝트는 포괄적인 테스트 스위트를 포함합니다:

### 단위 테스트 (gameLogic.test.ts)
- 기본 게임 로직 함수들
- 승리 조건 검사
- 경계 조건 테스트
- 성능 테스트
- 에러 처리 테스트

### 상태 관리 테스트 (gameStore.test.ts)  
- Zustand 스토어 기능
- 상태 업데이트 로직
- 게임 액션 처리

### E2E 테스트 (playtest.test.ts)
- WebSocket 연결 테스트
- 게임 플레이 시나리오
- 에러 상황 처리
- 멀티클라이언트 동기화

## 🔧 개발 가이드

### 새로운 기능 추가
1. `src/types/`에 필요한 타입 정의
2. `src/logic/`에 게임 로직 구현
3. `src/tests/`에 테스트 케이스 추가
4. 서버/클라이언트 통신이 필요한 경우 `src/server/`, `src/client/` 업데이트

### 코드 스타일
- TypeScript strict 모드 사용
- ESLint 규칙 준수
- 함수형 프로그래밍 스타일 선호
- 불변성 유지

## 📈 성능 최적화

- 게임 보드 상태는 불변 객체로 관리
- WebSocket 메시지 최적화
- 승리 조건 검사 알고리즘 최적화
- 메모리 누수 방지

## 🐛 문제 해결

### 일반적인 문제들

**WebSocket 연결 실패**
- 서버가 실행 중인지 확인
- 포트 충돌 확인 (기본값: 8080)

**테스트 실패**
- Node.js 버전 확인 (>=18 권장)
- 의존성 재설치: `npm install`

**빌드 에러**
- TypeScript 컴파일 에러 확인
- `npm run typecheck` 실행

## 📝 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 🤝 기여하기

1. 이슈 생성 또는 기존 이슈 확인
2. 브랜치 생성: `git checkout -b feature/amazing-feature`
3. 변경사항 커밋: `git commit -m 'Add amazing feature'`
4. 브랜치 푸시: `git push origin feature/amazing-feature`
5. Pull Request 생성

---

## 사용 예시(실전)
# auto-code-toolkit
