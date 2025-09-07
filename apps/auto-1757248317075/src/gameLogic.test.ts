import { describe, it, expect } from 'vitest';
import {
  createEmptyBoard,
  isValidMove,
  makeMove,
  checkWinner,
  isBoardFull,
  getGameResult,
  getNextPlayer,
  BOARD_SIZE
} from './gameLogic';

describe('Game Logic', () => {
  describe('createEmptyBoard', () => {
    it('should create a board with correct dimensions', () => {
      const board = createEmptyBoard();
      expect(board).toHaveLength(BOARD_SIZE);
      expect(board[0]).toHaveLength(BOARD_SIZE);
    });

    it('should create a board with all null values', () => {
      const board = createEmptyBoard();
      for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          expect(board[row][col]).toBeNull();
        }
      }
    });
  });

  describe('isValidMove', () => {
    it('should return true for empty positions', () => {
      const board = createEmptyBoard();
      expect(isValidMove(board, { row: 7, col: 7 })).toBe(true);
    });

    it('should return false for occupied positions', () => {
      const board = createEmptyBoard();
      board[7][7] = 'black';
      expect(isValidMove(board, { row: 7, col: 7 })).toBe(false);
    });

    it('should return false for out-of-bounds positions', () => {
      const board = createEmptyBoard();
      expect(isValidMove(board, { row: -1, col: 7 })).toBe(false);
      expect(isValidMove(board, { row: 7, col: -1 })).toBe(false);
      expect(isValidMove(board, { row: BOARD_SIZE, col: 7 })).toBe(false);
      expect(isValidMove(board, { row: 7, col: BOARD_SIZE })).toBe(false);
    });
  });

  describe('makeMove', () => {
    it('should place stone on valid position', () => {
      const board = createEmptyBoard();
      const newBoard = makeMove(board, { row: 7, col: 7 }, 'black');
      expect(newBoard[7][7]).toBe('black');
    });

    it('should not modify original board', () => {
      const board = createEmptyBoard();
      const newBoard = makeMove(board, { row: 7, col: 7 }, 'black');
      expect(board[7][7]).toBeNull();
      expect(newBoard).not.toBe(board);
    });

    it('should return same board for invalid moves', () => {
      const board = createEmptyBoard();
      board[7][7] = 'white';
      const newBoard = makeMove(board, { row: 7, col: 7 }, 'black');
      expect(newBoard).toBe(board);
    });
  });

  describe('checkWinner', () => {
    it('should detect horizontal win', () => {
      const board = createEmptyBoard();
      // Place 5 black stones horizontally
      for (let i = 0; i < 5; i++) {
        board[7][7 + i] = 'black';
      }
      const result = checkWinner(board, { row: 7, col: 9 });
      expect(result?.winner).toBe('black');
      expect(result?.positions).toHaveLength(5);
    });

    it('should detect vertical win', () => {
      const board = createEmptyBoard();
      // Place 5 white stones vertically
      for (let i = 0; i < 5; i++) {
        board[7 + i][7] = 'white';
      }
      const result = checkWinner(board, { row: 9, col: 7 });
      expect(result?.winner).toBe('white');
      expect(result?.positions).toHaveLength(5);
    });

    it('should detect diagonal win (\\)', () => {
      const board = createEmptyBoard();
      // Place 5 black stones diagonally
      for (let i = 0; i < 5; i++) {
        board[7 + i][7 + i] = 'black';
      }
      const result = checkWinner(board, { row: 9, col: 9 });
      expect(result?.winner).toBe('black');
      expect(result?.positions).toHaveLength(5);
    });

    it('should detect diagonal win (/)', () => {
      const board = createEmptyBoard();
      // Place 5 white stones diagonally
      for (let i = 0; i < 5; i++) {
        board[7 + i][11 - i] = 'white';
      }
      const result = checkWinner(board, { row: 9, col: 9 });
      expect(result?.winner).toBe('white');
      expect(result?.positions).toHaveLength(5);
    });

    it('should return null for no win', () => {
      const board = createEmptyBoard();
      board[7][7] = 'black';
      const result = checkWinner(board, { row: 7, col: 7 });
      expect(result).toBeNull();
    });
  });

  describe('isBoardFull', () => {
    it('should return false for empty board', () => {
      const board = createEmptyBoard();
      expect(isBoardFull(board)).toBe(false);
    });

    it('should return true for full board', () => {
      const board = createEmptyBoard();
      for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          board[row][col] = row % 2 === 0 ? 'black' : 'white';
        }
      }
      expect(isBoardFull(board)).toBe(true);
    });
  });

  describe('getGameResult', () => {
    it('should return winner when there is a win', () => {
      const board = createEmptyBoard();
      for (let i = 0; i < 5; i++) {
        board[7][7 + i] = 'black';
      }
      const result = getGameResult(board, { row: 7, col: 9 });
      expect(result.winner).toBe('black');
      expect(result.winCondition).toBeTruthy();
    });

    it('should return draw when board is full', () => {
      const board = createEmptyBoard();
      for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          board[row][col] = 'black';
        }
      }
      const result = getGameResult(board, null);
      expect(result.winner).toBe('draw');
    });

    it('should return null when game is ongoing', () => {
      const board = createEmptyBoard();
      board[7][7] = 'black';
      const result = getGameResult(board, { row: 7, col: 7 });
      expect(result.winner).toBeNull();
    });
  });

  describe('getNextPlayer', () => {
    it('should alternate players', () => {
      expect(getNextPlayer('black')).toBe('white');
      expect(getNextPlayer('white')).toBe('black');
    });
  });
});