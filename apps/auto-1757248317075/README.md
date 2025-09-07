# 오목 멀티플레이어 게임 (Omok Multiplayer Game)

실시간 온라인 멀티플레이어 오목 게임입니다. React, TypeScript, Socket.IO를 사용하여 구현되었습니다.

## 🎮 게임 특징

- **실시간 멀티플레이어**: Socket.IO를 통한 실시간 통신
- **방 시스템**: 플레이어가 방을 만들고 참여할 수 있음
- **완전한 오목 규칙**: 15x15 보드에서 5개 연속으로 놓으면 승리
- **직관적인 UI**: 깔끔하고 사용하기 쉬운 인터페이스
- **상태 관리**: Zustand를 사용한 효율적인 상태 관리

## 🚀 빠른 시작

### 전제 조건

- Node.js 18+ 
- npm 또는 yarn

### 설치

```bash
# 의존성 설치
npm install

# 개발 서버 실행 (클라이언트 + 서버)
npm run dev
```

개별 실행:
```bash
# 클라이언트만 실행
npm run dev:client

# 서버만 실행  
npm run dev:server
```

### 접속

- 클라이언트: http://localhost:3000
- 서버: http://localhost:3001

## 🎯 게임 규칙

1. **플레이어**: 2명이 필요 (흑돌, 백돌)
2. **보드**: 15x15 격자
3. **승리 조건**: 가로, 세로, 대각선 방향으로 5개의 돌을 연속으로 놓기
4. **순서**: 흑돌이 먼저 시작
5. **무승부**: 보드가 가득 찰 때까지 승부가 나지 않으면 무승부

## 🛠️ 프로젝트 구조

```
├── src/
│   ├── components/          # React 컴포넌트
│   │   ├── RoomSelection.tsx    # 방 생성/참여 화면
│   │   ├── GameBoard.tsx        # 게임 보드
│   │   └── GameStatus.tsx       # 게임 상태 표시
│   ├── server/              # 서버 코드
│   │   └── server.ts           # Socket.IO 서버
│   ├── gameLogic.ts         # 게임 로직
│   ├── gameStore.ts         # 상태 관리 (Zustand)
│   ├── types.ts             # TypeScript 타입 정의
│   ├── App.tsx              # 메인 앱 컴포넌트
│   └── main.tsx             # 앱 진입점
├── tests/
│   └── e2e.test.ts          # E2E 테스트
└── package.json
```

## 📝 스크립트

```bash
# 개발
npm run dev              # 전체 개발 서버 실행
npm run dev:client       # 클라이언트 개발 서버
npm run dev:server       # 서버 개발 서버

# 빌드
npm run build            # 전체 빌드
npm run build:client     # 클라이언트 빌드
npm run build:server     # 서버 빌드

# 테스트
npm run test            # 유닛 테스트 실행
npm run test:e2e        # E2E 테스트 실행

# 기타
npm run lint            # 린트 검사
npm run preview         # 빌드된 앱 미리보기
npm start               # 프로덕션 서버 실행
```

## 🧪 테스트

### 유닛 테스트
Vitest를 사용하여 게임 로직을 테스트합니다:

```bash
npm run test
```

### E2E 테스트
Playwright를 사용하여 전체 게임 플로우를 테스트합니다:

```bash
npm run test:e2e
```

## 🏗️ 기술 스택

### 프론트엔드
- **React 18**: UI 프레임워크
- **TypeScript**: 타입 안전성
- **Zustand**: 상태 관리
- **Socket.IO Client**: 실시간 통신
- **Vite**: 빌드 도구

### 백엔드
- **Node.js**: 런타임
- **Express**: 웹 서버
- **Socket.IO**: WebSocket 통신
- **TypeScript**: 타입 안전성

### 개발 도구
- **Vitest**: 유닛 테스트
- **Playwright**: E2E 테스트
- **ESLint**: 코드 품질 검사

## 🎮 게임 플레이 가이드

### 1. 방 생성
1. 플레이어 이름 입력
2. 방 이름 입력  
3. "방 만들기" 클릭

### 2. 방 참여
1. 플레이어 이름 입력
2. 방 ID 입력
3. "방 참여하기" 클릭

### 3. 게임 시작
1. 2명의 플레이어가 모두 입장
2. "게임 시작" 버튼 클릭
3. 흑돌부터 차례대로 돌 놓기

### 4. 게임 진행
- 빈 칸을 클릭하여 돌 놓기
- 현재 차례인 플레이어가 화면에 표시됨
- 5개 연속으로 놓으면 승리!

## 🔧 개발 가이드

### 새로운 기능 추가
1. `src/types.ts`에서 필요한 타입 정의
2. `src/gameLogic.ts`에서 게임 로직 구현
3. `src/components/`에서 UI 컴포넌트 작성
4. `src/gameStore.ts`에서 상태 관리 로직 추가
5. `src/server/server.ts`에서 서버 로직 구현

### 테스트 작성
- 유닛 테스트: `*.test.ts` 파일 생성
- E2E 테스트: `tests/` 디렉토리에 `*.test.ts` 파일 추가

## 📦 배포

### 프로덕션 빌드
```bash
npm run build
```

### 프로덕션 서버 실행
```bash
npm start
```

## 🐛 문제 해결

### 일반적인 문제들

1. **서버 연결 실패**
   - 서버가 포트 3001에서 실행 중인지 확인
   - 방화벽 설정 확인

2. **클라이언트 빌드 실패**
   - Node.js 버전 확인 (18+ 필요)
   - `node_modules` 삭제 후 재설치

3. **게임이 시작되지 않음**
   - 2명의 플레이어가 모두 방에 입장했는지 확인
   - 브라우저 콘솔에서 에러 메시지 확인

## 🤝 기여

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이센스

이 프로젝트는 MIT 라이센스 하에 배포됩니다.

