# 🏁 Omok Game - Quick Start Guide

## 🚀 Get Started in 2 Minutes

### 1. Start the WebSocket Server
```bash
# Navigate to the game directory
cd packages/omok-game

# Install dependencies (if not already done)
npm install

# Start the server
npm run dev
```

The server will start on `http://localhost:8080`

### 2. Open the Game in Your Browser

You have several options:

#### Option A: React Demo (Recommended)
```bash
# Start a simple HTTP server (in another terminal)
python3 -m http.server 3000

# Open in browser
open http://localhost:3000/demo-react.html
```

#### Option B: Simple HTML Demo
```bash
open http://localhost:3000/test-client.html
```

#### Option C: Basic Demo Page
```bash
open http://localhost:3000/demo.html
```

### 3. Play the Game!

1. **Create a room** - Enter your name and room name
2. **Share room ID** with a friend or open another browser tab
3. **Join the room** - Second player enters their name and joins
4. **Start playing** - Black player goes first
5. **Win condition** - Get 5 stones in a row (horizontal, vertical, or diagonal)

## 🎮 Game Features

- ✅ **Real-time multiplayer** - Instant updates via WebSocket
- ✅ **Beautiful UI** - Professional game board with smooth animations  
- ✅ **Room system** - Create and join multiple game rooms
- ✅ **Victory detection** - Automatic win condition checking
- ✅ **Turn management** - Enforced turn-based gameplay
- ✅ **Error handling** - Comprehensive validation and error messages
- ✅ **Responsive design** - Works on desktop and mobile

## 🛠️ Technical Stack

- **Backend**: TypeScript + WebSocket Server + Node.js
- **Frontend**: React + Zustand (state management) + Tailwind CSS
- **Game Logic**: Pure TypeScript functions with comprehensive tests
- **Real-time Communication**: WebSocket with automatic reconnection
- **Testing**: Vitest for unit tests + E2E integration tests

## 📋 Game Rules

**Omok** (오목) is a traditional Korean strategy board game:

- **Board**: 15×15 grid
- **Players**: 2 players (Black and White stones)  
- **Turn Order**: Black player goes first
- **Victory**: First player to align exactly 5 stones in any direction wins
- **No Overline**: This implementation allows more than 5 stones in a row

## 🏗️ Architecture Overview

```
src/
├── components/          # React UI components
│   ├── GameBoard.tsx   # Interactive game board
│   ├── GameStatus.tsx  # Player info and game state
│   ├── RoomManager.tsx # Room creation and joining
│   └── OmokGame.tsx    # Main game component
├── logic/              # Core game logic
│   └── gameLogic.ts    # Pure functions for game rules
├── server/             # WebSocket server
│   └── gameServer.ts   # Real-time game server
├── store/              # State management
│   └── gameStore.ts    # Zustand store for client state
├── client/             # WebSocket client
│   └── websocketClient.ts # Real-time communication
├── types/              # TypeScript definitions
│   ├── game.ts         # Game-related types
│   └── messages.ts     # WebSocket message types
└── tests/              # Test suites
    ├── gameLogic.test.ts  # Unit tests
    └── playtest.test.ts   # E2E integration tests
```

## 🧪 Running Tests

```bash
# Run all tests
npm test

# Run only unit tests (game logic)
npm test src/tests/gameLogic.test.ts

# Run type checking
npm run typecheck
```

## 🚀 Production Deployment

```bash
# Build the project
npm run build

# Start production server
node dist/server.js
```

## 🎯 Demo URLs

Once servers are running:

- **React Demo**: http://localhost:3000/demo-react.html ⭐ **Recommended**
- **Simple Client**: http://localhost:3000/test-client.html  
- **Basic Demo**: http://localhost:3000/demo.html

## 🏆 Credits

This Omok game implementation showcases:
- Modern TypeScript development practices
- Real-time multiplayer architecture
- Professional React UI/UX design
- Comprehensive testing strategies
- Clean code organization and documentation

---

**Ready to play?** Start the servers and open the React demo in your browser! 🎮

*For detailed API documentation and advanced usage, see the complete README.md*