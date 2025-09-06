import { describe, it, expect } from 'vitest';
import { createInitialGameState } from '../store/gameStore.js';
import { PlayerColor, GameStatus } from '../types/game.js';

describe('Game Store Tests', () => {
  describe('createInitialGameState', () => {
    it('should create initial game state with correct properties', () => {
      const roomId = 'test-room-123';
      const gameState = createInitialGameState(roomId);
      
      expect(gameState.roomId).toBe(roomId);
      expect(gameState.currentPlayer).toBe(PlayerColor.BLACK);
      expect(gameState.status).toBe(GameStatus.WAITING);
      expect(gameState.winner).toBe(null);
      expect(gameState.moves).toEqual([]);
      expect(gameState.board).toHaveLength(15);
      expect(gameState.board[0]).toHaveLength(15);
      expect(gameState.board[7][7]).toBe(null);
    });

    it('should create empty board with all null values', () => {
      const gameState = createInitialGameState('test');
      
      for (let i = 0; i < 15; i++) {
        for (let j = 0; j < 15; j++) {
          expect(gameState.board[i][j]).toBe(null);
        }
      }
    });

    it('should create different board instances for different room IDs', () => {
      const gameState1 = createInitialGameState('room1');
      const gameState2 = createInitialGameState('room2');
      
      expect(gameState1.roomId).toBe('room1');
      expect(gameState2.roomId).toBe('room2');
      expect(gameState1.board).not.toBe(gameState2.board);
      expect(gameState1.moves).not.toBe(gameState2.moves);
    });

    it('should have consistent board dimensions', () => {
      const gameState = createInitialGameState('test');
      
      // Check that all rows have the same length
      for (let i = 0; i < gameState.board.length; i++) {
        expect(gameState.board[i]).toHaveLength(15);
      }
    });

    it('should initialize with black player starting', () => {
      const gameState = createInitialGameState('test');
      expect(gameState.currentPlayer).toBe(PlayerColor.BLACK);
    });

    it('should initialize with waiting status', () => {
      const gameState = createInitialGameState('test');
      expect(gameState.status).toBe(GameStatus.WAITING);
    });

    it('should initialize with no winner', () => {
      const gameState = createInitialGameState('test');
      expect(gameState.winner).toBe(null);
    });

    it('should initialize with empty moves array', () => {
      const gameState = createInitialGameState('test');
      expect(gameState.moves).toHaveLength(0);
      expect(Array.isArray(gameState.moves)).toBe(true);
    });
  });

  describe('Game state structure validation', () => {
    it('should create game state with all required properties', () => {
      const gameState = createInitialGameState('test');
      
      expect(gameState).toHaveProperty('board');
      expect(gameState).toHaveProperty('currentPlayer');
      expect(gameState).toHaveProperty('status');
      expect(gameState).toHaveProperty('winner');
      expect(gameState).toHaveProperty('moves');
      expect(gameState).toHaveProperty('roomId');
    });

    it('should handle empty and special room IDs correctly', () => {
      const emptyRoomState = createInitialGameState('');
      expect(emptyRoomState.roomId).toBe('');
      
      const specialCharsState = createInitialGameState('test-room_123!@#');
      expect(specialCharsState.roomId).toBe('test-room_123!@#');
      
      const longRoomState = createInitialGameState('a'.repeat(1000));
      expect(longRoomState.roomId).toHaveLength(1000);
    });

    it('should create immutable initial state', () => {
      const gameState = createInitialGameState('test');
      
      // Attempting to modify the board should not affect other instances
      gameState.board[0][0] = PlayerColor.BLACK;
      
      const newGameState = createInitialGameState('test');
      expect(newGameState.board[0][0]).toBe(null);
    });
  });
});