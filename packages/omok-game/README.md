# Omok Game

A real-time multiplayer Omok (Five-in-a-Row) game built with TypeScript, React, WebSocket, and Zustand.

## Game Rules

Omok is a traditional Korean strategy board game similar to Gomoku. The objective is to be the first player to get exactly 5 stones in a row (horizontally, vertically, or diagonally).

### Rules:
- **Board Size**: 15x15 grid
- **Players**: 2 players (Black and White stones)
- **Turn Order**: Black player goes first
- **Victory Condition**: First player to align exactly 5 stones in any direction wins
- **No Overline**: Unlike some variants, this implementation allows more than 5 stones in a row

## Features

- **Real-time Multiplayer**: WebSocket-based communication for instant gameplay
- **Room System**: Create and join game rooms
- **Responsive UI**: Clean, intuitive interface built with React
- **Game State Management**: Powered by Zustand for efficient state handling
- **Victory Detection**: Automatic win condition checking in all directions
- **Error Handling**: Comprehensive validation and error messages

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Navigate to the omok-game package:
```bash
cd packages/omok-game
```

2. Install dependencies:
```bash
npm install
```

### Running the Game

#### Development Mode

1. **Start the WebSocket Server**:
```bash
npm run dev
```
This will start the game server on port 8080 (or PORT environment variable).

2. **Build the Client** (in a separate terminal):
```bash
npm run build
```

3. **Serve the Client**: You'll need to serve the built React components using your preferred method (e.g., a local HTTP server).

#### Production Mode

1. **Build the Project**:
```bash
npm run build
```

2. **Start the Server**:
```bash
node dist/server.js
```

### Environment Variables

- `PORT`: Server port (default: 8080)

## Architecture

### Project Structure

```
src/
├── components/          # React UI components
│   ├── GameBoard.tsx   # Game board with stone placement
│   ├── GameStatus.tsx  # Game status and player information  
│   └── RoomManager.tsx # Room creation and joining
├── logic/              # Game logic
│   └── gameLogic.ts    # Core game rules and validation
├── server/             # WebSocket server
│   └── gameServer.ts   # Game server implementation
├── store/              # State management
│   └── gameStore.ts    # Zustand store for client state
├── types/              # TypeScript type definitions
│   ├── game.ts         # Game-related types
│   └── messages.ts     # WebSocket message types
└── tests/              # Test files
    ├── gameLogic.test.ts  # Unit tests for game logic
    └── playtest.test.ts   # E2E integration tests
```

### Key Components

#### GameServer (`src/server/gameServer.ts`)
- Manages WebSocket connections
- Handles room creation and player management
- Validates moves and enforces game rules
- Broadcasts game state updates

#### Game Logic (`src/logic/gameLogic.ts`)
- Core game mechanics (move validation, win detection)
- Pure functions for testability
- Support for all win directions (horizontal, vertical, diagonal)

#### State Management (`src/store/gameStore.ts`)
- Client-side state using Zustand
- Room and player management
- WebSocket integration helpers

## Testing

### Run Unit Tests
```bash
npm test
```

### Run Specific Test File
```bash
npm test gameLogic.test.ts
```

The test suite includes:
- **Unit Tests**: Game logic validation, win condition detection
- **Integration Tests**: Full game flow simulation with WebSocket communication
- **Edge Case Testing**: Invalid moves, disconnection handling

## WebSocket API

### Client → Server Messages

#### Create Room
```typescript
{
  type: 'create_room',
  roomName: string,
  playerName: string,
  timestamp: number
}
```

#### Join Room
```typescript
{
  type: 'join_room', 
  roomId: string,
  playerName: string,
  timestamp: number
}
```

#### Make Move
```typescript
{
  type: 'make_move',
  roomId: string,
  position: { row: number, col: number },
  timestamp: number
}
```

#### Leave Room
```typescript
{
  type: 'leave_room',
  roomId: string,
  timestamp: number
}
```

### Server → Client Messages

#### Game Update
```typescript
{
  type: 'game_update',
  gameState: GameState,
  room: Room,
  timestamp: number
}
```

#### Room List
```typescript
{
  type: 'room_list',
  rooms: Room[],
  timestamp: number
}
```

#### Error
```typescript
{
  type: 'error',
  message: string,
  timestamp: number
}
```

## Development

### Code Style
- TypeScript strict mode enabled
- ESLint configuration for code quality
- Functional programming approach where possible

### Adding Features

1. **Game Logic**: Add new rules in `src/logic/gameLogic.ts`
2. **UI Components**: Create React components in `src/components/`
3. **Server Features**: Extend `GameServer` class in `src/server/gameServer.ts`
4. **State Management**: Update Zustand store in `src/store/gameStore.ts`

### Testing New Features

1. Add unit tests for logic changes in `src/tests/gameLogic.test.ts`
2. Add integration tests for full features in `src/tests/playtest.test.ts`
3. Run tests: `npm test`

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Ensure server is running on the correct port
   - Check firewall settings
   - Verify WebSocket URL in client code

2. **Game State Desync**
   - Check network connectivity
   - Verify message handling in both client and server
   - Look for console errors in browser developer tools

3. **Build Errors**
   - Run `npm run typecheck` to identify TypeScript issues
   - Run `npm run lint` to check for code style issues

### Debug Mode

Enable detailed logging by setting environment variables:
```bash
DEBUG=omok:* npm run dev
```

## Contributing

1. Follow existing code structure and naming conventions
2. Add tests for new features
3. Update documentation as needed
4. Ensure TypeScript compilation passes: `npm run typecheck`
5. Ensure linting passes: `npm run lint`

## License

MIT License - feel free to use this code for learning and development purposes.