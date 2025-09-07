import { create } from 'zustand';
import { Socket } from 'socket.io-client';
import { GameState, Room, Player, Position, GameMessage, ClientMessage } from './types';
import { createEmptyBoard } from './gameLogic';

interface GameStore extends GameState {
  socket: Socket | null;
  rooms: Room[];
  isConnected: boolean;
  error: string | null;
  
  // Actions
  setSocket: (socket: Socket) => void;
  setConnected: (connected: boolean) => void;
  setError: (error: string | null) => void;
  setRooms: (rooms: Room[]) => void;
  setGameState: (gameState: Partial<GameState>) => void;
  
  // Game actions
  createRoom: (roomName: string, playerName: string) => void;
  joinRoom: (roomId: string, playerName: string) => void;
  leaveRoom: () => void;
  makeMove: (position: Position) => void;
  startGame: () => void;
  
  // Socket message handlers
  handleMessage: (message: GameMessage) => void;
  sendMessage: (message: ClientMessage) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  board: createEmptyBoard(),
  currentPlayer: 'black',
  players: {},
  winner: null,
  gameStarted: false,
  roomId: null,
  socket: null,
  rooms: [],
  isConnected: false,
  error: null,

  // Actions
  setSocket: (socket) => set({ socket }),
  setConnected: (connected) => set({ isConnected: connected }),
  setError: (error) => set({ error }),
  setRooms: (rooms) => set({ rooms }),
  setGameState: (gameState) => set((state) => ({ ...state, ...gameState })),

  // Game actions
  createRoom: (roomName, playerName) => {
    const { sendMessage } = get();
    sendMessage({ type: 'CREATE_ROOM', roomName, playerName });
  },

  joinRoom: (roomId, playerName) => {
    const { sendMessage } = get();
    sendMessage({ type: 'JOIN_ROOM', roomId, playerName });
  },

  leaveRoom: () => {
    const { sendMessage } = get();
    sendMessage({ type: 'LEAVE_ROOM' });
    set({
      roomId: null,
      gameStarted: false,
      players: {},
      board: createEmptyBoard(),
      winner: null,
      currentPlayer: 'black',
    });
  },

  makeMove: (position) => {
    const { sendMessage } = get();
    sendMessage({ type: 'MAKE_MOVE', position });
  },

  startGame: () => {
    const { sendMessage } = get();
    sendMessage({ type: 'START_GAME' });
  },

  // Socket message handlers
  sendMessage: (message) => {
    const { socket, isConnected } = get();
    if (socket && isConnected) {
      socket.emit('message', message);
    } else {
      set({ error: 'Not connected to server' });
    }
  },

  handleMessage: (message) => {
    const state = get();
    
    switch (message.type) {
      case 'ROOM_CREATED':
      case 'ROOM_JOINED':
        set({
          roomId: message.room.id,
          players: message.room.players.reduce((acc, player) => {
            acc[player.id] = player;
            return acc;
          }, {} as Record<string, Player>),
          gameStarted: message.room.gameState.gameStarted,
          board: message.room.gameState.board,
          currentPlayer: message.room.gameState.currentPlayer,
          winner: message.room.gameState.winner,
          error: null,
        });
        break;

      case 'ROOM_LEFT':
        if (state.roomId === message.roomId) {
          const newPlayers = { ...state.players };
          delete newPlayers[message.playerId];
          set({ players: newPlayers });
        }
        break;

      case 'GAME_STARTED':
        set({
          gameStarted: true,
          board: message.room.gameState.board,
          currentPlayer: message.room.gameState.currentPlayer,
          winner: null,
          error: null,
        });
        break;

      case 'MOVE_MADE':
        set({
          board: message.board,
          currentPlayer: message.player.stone === 'black' ? 'white' : 'black',
        });
        break;

      case 'GAME_ENDED':
        set({
          winner: message.winner,
          gameStarted: false,
        });
        break;

      case 'PLAYER_DISCONNECTED':
        const updatedPlayers = { ...state.players };
        delete updatedPlayers[message.playerId];
        set({ players: updatedPlayers });
        break;

      case 'ERROR':
        set({ error: message.message });
        break;
    }
  },
}));