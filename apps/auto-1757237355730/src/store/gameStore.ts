import { create } from 'zustand'
import { GameState, Player, Position, Room } from '../types/game'
import { createInitialGameState, makeMove } from '../utils/gameLogic'

interface GameStore {
  // Game state
  gameState: GameState
  currentRoom: Room | null
  playerId: string | null
  playerColor: Player | null
  
  // Connection state
  isConnected: boolean
  connectionError: string | null
  
  // Room management
  availableRooms: Room[]
  
  // Actions
  setGameState: (gameState: GameState) => void
  makeLocalMove: (position: Position) => boolean
  resetGame: () => void
  setCurrentRoom: (room: Room | null) => void
  setPlayer: (playerId: string, color: Player) => void
  setConnection: (connected: boolean, error?: string) => void
  setAvailableRooms: (rooms: Room[]) => void
  leaveRoom: () => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  gameState: createInitialGameState(),
  currentRoom: null,
  playerId: null,
  playerColor: null,
  isConnected: false,
  connectionError: null,
  availableRooms: [],

  // Actions
  setGameState: (gameState: GameState) => {
    set({ gameState })
  },

  makeLocalMove: (position: Position): boolean => {
    const { gameState, playerColor } = get()
    
    if (!playerColor || gameState.currentPlayer !== playerColor || gameState.isGameOver) {
      return false
    }

    const newGameState = makeMove(gameState, position)
    if (newGameState) {
      set({ gameState: newGameState })
      return true
    }
    return false
  },

  resetGame: () => {
    set({ gameState: createInitialGameState() })
  },

  setCurrentRoom: (room: Room | null) => {
    set({ currentRoom: room })
    if (room) {
      set({ gameState: room.gameState })
    }
  },

  setPlayer: (playerId: string, color: Player) => {
    set({ playerId, playerColor: color })
  },

  setConnection: (connected: boolean, error?: string) => {
    set({ 
      isConnected: connected, 
      connectionError: error || null 
    })
  },

  setAvailableRooms: (rooms: Room[]) => {
    set({ availableRooms: rooms })
  },

  leaveRoom: () => {
    set({ 
      currentRoom: null, 
      gameState: createInitialGameState(),
      playerColor: null 
    })
  }
}))