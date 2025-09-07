import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { Room, Player, ClientMessage, GameMessage, Position } from '../types';
import { createEmptyBoard, isValidMove, makeMove, getGameResult, getNextPlayer } from '../gameLogic';

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));

app.use(express.json());

// In-memory storage (in production, use a database)
const rooms = new Map<string, Room>();
const playerRooms = new Map<string, string>(); // playerId -> roomId

// Generate unique IDs
function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

// Create a new room
function createRoom(name: string, playerId: string, playerName: string): Room {
  const roomId = generateId();
  const player: Player = {
    id: playerId,
    name: playerName,
    stone: 'black' // First player is always black
  };

  const room: Room = {
    id: roomId,
    name,
    players: [player],
    maxPlayers: 2,
    gameState: {
      board: createEmptyBoard(),
      currentPlayer: 'black',
      players: { [playerId]: player },
      winner: null,
      gameStarted: false,
      roomId
    }
  };

  rooms.set(roomId, room);
  playerRooms.set(playerId, roomId);
  return room;
}

// Add player to room
function addPlayerToRoom(roomId: string, playerId: string, playerName: string): Room | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  
  if (room.players.length >= room.maxPlayers) {
    return null; // Room is full
  }

  const player: Player = {
    id: playerId,
    name: playerName,
    stone: 'white' // Second player is always white
  };

  room.players.push(player);
  room.gameState.players[playerId] = player;
  playerRooms.set(playerId, roomId);
  
  return room;
}

// Remove player from room
function removePlayerFromRoom(playerId: string): string | null {
  const roomId = playerRooms.get(playerId);
  if (!roomId) return null;

  const room = rooms.get(roomId);
  if (!room) return null;

  room.players = room.players.filter(p => p.id !== playerId);
  delete room.gameState.players[playerId];
  playerRooms.delete(playerId);

  // If room is empty, delete it
  if (room.players.length === 0) {
    rooms.delete(roomId);
  } else {
    // Reset game if it was started
    room.gameState.gameStarted = false;
    room.gameState.board = createEmptyBoard();
    room.gameState.currentPlayer = 'black';
    room.gameState.winner = null;
  }

  return roomId;
}

// Start game
function startGame(roomId: string): Room | null {
  const room = rooms.get(roomId);
  if (!room || room.players.length !== 2) return null;

  room.gameState.gameStarted = true;
  room.gameState.board = createEmptyBoard();
  room.gameState.currentPlayer = 'black';
  room.gameState.winner = null;

  return room;
}

// Make a move
function handleMove(roomId: string, playerId: string, position: Position): { room: Room; gameEnded: boolean; winner: any } | null {
  const room = rooms.get(roomId);
  if (!room || !room.gameState.gameStarted) return null;

  const player = room.gameState.players[playerId];
  if (!player) return null;

  // Check if it's the player's turn
  if (player.stone !== room.gameState.currentPlayer) return null;

  // Check if move is valid
  if (!isValidMove(room.gameState.board, position)) return null;

  // Make the move
  room.gameState.board = makeMove(room.gameState.board, position, player.stone);
  
  // Check for game end
  const result = getGameResult(room.gameState.board, position);
  const gameEnded = result.winner !== null;
  
  if (gameEnded) {
    room.gameState.winner = result.winner;
    room.gameState.gameStarted = false;
  } else {
    room.gameState.currentPlayer = getNextPlayer(room.gameState.currentPlayer);
  }

  return { room, gameEnded, winner: result };
}

// Socket connection handling
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on('message', (message: ClientMessage) => {
    try {
      switch (message.type) {
        case 'CREATE_ROOM': {
          const room = createRoom(message.roomName, socket.id, message.playerName);
          socket.join(room.id);
          
          const response: GameMessage = { type: 'ROOM_CREATED', room };
          socket.emit('message', response);
          break;
        }

        case 'JOIN_ROOM': {
          const room = addPlayerToRoom(message.roomId, socket.id, message.playerName);
          if (!room) {
            const error: GameMessage = { type: 'ERROR', message: 'Room not found or full' };
            socket.emit('message', error);
            break;
          }

          socket.join(room.id);
          const response: GameMessage = { 
            type: 'ROOM_JOINED', 
            room, 
            player: room.gameState.players[socket.id] 
          };
          
          // Notify all players in the room
          io.to(room.id).emit('message', response);
          break;
        }

        case 'LEAVE_ROOM': {
          const roomId = removePlayerFromRoom(socket.id);
          if (roomId) {
            socket.leave(roomId);
            const response: GameMessage = { 
              type: 'ROOM_LEFT', 
              roomId, 
              playerId: socket.id 
            };
            io.to(roomId).emit('message', response);
          }
          break;
        }

        case 'START_GAME': {
          const roomId = playerRooms.get(socket.id);
          if (!roomId) break;

          const room = startGame(roomId);
          if (!room) {
            const error: GameMessage = { type: 'ERROR', message: 'Cannot start game - need 2 players' };
            socket.emit('message', error);
            break;
          }

          const response: GameMessage = { type: 'GAME_STARTED', room };
          io.to(roomId).emit('message', response);
          break;
        }

        case 'MAKE_MOVE': {
          const roomId = playerRooms.get(socket.id);
          if (!roomId) break;

          const result = handleMove(roomId, socket.id, message.position);
          if (!result) {
            const error: GameMessage = { type: 'ERROR', message: 'Invalid move' };
            socket.emit('message', error);
            break;
          }

          const player = result.room.gameState.players[socket.id];
          const moveResponse: GameMessage = {
            type: 'MOVE_MADE',
            position: message.position,
            player,
            board: result.room.gameState.board
          };
          io.to(roomId).emit('message', moveResponse);

          if (result.gameEnded) {
            const endResponse: GameMessage = {
              type: 'GAME_ENDED',
              winner: result.winner.winner,
              winCondition: result.winner.winCondition
            };
            io.to(roomId).emit('message', endResponse);
          }
          break;
        }
      }
    } catch (error) {
      console.error('Error handling message:', error);
      const errorResponse: GameMessage = { 
        type: 'ERROR', 
        message: 'Internal server error' 
      };
      socket.emit('message', errorResponse);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    const roomId = removePlayerFromRoom(socket.id);
    if (roomId) {
      const response: GameMessage = { 
        type: 'PLAYER_DISCONNECTED', 
        playerId: socket.id 
      };
      socket.to(roomId).emit('message', response);
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', rooms: rooms.size });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`🎮 Omok server running on port ${PORT}`);
});