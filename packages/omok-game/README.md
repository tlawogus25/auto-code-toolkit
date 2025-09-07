# Omok Game (Five-in-a-Row)

A real-time multiplayer Omok (Five-in-a-Row) game built with Next.js, WebSocket, and TypeScript.

## Features

- Real-time multiplayer gameplay via WebSocket
- Clean, responsive UI with Tailwind CSS  
- Room creation and management
- Game state management with Zustand
- Unit and E2E testing
- TypeScript for type safety
- Win detection logic (5 in a row in any direction)

## Game Rules

1. **Objective**: Get 5 stones in a row (horizontal, vertical, or diagonal) to win
2. **Players**: Two players take turns - Black goes first
3. **Board**: 15x15 grid
4. **Winning**: First player to get exactly 5 stones in a row wins

## Project Structure

```
packages/omok-game/
├── src/
│   ├── app/                 # Next.js app directory
│   ├── components/          # React components
│   │   ├── GameBoard.tsx    # Game board with click handling
│   │   ├── GameInfo.tsx     # Game status and player info
│   │   └── RoomList.tsx     # Room creation and joining
│   ├── hooks/               # Custom React hooks
│   │   └── useWebSocket.ts  # WebSocket connection hook
│   ├── lib/                 # Game logic
│   │   └── game-logic.ts    # Core game rules and win detection
│   ├── server/              # Backend server
│   │   └── websocket-server.ts # WebSocket server implementation
│   ├── store/               # State management
│   │   └── game-store.ts    # Zustand store for game state
│   └── types/               # TypeScript type definitions
│       ├── game.ts          # Game-related types
│       └── websocket.ts     # WebSocket message types
├── tests/
│   ├── unit/                # Unit tests
│   │   └── game-logic.test.ts
│   └── e2e/                 # End-to-end tests
│       └── omok-game.spec.ts
└── public/                  # Static assets
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Navigate to the omok game directory:
```bash
cd packages/omok-game
```

2. Install dependencies:
```bash
npm install
```

### Running the Application

1. **Start the WebSocket server** (in one terminal):
```bash
npm run server
```

2. **Start the Next.js development server** (in another terminal):
```bash
npm run dev
```

3. Open your browser and go to `http://localhost:3000`

### How to Play

1. Enter your player name
2. Create a new room or join an existing room
3. Wait for another player to join
4. Take turns clicking on the board to place stones
5. First player to get 5 in a row wins!

## Development

### Available Scripts

- `npm run dev` - Start Next.js development server
- `npm run build` - Build the application for production
- `npm run start` - Start production server
- `npm run server` - Start WebSocket server
- `npm run test` - Run unit tests
- `npm run test:e2e` - Run E2E tests
- `npm run lint` - Run linting
- `npm run type-check` - Run TypeScript type checking

### Testing

Run unit tests:
```bash
npm run test
```

Run E2E tests (requires dev server and WebSocket server to be running):
```bash
npm run test:e2e
```

### Type Checking

Run TypeScript type checking:
```bash
npm run type-check
```

### Linting

Run ESLint:
```bash
npm run lint
```

## Architecture

### Frontend
- **Next.js 14** with App Router
- **React 18** for UI components
- **Tailwind CSS** for styling
- **Zustand** for state management
- **TypeScript** for type safety

### Backend
- **WebSocket** server using `ws` library
- **Real-time messaging** for game updates
- **Room management** for multiplayer sessions
- **Game state synchronization**

### Communication Protocol

WebSocket messages follow this structure:
```typescript
interface WebSocketMessage {
  type: MessageType;
  payload: any;
  timestamp: number;
  userId?: string;
}
```

Message types:
- `create_room` - Create a new game room
- `join_room` - Join an existing room
- `leave_room` - Leave current room
- `make_move` - Make a move on the board
- `game_update` - Broadcast game state updates
- `room_list` - Update available rooms list
- `error` - Error messages

## Deployment

### Production Build

1. Build the application:
```bash
npm run build
```

2. Start the production server:
```bash
npm run start
```

3. Start the WebSocket server:
```bash
npm run server
```

### Environment Configuration

For production deployment, you may need to configure:
- WebSocket server URL in the frontend
- CORS settings for the WebSocket server
- Port configurations

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run tests and type checking
6. Submit a pull request

## License

This project is part of the auto-code-toolkit monorepo.