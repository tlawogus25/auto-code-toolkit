import { create } from 'zustand';
import { Room, GameState, PlayerColor, GameStatus, Position } from '../types/game.js';
import { createEmptyBoard } from '../logic/gameLogic.js';

interface GameStore {
  // Room management
  rooms: Room[];
  currentRoom: Room | null;
  
  // Player state  
  playerId: string | null;
  playerName: string | null;
  
  // WebSocket connection
  isConnected: boolean;
  
  // Actions
  setRooms: (rooms: Room[]) => void;
  setCurrentRoom: (room: Room | null) => void;
  setPlayer: (id: string, name: string) => void;
  setConnected: (connected: boolean) => void;
  updateGameState: (gameState: GameState) => void;
  
  // Room actions
  createRoom: (name: string) => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;
  
  // Game actions
  makeMove: (position: Position) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  rooms: [],
  currentRoom: null,
  playerId: null,
  playerName: null,
  isConnected: false,

  setRooms: (rooms: Room[]) => set({ rooms }),
  
  setCurrentRoom: (room: Room | null) => set({ currentRoom: room }),
  
  setPlayer: (id: string, name: string) => set({ 
    playerId: id, 
    playerName: name 
  }),
  
  setConnected: (connected: boolean) => set({ isConnected: connected }),
  
  updateGameState: (gameState: GameState) => {
    const { currentRoom } = get();
    if (currentRoom) {
      const updatedRoom: Room = {
        ...currentRoom,
        gameState
      };
      set({ currentRoom: updatedRoom });
    }
  },

  createRoom: (name: string) => {
    const { playerName } = get();
    if (!playerName) return;
    
    // This will be handled by WebSocket message
    // Implementation depends on WebSocket integration
  },

  joinRoom: (roomId: string) => {
    const { playerName } = get();
    if (!playerName) return;
    
    // This will be handled by WebSocket message
    // Implementation depends on WebSocket integration  
  },

  leaveRoom: () => {
    const { currentRoom } = get();
    if (!currentRoom) return;
    
    set({ currentRoom: null });
    // This will be handled by WebSocket message
  },

  makeMove: (position: Position) => {
    const { currentRoom, playerId } = get();
    if (!currentRoom || !playerId) return;
    
    const player = currentRoom.players.find(p => p.id === playerId);
    if (!player) return;
    
    const { gameState } = currentRoom;
    if (gameState.status !== GameStatus.IN_PROGRESS) return;
    if (gameState.currentPlayer !== player.color) return;
    
    // This will be handled by WebSocket message
    // The actual move validation and board update happens on server
  }
}));

// Utility function to create initial game state
export function createInitialGameState(roomId: string): GameState {
  return {
    board: createEmptyBoard(),
    currentPlayer: PlayerColor.BLACK,
    status: GameStatus.WAITING,
    winner: null,
    moves: [],
    roomId
  };
}