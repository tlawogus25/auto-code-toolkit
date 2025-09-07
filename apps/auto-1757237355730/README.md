# Omok Game (오목)

A real-time multiplayer implementation of the classic Korean strategy game Omok (Five-in-a-Row) built with React, TypeScript, and WebSocket.

## Game Rules

Omok is a strategy game played on a 15×15 grid where two players take turns placing black and white stones. The objective is to be the first to get exactly five stones in a row horizontally, vertically, or diagonally.

### Basic Rules
- Black player always goes first
- Players alternate turns placing one stone at a time
- Stones are placed on line intersections of the grid
- The first player to achieve exactly 5 stones in a row wins
- The game ends when one player wins or the board is full (draw)

### Victory Conditions
A player wins by placing 5 stones in a row in any of these directions:
- Horizontal (←→)
- Vertical (↑↓)
- Diagonal ascending (↗↙)
- Diagonal descending (↖↘)

## Features

- **Real-time Multiplayer**: Play with friends using WebSocket connections
- **Room System**: Create or join game rooms
- **Responsive UI**: Works on desktop and mobile devices
- **Game State Management**: Persistent game state with Zustand
- **Victory Detection**: Automatic win condition checking
- **Move History**: Track all moves made during the game
- **Connection Status**: Visual indicators for connection health

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **State Management**: Zustand
- **Real-time Communication**: WebSocket (ws library)
- **Styling**: Styled-jsx
- **Testing**: Vitest + Playwright
- **Development**: ESLint + TypeScript compiler

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

### Running the Application

1. Start the WebSocket server:
```bash
npm run server
```

2. In a new terminal, start the development server:
```bash
npm run dev
```

3. Open your browser to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

### Running Tests

Run unit tests:
```bash
npm test
```

Run e2e tests:
```bash
npm run test:e2e
```

Run linting:
```bash
npm run lint
```

Run type checking:
```bash
npm run typecheck
```

## How to Play

1. **Enter Your Name**: Type your player name in the lobby
2. **Create or Join Room**: Either create a new room or join an existing one
3. **Wait for Opponent**: Games require exactly 2 players to start
4. **Take Turns**: Click on the board to place your stones
5. **Win the Game**: Get 5 stones in a row to win!

### Controls
- Click on empty intersections to place stones
- Use "Leave Room" to return to the lobby
- Connection status is shown in the top-right corner

## Project Structure

```
src/
├── components/          # React components
│   ├── Board.tsx       # Game board component
│   ├── GameHUD.tsx     # Game info display
│   └── RoomLobby.tsx   # Room management
├── services/           # External services
│   └── websocketService.ts  # WebSocket client
├── store/              # State management
│   └── gameStore.ts    # Zustand store
├── types/              # TypeScript definitions
│   ├── game.ts         # Game-related types
│   └── network.ts      # Network message types
├── utils/              # Utility functions
│   └── gameLogic.ts    # Game rules implementation
├── App.tsx             # Main application
└── main.tsx           # Application entry point

server/
└── index.js           # WebSocket server

tests/
├── gameLogic.test.ts  # Unit tests
└── e2e/               # End-to-end tests
```

## Network Protocol

The game uses WebSocket messages for real-time communication:

### Client → Server Messages
- `CREATE_ROOM`: Create a new game room
- `JOIN_ROOM`: Join an existing room  
- `MAKE_MOVE`: Place a stone on the board
- `LEAVE_ROOM`: Leave the current room

### Server → Client Messages
- `ROOM_CREATED`: Room successfully created
- `ROOM_JOINED`: Successfully joined a room
- `GAME_UPDATE`: Game state changed
- `PLAYER_JOINED`: Another player joined
- `PLAYER_LEFT`: A player left the room
- `GAME_OVER`: Game ended with winner
- `ERROR`: Error occurred

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## License

MIT License - feel free to use this project as a starting point for your own games!

