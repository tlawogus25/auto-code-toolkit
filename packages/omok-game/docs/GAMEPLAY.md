# Omok Game Documentation

## Game Rules

Omok (오목) is a traditional Korean board game, also known as Five in a Row or Gomoku.

### Objective
Be the first player to get exactly 5 stones in a row (horizontally, vertically, or diagonally).

### Game Rules
1. Two players take turns placing stones on a 15x15 board
2. Black stones move first
3. Players must place stones on empty intersections
4. The first player to achieve 5 stones in a row wins
5. If the board fills up with no winner, the game is a draw

### Victory Conditions
A player wins by creating an unbroken line of exactly 5 stones in any of these directions:
- Horizontal (left to right)
- Vertical (top to bottom) 
- Diagonal (top-left to bottom-right)
- Diagonal (top-right to bottom-left)

## Development Setup

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Installation
```bash
npm install
```

### Development Commands

#### Start the Next.js Development Server
```bash
npm run dev
```
This starts the web application at http://localhost:3000

#### Start the WebSocket Game Server
```bash
npm run server
```
This starts the WebSocket server at ws://localhost:8080

#### Run Tests
```bash
npm test        # Run all tests
npm run test:unit   # Run unit tests only
```

#### Type Checking
```bash
npm run typecheck
```

#### Build for Production
```bash
npm run build
npm start
```

## How to Play

### Creating a Game
1. Open the web application
2. Click "Create Room"
3. Enter room name and your player name
4. Share the room ID with another player

### Joining a Game
1. Open the web application
2. Enter the room ID provided by another player
3. Enter your player name
4. Click "Join Room"

### Making Moves
1. Wait for your turn (indicated by the UI)
2. Click on any empty intersection on the board
3. Your stone will be placed automatically

### Game Flow
1. Black player moves first
2. Players alternate turns
3. Game ends when a player gets 5 in a row or board is full
4. Players can leave the room to return to the lobby

## Architecture

### Frontend (React/Next.js)
- **OmokGame**: Main game component orchestrating the UI
- **GameBoard**: Interactive board for placing stones
- **GameStatus**: Displays game state, players, and turn information
- **RoomManager**: Handle room creation and joining

### Backend (WebSocket Server)
- **GameServer**: Manages rooms, players, and game state
- **Message Handling**: Processes client messages for moves, room actions
- **Game Logic**: Validates moves and determines win conditions

### Game Logic
- **Board Management**: 15x15 grid state management
- **Win Detection**: Checks for 5 in a row in all directions
- **Move Validation**: Ensures legal moves and proper turn order

### State Management (Zustand)
- **Room State**: Current room, available rooms
- **Player State**: Player ID, name, connection status
- **Game State**: Board state, current player, move history

## File Structure

```
packages/omok-game/
├── app/                    # Next.js app router
│   ├── game/[roomId]/     # Dynamic room pages
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── src/
│   ├── components/        # React components
│   ├── logic/            # Game logic functions
│   ├── server/           # WebSocket server
│   ├── store/            # Zustand state management
│   ├── types/            # TypeScript definitions
│   └── client/           # WebSocket client
├── tests/                # Test files
└── docs/                # Documentation
```

## Testing

### Unit Tests
- Game logic validation
- Win condition detection
- Move validation
- Board state management

### Integration Tests  
- WebSocket message flow
- Room creation and joining
- Game state synchronization
- Player disconnection handling

## Deployment

### Development
1. Start the WebSocket server: `npm run server`
2. Start the Next.js dev server: `npm run dev`
3. Open http://localhost:3000

### Production
1. Build the application: `npm run build`
2. Start production server: `npm start`
3. Deploy WebSocket server separately on your infrastructure

## Troubleshooting

### Connection Issues
- Ensure WebSocket server is running on port 8080
- Check firewall settings for WebSocket connections
- Verify CORS settings for cross-origin requests

### Game Issues
- Refresh the page to reset client state
- Check browser console for error messages
- Ensure both players are connected to the same room

### Performance
- Game supports multiple concurrent rooms
- Each room maintains independent game state
- WebSocket connections are automatically managed