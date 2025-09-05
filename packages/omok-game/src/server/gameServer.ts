import WebSocket, { WebSocketServer } from 'ws';
import { 
  ClientMessage, 
  ServerMessage, 
  MessageType,
  GameUpdateMessage,
  ErrorMessage,
  RoomListMessage
} from '../types/messages.js';
import { 
  Room, 
  Player, 
  PlayerColor, 
  GameStatus, 
  Position,
  GameState
} from '../types/game.js';
import { 
  createEmptyBoard, 
  makeMove, 
  checkWin, 
  getNextPlayer, 
  isBoardFull,
  isPositionEmpty 
} from '../logic/gameLogic.js';
import { createInitialGameState } from '../store/gameStore.js';

export class GameServer {
  private wss: WebSocketServer;
  private rooms: Map<string, Room> = new Map();
  private clients: Map<WebSocket, { playerId: string; roomId?: string }> = new Map();

  constructor(port: number = 8080) {
    this.wss = new WebSocketServer({ port });
    this.setupWebSocket();
    console.log(`Omok game server started on port ${port}`);
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      const playerId = this.generatePlayerId();
      this.clients.set(ws, { playerId });

      console.log(`Player ${playerId} connected`);

      ws.on('message', (data: WebSocket.Data) => {
        try {
          const message: ClientMessage = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          this.sendError(ws, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        const clientInfo = this.clients.get(ws);
        if (clientInfo?.roomId) {
          this.handleLeaveRoom(ws, clientInfo.roomId);
        }
        this.clients.delete(ws);
        console.log(`Player ${clientInfo?.playerId} disconnected`);
      });

      this.sendRoomList(ws);
    });
  }

  private handleMessage(ws: WebSocket, message: ClientMessage): void {
    switch (message.type) {
      case MessageType.CREATE_ROOM:
        this.handleCreateRoom(ws, message.roomName, message.playerName);
        break;
      case MessageType.JOIN_ROOM:
        this.handleJoinRoom(ws, message.roomId, message.playerName);
        break;
      case MessageType.LEAVE_ROOM:
        this.handleLeaveRoom(ws, message.roomId);
        break;
      case MessageType.MAKE_MOVE:
        this.handleMakeMove(ws, message.roomId, message.position);
        break;
      default:
        this.sendError(ws, 'Unknown message type');
    }
  }

  private handleCreateRoom(ws: WebSocket, roomName: string, playerName: string): void {
    const roomId = this.generateRoomId();
    const clientInfo = this.clients.get(ws);
    
    if (!clientInfo) return;

    const player: Player = {
      id: clientInfo.playerId,
      name: playerName,
      color: PlayerColor.BLACK,
      connected: true
    };

    const room: Room = {
      id: roomId,
      name: roomName,
      players: [player],
      gameState: createInitialGameState(roomId),
      maxPlayers: 2
    };

    this.rooms.set(roomId, room);
    this.clients.set(ws, { ...clientInfo, roomId });

    this.broadcastToRoom(roomId, {
      type: MessageType.GAME_UPDATE,
      timestamp: Date.now(),
      gameState: room.gameState,
      room
    });

    this.broadcastRoomList();
  }

  private handleJoinRoom(ws: WebSocket, roomId: string, playerName: string): void {
    const room = this.rooms.get(roomId);
    const clientInfo = this.clients.get(ws);

    if (!room || !clientInfo) {
      this.sendError(ws, 'Room not found');
      return;
    }

    if (room.players.length >= room.maxPlayers) {
      this.sendError(ws, 'Room is full');
      return;
    }

    const player: Player = {
      id: clientInfo.playerId,
      name: playerName,
      color: PlayerColor.WHITE,
      connected: true
    };

    room.players.push(player);
    this.clients.set(ws, { ...clientInfo, roomId });

    if (room.players.length === 2) {
      room.gameState.status = GameStatus.IN_PROGRESS;
    }

    this.broadcastToRoom(roomId, {
      type: MessageType.GAME_UPDATE,
      timestamp: Date.now(),
      gameState: room.gameState,
      room
    });

    this.broadcastRoomList();
  }

  private handleLeaveRoom(ws: WebSocket, roomId: string): void {
    const room = this.rooms.get(roomId);
    const clientInfo = this.clients.get(ws);

    if (!room || !clientInfo) return;

    room.players = room.players.filter(p => p.id !== clientInfo.playerId);
    this.clients.set(ws, { playerId: clientInfo.playerId });

    if (room.players.length === 0) {
      this.rooms.delete(roomId);
    } else {
      room.gameState.status = GameStatus.WAITING;
      this.broadcastToRoom(roomId, {
        type: MessageType.GAME_UPDATE,
        timestamp: Date.now(),
        gameState: room.gameState,
        room
      });
    }

    this.broadcastRoomList();
  }

  private handleMakeMove(ws: WebSocket, roomId: string, position: Position): void {
    const room = this.rooms.get(roomId);
    const clientInfo = this.clients.get(ws);

    if (!room || !clientInfo) {
      this.sendError(ws, 'Room not found');
      return;
    }

    const player = room.players.find(p => p.id === clientInfo.playerId);
    if (!player) {
      this.sendError(ws, 'Player not in room');
      return;
    }

    const { gameState } = room;

    if (gameState.status !== GameStatus.IN_PROGRESS) {
      this.sendError(ws, 'Game is not in progress');
      return;
    }

    if (gameState.currentPlayer !== player.color) {
      this.sendError(ws, 'Not your turn');
      return;
    }

    if (!isPositionEmpty(gameState.board, position)) {
      this.sendError(ws, 'Position is already occupied');
      return;
    }

    try {
      gameState.board = makeMove(gameState.board, position, player.color);
      gameState.moves.push({
        position,
        player: player.color,
        timestamp: Date.now()
      });

      if (checkWin(gameState.board, position, player.color)) {
        gameState.status = GameStatus.FINISHED;
        gameState.winner = player.color;
      } else if (isBoardFull(gameState.board)) {
        gameState.status = GameStatus.FINISHED;
        gameState.winner = null; // Draw
      } else {
        gameState.currentPlayer = getNextPlayer(gameState.currentPlayer);
      }

      this.broadcastToRoom(roomId, {
        type: MessageType.GAME_UPDATE,
        timestamp: Date.now(),
        gameState,
        room
      });

    } catch (error) {
      this.sendError(ws, 'Invalid move');
    }
  }

  private broadcastToRoom(roomId: string, message: ServerMessage): void {
    this.clients.forEach((clientInfo, ws) => {
      if (clientInfo.roomId === roomId && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  private broadcastRoomList(): void {
    const rooms = Array.from(this.rooms.values());
    const message: RoomListMessage = {
      type: MessageType.ROOM_LIST,
      timestamp: Date.now(),
      rooms
    };

    this.clients.forEach((_, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  private sendError(ws: WebSocket, errorMessage: string): void {
    const message: ErrorMessage = {
      type: MessageType.ERROR,
      timestamp: Date.now(),
      message: errorMessage
    };

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendRoomList(ws: WebSocket): void {
    const rooms = Array.from(this.rooms.values());
    const message: RoomListMessage = {
      type: MessageType.ROOM_LIST,
      timestamp: Date.now(),
      rooms
    };

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private generateRoomId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private generatePlayerId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  public close(): Promise<void> {
    return new Promise((resolve) => {
      this.wss.close(() => {
        resolve();
      });
    });
  }
}