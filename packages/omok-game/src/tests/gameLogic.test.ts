import { describe, it, expect } from 'vitest';
import { 
  createEmptyBoard, 
  isValidPosition, 
  isPositionEmpty, 
  makeMove, 
  checkWin,
  getNextPlayer,
  isBoardFull
} from '../logic/gameLogic.js';
import { PlayerColor, BOARD_SIZE } from '../types/game.js';

describe('Game Logic Tests', () => {
  describe('createEmptyBoard', () => {
    it('should create a board with correct dimensions', () => {
      const board = createEmptyBoard();
      expect(board.length).toBe(BOARD_SIZE);
      expect(board[0].length).toBe(BOARD_SIZE);
      
      // Check all cells are null
      for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
          expect(board[i][j]).toBe(null);
        }
      }
    });
  });

  describe('isValidPosition', () => {
    it('should return true for valid positions', () => {
      expect(isValidPosition({ row: 0, col: 0 })).toBe(true);
      expect(isValidPosition({ row: 7, col: 7 })).toBe(true);
      expect(isValidPosition({ row: 14, col: 14 })).toBe(true);
    });

    it('should return false for invalid positions', () => {
      expect(isValidPosition({ row: -1, col: 0 })).toBe(false);
      expect(isValidPosition({ row: 0, col: -1 })).toBe(false);
      expect(isValidPosition({ row: 15, col: 0 })).toBe(false);
      expect(isValidPosition({ row: 0, col: 15 })).toBe(false);
    });
  });

  describe('isPositionEmpty', () => {
    it('should return true for empty positions', () => {
      const board = createEmptyBoard();
      expect(isPositionEmpty(board, { row: 0, col: 0 })).toBe(true);
      expect(isPositionEmpty(board, { row: 7, col: 7 })).toBe(true);
    });

    it('should return false for occupied positions', () => {
      const board = createEmptyBoard();
      board[0][0] = PlayerColor.BLACK;
      expect(isPositionEmpty(board, { row: 0, col: 0 })).toBe(false);
    });

    it('should return false for invalid positions', () => {
      const board = createEmptyBoard();
      expect(isPositionEmpty(board, { row: -1, col: 0 })).toBe(false);
      expect(isPositionEmpty(board, { row: 15, col: 0 })).toBe(false);
    });
  });

  describe('makeMove', () => {
    it('should place stone at correct position', () => {
      const board = createEmptyBoard();
      const newBoard = makeMove(board, { row: 0, col: 0 }, PlayerColor.BLACK);
      
      expect(newBoard[0][0]).toBe(PlayerColor.BLACK);
      expect(board[0][0]).toBe(null); // Original board should not be modified
    });

    it('should throw error for occupied positions', () => {
      const board = createEmptyBoard();
      board[0][0] = PlayerColor.BLACK;
      
      expect(() => makeMove(board, { row: 0, col: 0 }, PlayerColor.WHITE))
        .toThrow('Position is already occupied');
    });
  });

  describe('checkWin', () => {
    it('should detect horizontal win', () => {
      const board = createEmptyBoard();
      
      // Place 5 black stones horizontally
      for (let i = 0; i < 5; i++) {
        board[7][i] = PlayerColor.BLACK;
      }
      
      expect(checkWin(board, { row: 7, col: 2 }, PlayerColor.BLACK)).toBe(true);
      expect(checkWin(board, { row: 7, col: 0 }, PlayerColor.BLACK)).toBe(true);
      expect(checkWin(board, { row: 7, col: 4 }, PlayerColor.BLACK)).toBe(true);
    });

    it('should detect vertical win', () => {
      const board = createEmptyBoard();
      
      // Place 5 black stones vertically
      for (let i = 0; i < 5; i++) {
        board[i][7] = PlayerColor.BLACK;
      }
      
      expect(checkWin(board, { row: 2, col: 7 }, PlayerColor.BLACK)).toBe(true);
      expect(checkWin(board, { row: 0, col: 7 }, PlayerColor.BLACK)).toBe(true);
      expect(checkWin(board, { row: 4, col: 7 }, PlayerColor.BLACK)).toBe(true);
    });

    it('should detect diagonal win (top-left to bottom-right)', () => {
      const board = createEmptyBoard();
      
      // Place 5 black stones diagonally
      for (let i = 0; i < 5; i++) {
        board[i][i] = PlayerColor.BLACK;
      }
      
      expect(checkWin(board, { row: 2, col: 2 }, PlayerColor.BLACK)).toBe(true);
      expect(checkWin(board, { row: 0, col: 0 }, PlayerColor.BLACK)).toBe(true);
      expect(checkWin(board, { row: 4, col: 4 }, PlayerColor.BLACK)).toBe(true);
    });

    it('should detect diagonal win (top-right to bottom-left)', () => {
      const board = createEmptyBoard();
      
      // Place 5 black stones diagonally
      for (let i = 0; i < 5; i++) {
        board[i][4 - i] = PlayerColor.BLACK;
      }
      
      expect(checkWin(board, { row: 2, col: 2 }, PlayerColor.BLACK)).toBe(true);
      expect(checkWin(board, { row: 0, col: 4 }, PlayerColor.BLACK)).toBe(true);
      expect(checkWin(board, { row: 4, col: 0 }, PlayerColor.BLACK)).toBe(true);
    });

    it('should not detect win with only 4 stones', () => {
      const board = createEmptyBoard();
      
      // Place 4 black stones horizontally
      for (let i = 0; i < 4; i++) {
        board[7][i] = PlayerColor.BLACK;
      }
      
      expect(checkWin(board, { row: 7, col: 2 }, PlayerColor.BLACK)).toBe(false);
    });

    it('should not detect win with interrupted sequence', () => {
      const board = createEmptyBoard();
      
      // Place stones with gap
      board[7][0] = PlayerColor.BLACK;
      board[7][1] = PlayerColor.BLACK;
      board[7][2] = PlayerColor.WHITE; // Interruption
      board[7][3] = PlayerColor.BLACK;
      board[7][4] = PlayerColor.BLACK;
      board[7][5] = PlayerColor.BLACK;
      
      expect(checkWin(board, { row: 7, col: 1 }, PlayerColor.BLACK)).toBe(false);
      expect(checkWin(board, { row: 7, col: 4 }, PlayerColor.BLACK)).toBe(false);
    });

    it('should detect win with exactly 5 stones in longer sequence', () => {
      const board = createEmptyBoard();
      
      // Place 6 black stones horizontally
      for (let i = 0; i < 6; i++) {
        board[7][i] = PlayerColor.BLACK;
      }
      
      // Any of the stones should trigger win detection
      expect(checkWin(board, { row: 7, col: 0 }, PlayerColor.BLACK)).toBe(true);
      expect(checkWin(board, { row: 7, col: 2 }, PlayerColor.BLACK)).toBe(true);
      expect(checkWin(board, { row: 7, col: 5 }, PlayerColor.BLACK)).toBe(true);
    });
  });

  describe('getNextPlayer', () => {
    it('should alternate players correctly', () => {
      expect(getNextPlayer(PlayerColor.BLACK)).toBe(PlayerColor.WHITE);
      expect(getNextPlayer(PlayerColor.WHITE)).toBe(PlayerColor.BLACK);
    });
  });

  describe('isBoardFull', () => {
    it('should return false for empty board', () => {
      const board = createEmptyBoard();
      expect(isBoardFull(board)).toBe(false);
    });

    it('should return false for partially filled board', () => {
      const board = createEmptyBoard();
      board[0][0] = PlayerColor.BLACK;
      board[0][1] = PlayerColor.WHITE;
      expect(isBoardFull(board)).toBe(false);
    });

    it('should return true for completely filled board', () => {
      const board = createEmptyBoard();
      
      // Fill entire board alternating colors
      for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
          board[i][j] = (i + j) % 2 === 0 ? PlayerColor.BLACK : PlayerColor.WHITE;
        }
      }
      
      expect(isBoardFull(board)).toBe(true);
    });
  });
});