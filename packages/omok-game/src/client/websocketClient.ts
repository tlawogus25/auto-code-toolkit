import { useGameStore } from '../store/gameStore.js';
import { 
  ClientMessage, 
  ServerMessage, 
  MessageType,
  GameUpdateMessage,
  ErrorMessage,
  RoomListMessage
} from '../types/messages.js';

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimeout: number | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(private serverUrl: string = 'ws://localhost:8080') {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl);

        this.ws.onopen = () => {
          console.log('Connected to Omok game server');
          this.reconnectAttempts = 0;
          useGameStore.getState().setConnected(true);
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: ServerMessage = JSON.parse(event.data);
            this.handleServerMessage(message);
          } catch (error) {
            console.error('Failed to parse server message:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('Disconnected from Omok game server');
          useGameStore.getState().setConnected(false);
          this.scheduleReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    useGameStore.getState().setConnected(false);
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
      this.reconnectTimeout = window.setTimeout(() => {
        this.reconnectAttempts++;
        console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect().catch(() => {
          // Reconnection failed, will try again
        });
      }, delay);
    } else {
      console.log('Max reconnection attempts reached');
    }
  }

  private handleServerMessage(message: ServerMessage): void {
    const store = useGameStore.getState();

    switch (message.type) {
      case MessageType.GAME_UPDATE:
        this.handleGameUpdate(message as GameUpdateMessage);
        break;
        
      case MessageType.ROOM_LIST:
        this.handleRoomList(message as RoomListMessage);
        break;
        
      case MessageType.ERROR:
        this.handleError(message as ErrorMessage);
        break;
        
      default:
        console.log('Unknown message type:', message);
    }
  }

  private handleGameUpdate(message: GameUpdateMessage): void {
    const store = useGameStore.getState();
    store.setCurrentRoom(message.room);
    store.updateGameState(message.gameState);
  }

  private handleRoomList(message: RoomListMessage): void {
    const store = useGameStore.getState();
    store.setRooms(message.rooms);
  }

  private handleError(message: ErrorMessage): void {
    console.error('Server error:', message.message);
    // You could also show a toast notification or update UI state here
  }

  sendMessage(message: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket not connected');
    }
  }

  createRoom(roomName: string, playerName: string): void {
    this.sendMessage({
      type: MessageType.CREATE_ROOM,
      roomName,
      playerName,
      timestamp: Date.now()
    });
  }

  joinRoom(roomId: string, playerName: string): void {
    this.sendMessage({
      type: MessageType.JOIN_ROOM,
      roomId,
      playerName,
      timestamp: Date.now()
    });
  }

  leaveRoom(roomId: string): void {
    this.sendMessage({
      type: MessageType.LEAVE_ROOM,
      roomId,
      timestamp: Date.now()
    });
  }

  makeMove(roomId: string, row: number, col: number): void {
    this.sendMessage({
      type: MessageType.MAKE_MOVE,
      roomId,
      position: { row, col },
      timestamp: Date.now()
    });
  }
}

// Singleton instance for easy usage
export const gameClient = new WebSocketClient();