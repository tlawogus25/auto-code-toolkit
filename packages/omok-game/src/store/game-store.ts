import { create } from 'zustand';
import { GameState, Position, Room, RoomListItem } from '@/types/game';
import { createInitialGameState, makeMove } from '@/lib/game-logic';

interface GameStore {
  currentRoom: Room | null;
  rooms: RoomListItem[];
  playerName: string;
  isConnected: boolean;
  socket: WebSocket | null;
  
  // Actions
  setPlayerName: (name: string) => void;
  setCurrentRoom: (room: Room | null) => void;
  setRooms: (rooms: RoomListItem[]) => void;
  setSocket: (socket: WebSocket | null) => void;
  setIsConnected: (connected: boolean) => void;
  updateGameState: (gameState: GameState) => void;
  makeGameMove: (position: Position) => void;
  createRoom: (roomName: string) => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  currentRoom: null,
  rooms: [],
  playerName: '',
  isConnected: false,
  socket: null,

  setPlayerName: (name: string) => set({ playerName: name }),
  
  setCurrentRoom: (room: Room | null) => set({ currentRoom: room }),
  
  setRooms: (rooms: RoomListItem[]) => set({ rooms }),
  
  setSocket: (socket: WebSocket | null) => set({ socket }),
  
  setIsConnected: (connected: boolean) => set({ isConnected: connected }),
  
  updateGameState: (gameState: GameState) => {
    const { currentRoom } = get();
    if (currentRoom) {
      set({
        currentRoom: {
          ...currentRoom,
          gameState,
        },
      });
    }
  },
  
  makeGameMove: (position: Position) => {
    const { socket, currentRoom } = get();
    if (socket && currentRoom) {
      const message = {
        type: 'make_move',
        payload: {
          roomId: currentRoom.id,
          position,
        },
        timestamp: Date.now(),
      };
      socket.send(JSON.stringify(message));
    }
  },
  
  createRoom: (roomName: string) => {
    const { socket } = get();
    if (socket) {
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const message = {
        type: 'create_room',
        payload: {
          roomId,
          roomName,
        },
        timestamp: Date.now(),
      };
      socket.send(JSON.stringify(message));
    }
  },
  
  joinRoom: (roomId: string) => {
    const { socket, playerName } = get();
    if (socket && playerName) {
      const message = {
        type: 'join_room',
        payload: {
          roomId,
          playerName,
        },
        timestamp: Date.now(),
      };
      socket.send(JSON.stringify(message));
    }
  },
  
  leaveRoom: () => {
    const { socket, currentRoom } = get();
    if (socket && currentRoom) {
      const message = {
        type: 'leave_room',
        payload: {
          roomId: currentRoom.id,
        },
        timestamp: Date.now(),
      };
      socket.send(JSON.stringify(message));
    }
    set({ currentRoom: null });
  },
}));