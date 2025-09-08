# Enhanced WebSocket Demo

이 프로젝트는 React에서 WebSocket 연결을 관리하기 위한 향상된 솔루션을 제공합니다.

## 주요 기능

- **동적 WebSocket URL 생성**: 환경에 따라 자동으로 WebSocket URL을 생성
- **StrictMode 호환성**: React StrictMode에서 발생하는 중복 연결 문제 해결
- **연결 상태 관리**: 실시간 연결 상태 및 에러 표시
- **자동 재연결**: 연결 끊김 시 지수 백오프를 사용한 자동 재연결
- **Ping/Pong 모니터링**: 연결 상태 확인을 위한 주기적 ping/pong
- **메시지 처리 최적화**: ROOM_LIST 및 기타 메시지 타입 최적화

## 개발 시작하기

### 환경 설정

```bash
# 의존성 설치
npm install

# 개발 서버 시작
npm run dev

# 테스트 실행
npm run test

# 빌드
npm run build
```

### WebSocket 서버 설정

WebSocket 테스트를 위해 로컬 서버가 필요합니다:

```bash
# WebSocket 서버 예제 (Node.js + ws 라이브러리)
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', function connection(ws) {
  console.log('Client connected');

  // 클라이언트에게 환영 메시지 전송
  ws.send(JSON.stringify({
    type: 'WELCOME',
    data: { message: 'Connected to WebSocket server' },
    timestamp: Date.now()
  }));

  ws.on('message', function message(data) {
    console.log('Received:', data.toString());
    
    // 에코 메시지 전송
    ws.send(JSON.stringify({
      type: 'ECHO',
      data: JSON.parse(data.toString()).data,
      timestamp: Date.now()
    }));
  });

  ws.on('close', function close() {
    console.log('Client disconnected');
  });
});
```

## 프로젝트 구조

```
src/
├── utils/
│   └── websocketUtils.ts        # WebSocket URL 유틸리티
├── services/
│   └── websocketService.ts      # 향상된 WebSocket 서비스
├── components/
│   ├── ConnectionStatus.tsx     # 연결 상태 표시 컴포넌트
│   └── MessageBadge.tsx        # 메시지 알림 컴포넌트
└── App.tsx                     # 메인 애플리케이션

tests/
├── setup.ts                    # 테스트 설정
└── websocketUtils.test.ts      # 유틸리티 테스트

docs/
└── SANDBOX_PROMOTION_GUIDE.md  # 샌드박스 승격 가이드
```

## 사용법

### 기본 WebSocket 연결

```typescript
import { enhancedWebSocketService } from './services/websocketService';

// 기본 연결
enhancedWebSocketService.connect({
  host: 'localhost',
  port: 8080,
  path: '/ws'
});

// 연결 상태 모니터링
const unsubscribe = enhancedWebSocketService.onConnectionChange((state) => {
  console.log('Connection state:', state);
});

// 메시지 수신
const unsubscribeMessage = enhancedWebSocketService.onMessage((message) => {
  console.log('Received message:', message);
});

// 메시지 전송
enhancedWebSocketService.sendMessage({
  type: 'CHAT_MESSAGE',
  data: { text: 'Hello World' },
  timestamp: Date.now()
});
```

### 환경별 설정

`websocket.config.sample.js`를 참조하여 환경별 설정을 구성할 수 있습니다:

```javascript
const config = getWebSocketConfig(process.env.NODE_ENV);
enhancedWebSocketService.connect(config);
```

## 테스트

```bash
# 단위 테스트 실행
npm run test

# 테스트 UI로 실행
npm run test:ui

# 타입 체크
npm run typecheck
```

## 배포

프로덕션 환경으로 배포하기 전에:

1. 모든 테스트가 통과하는지 확인
2. WebSocket 서버 URL을 프로덕션 환경에 맞게 설정
3. SSL/TLS가 활성화된 환경에서는 WSS 프로토콜 사용

## 샌드박스 승격

이 코드를 메인 저장소로 승격하려면 [`docs/SANDBOX_PROMOTION_GUIDE.md`](./docs/SANDBOX_PROMOTION_GUIDE.md)를 참조하세요.

## 라이선스

이 프로젝트는 MIT 라이선스 하에 있습니다.