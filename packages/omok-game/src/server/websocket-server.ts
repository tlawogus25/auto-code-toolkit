import { WebSocketServer, WebSocket } from 'ws';
import { GameState, Room, Position } from '../types/game';
import { WebSocketMessage, MessageType } from '../types/websocket';
import { createInitialGameState, makeMove, isValidMove } from '../lib/game-logic';

interface Client {
  socket: WebSocket;
  userId: string;
  playerName?: string;
  currentRoom?: string;
}

class OmokGameServer {
  private wss: WebSocketServer;
  private clients: Map<string, Client> = new Map();
  private rooms: Map<string, Room> = new Map();

  constructor(port: number = 8080) {
    this.wss = new WebSocketServer({ port });
    this.init();
  }

  private init() {
    console.log('WebSocket server starting on port 8080');

    this.wss.on('connection', (ws: WebSocket) => {
      const userId = this.generateUserId();
      const client: Client = { socket: ws, userId };
      this.clients.set(userId, client);

      console.log(`Client connected: ${userId}`);

      ws.on('message', (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          this.handleMessage(client, message);
        } catch (error) {
          console.error('Error parsing message:', error);
          this.sendError(client, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        console.log(`Client disconnected: ${userId}`);
        this.handleDisconnect(client);
        this.clients.delete(userId);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${userId}:`, error);
      });

      // Send initial room list
      this.sendRoomList(client);
    });
  }

  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRoomId(): string {
    return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleMessage(client: Client, message: WebSocketMessage) {
    console.log(`Message from ${client.userId}:`, message.type);

    switch (message.type) {
      case 'create_room':
        this.handleCreateRoom(client, message.payload);
        break;
      case 'join_room':
        this.handleJoinRoom(client, message.payload);
        break;
      case 'leave_room':
        this.handleLeaveRoom(client, message.payload);
        break;
      case 'make_move':
        this.handleMakeMove(client, message.payload);
        break;
      default:
        this.sendError(client, `Unknown message type: ${message.type}`);
    }
  }

  private handleCreateRoom(client: Client, payload: any) {
    const { roomId, roomName } = payload;
    
    if (this.rooms.has(roomId)) {
      this.sendError(client, 'Room already exists');
      return;
    }

    const room: Room = {
      id: roomId,
      name: roomName,
      gameState: createInitialGameState(roomId),
      createdAt: new Date(),
    };

    this.rooms.set(roomId, room);
    this.broadcastRoomList();
    
    console.log(`Room created: ${roomId} by ${client.userId}`);
  }

  private handleJoinRoom(client: Client, payload: any) {
    const { roomId, playerName } = payload;
    const room = this.rooms.get(roomId);

    if (!room) {
      this.sendError(client, 'Room not found');
      return;
    }

    if (client.currentRoom) {
      this.handleLeaveRoom(client, { roomId: client.currentRoom });
    }

    client.playerName = playerName;
    client.currentRoom = roomId;

    // Assign player color
    if (!room.gameState.players.black) {
      room.gameState.players.black = client.userId;
    } else if (!room.gameState.players.white) {
      room.gameState.players.white = client.userId;
    } else {
      this.sendError(client, 'Room is full');
      return;
    }

    // Start game if both players joined
    if (room.gameState.players.black && room.gameState.players.white) {
      room.gameState.status = 'playing';
    }

    this.broadcastGameUpdate(roomId);
    this.broadcastRoomList();
    
    console.log(`Player ${playerName} joined room ${roomId}`);
  }

  private handleLeaveRoom(client: Client, payload: any) {
    const { roomId } = payload;
    const room = this.rooms.get(roomId);

    if (!room) {
      return;
    }

    // Remove player from room
    if (room.gameState.players.black === client.userId) {
      room.gameState.players.black = null;
    } else if (room.gameState.players.white === client.userId) {
      room.gameState.players.white = null;
    }

    client.currentRoom = undefined;

    // Reset game if no players left
    if (!room.gameState.players.black && !room.gameState.players.white) {
      room.gameState = createInitialGameState(roomId);
    } else {
      // Pause game if one player left
      room.gameState.status = 'waiting';
    }

    this.broadcastGameUpdate(roomId);
    this.broadcastRoomList();
    
    console.log(`Player left room ${roomId}`);
  }

  private handleMakeMove(client: Client, payload: any) {
    const { roomId, position } = payload as { roomId: string; position: Position };
    const room = this.rooms.get(roomId);

    if (!room) {
      this.sendError(client, 'Room not found');
      return;
    }

    if (room.gameState.status !== 'playing') {
      this.sendError(client, 'Game is not in playing state');
      return;
    }

    // Check if it's the player's turn
    const currentPlayerColor = room.gameState.currentPlayer;
    const currentPlayerId = room.gameState.players[currentPlayerColor];
    
    if (currentPlayerId !== client.userId) {
      this.sendError(client, 'Not your turn');
      return;
    }

    if (!isValidMove(room.gameState.board, position)) {
      this.sendError(client, 'Invalid move');
      return;
    }

    // Make the move
    room.gameState = makeMove(room.gameState, position);
    
    this.broadcastGameUpdate(roomId);
    
    console.log(`Move made in room ${roomId}: ${position.row},${position.col}`);
  }

  private handleDisconnect(client: Client) {
    if (client.currentRoom) {
      this.handleLeaveRoom(client, { roomId: client.currentRoom });
    }
  }

  private sendMessage(client: Client, type: MessageType, payload: any) {
    if (client.socket.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = {
        type,
        payload,
        timestamp: Date.now(),
      };
      client.socket.send(JSON.stringify(message));
    }
  }

  private sendError(client: Client, message: string) {
    this.sendMessage(client, 'error', { message });
  }

  private broadcastGameUpdate(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    this.clients.forEach((client) => {
      if (client.currentRoom === roomId) {
        this.sendMessage(client, 'game_update', { gameState: room.gameState });
      }
    });
  }

  private broadcastRoomList() {
    const roomList = Array.from(this.rooms.values()).map(room => ({
      id: room.id,
      name: room.name,
      playerCount: (room.gameState.players.black ? 1 : 0) + (room.gameState.players.white ? 1 : 0),
      status: room.gameState.status,
    }));

    this.clients.forEach((client) => {
      this.sendMessage(client, 'room_list', { rooms: roomList });
    });
  }

  private sendRoomList(client: Client) {
    const roomList = Array.from(this.rooms.values()).map(room => ({
      id: room.id,
      name: room.name,
      playerCount: (room.gameState.players.black ? 1 : 0) + (room.gameState.players.white ? 1 : 0),
      status: room.gameState.status,
    }));

    this.sendMessage(client, 'room_list', { rooms: roomList });
  }
}

// Start the server
const server = new OmokGameServer(8080);
console.log('Omok game server is running on ws://localhost:8080');