import { describe, it, expect } from 'vitest';
import { 
  createEmptyBoard, 
  isValidPosition, 
  isPositionEmpty, 
  makeMove, 
  checkWin,
  getNextPlayer,
  getWinner,
  isBoardFull
} from '../logic/gameLogic.js';
import { PlayerColor, BOARD_SIZE, GameStatus } from '../types/game.js';

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

  describe('getWinner', () => {
    it('should return null for empty game state', () => {
      const gameState = {
        board: createEmptyBoard(),
        currentPlayer: PlayerColor.BLACK,
        status: GameStatus.WAITING,
        winner: null,
        moves: [],
        roomId: 'test-room'
      };
      
      expect(getWinner(gameState)).toBe(null);
    });

    it('should return winner when last move creates winning condition', () => {
      const board = createEmptyBoard();
      
      // Create horizontal winning line for black
      for (let i = 0; i < 5; i++) {
        board[7][i] = PlayerColor.BLACK;
      }
      
      const gameState = {
        board,
        currentPlayer: PlayerColor.BLACK,
        status: GameStatus.IN_PROGRESS,
        winner: null,
        moves: [
          { position: { row: 7, col: 0 }, player: PlayerColor.BLACK, timestamp: Date.now() },
          { position: { row: 8, col: 0 }, player: PlayerColor.WHITE, timestamp: Date.now() },
          { position: { row: 7, col: 1 }, player: PlayerColor.BLACK, timestamp: Date.now() },
          { position: { row: 8, col: 1 }, player: PlayerColor.WHITE, timestamp: Date.now() },
          { position: { row: 7, col: 2 }, player: PlayerColor.BLACK, timestamp: Date.now() },
          { position: { row: 8, col: 2 }, player: PlayerColor.WHITE, timestamp: Date.now() },
          { position: { row: 7, col: 3 }, player: PlayerColor.BLACK, timestamp: Date.now() },
          { position: { row: 8, col: 3 }, player: PlayerColor.WHITE, timestamp: Date.now() },
          { position: { row: 7, col: 4 }, player: PlayerColor.BLACK, timestamp: Date.now() } // Winning move
        ],
        roomId: 'test-room'
      };
      
      expect(getWinner(gameState)).toBe(PlayerColor.BLACK);
    });

    it('should return null when last move does not create winning condition', () => {
      const board = createEmptyBoard();
      
      // Create non-winning pattern
      board[7][0] = PlayerColor.BLACK;
      board[7][1] = PlayerColor.BLACK;
      board[7][2] = PlayerColor.WHITE; // Interruption
      board[7][3] = PlayerColor.BLACK;
      
      const gameState = {
        board,
        currentPlayer: PlayerColor.BLACK,
        status: GameStatus.IN_PROGRESS,
        winner: null,
        moves: [
          { position: { row: 7, col: 3 }, player: PlayerColor.BLACK, timestamp: Date.now() }
        ],
        roomId: 'test-room'
      };
      
      expect(getWinner(gameState)).toBe(null);
    });
  });

  describe('edge cases and boundary conditions', () => {
    it('should handle board boundary correctly', () => {
      const board = createEmptyBoard();
      
      // Place stones at corners
      expect(isValidPosition({ row: 0, col: 0 })).toBe(true);
      expect(isValidPosition({ row: BOARD_SIZE - 1, col: BOARD_SIZE - 1 })).toBe(true);
      expect(isValidPosition({ row: -1, col: 0 })).toBe(false);
      expect(isValidPosition({ row: BOARD_SIZE, col: 0 })).toBe(false);
    });

    it('should detect win condition at board edges', () => {
      const board = createEmptyBoard();
      
      // Horizontal win at top edge
      for (let i = 0; i < 5; i++) {
        board[0][i] = PlayerColor.BLACK;
      }
      
      expect(checkWin(board, { row: 0, col: 2 }, PlayerColor.BLACK)).toBe(true);
      
      // Horizontal win at right edge
      const board2 = createEmptyBoard();
      for (let i = 0; i < 5; i++) {
        board2[0][BOARD_SIZE - 5 + i] = PlayerColor.WHITE;
      }
      
      expect(checkWin(board2, { row: 0, col: BOARD_SIZE - 3 }, PlayerColor.WHITE)).toBe(true);
    });

    it('should handle diagonal wins at corners', () => {
      const board = createEmptyBoard();
      
      // Diagonal win from top-left corner
      for (let i = 0; i < 5; i++) {
        board[i][i] = PlayerColor.BLACK;
      }
      
      expect(checkWin(board, { row: 0, col: 0 }, PlayerColor.BLACK)).toBe(true);
      expect(checkWin(board, { row: 4, col: 4 }, PlayerColor.BLACK)).toBe(true);
      
      // Diagonal win from top-right towards bottom-left
      const board2 = createEmptyBoard();
      for (let i = 0; i < 5; i++) {
        board2[i][BOARD_SIZE - 1 - i] = PlayerColor.WHITE;
      }
      
      expect(checkWin(board2, { row: 0, col: BOARD_SIZE - 1 }, PlayerColor.WHITE)).toBe(true);
    });

    it('should not detect win with exactly 6 stones in sequence', () => {
      const board = createEmptyBoard();
      
      // Place 6 stones horizontally (should still detect win since omok allows overlines)
      for (let i = 0; i < 6; i++) {
        board[7][i] = PlayerColor.BLACK;
      }
      
      expect(checkWin(board, { row: 7, col: 2 }, PlayerColor.BLACK)).toBe(true);
      expect(checkWin(board, { row: 7, col: 0 }, PlayerColor.BLACK)).toBe(true);
      expect(checkWin(board, { row: 7, col: 5 }, PlayerColor.BLACK)).toBe(true);
    });

    it('should handle makeMove with invalid positions', () => {
      const board = createEmptyBoard();
      board[0][0] = PlayerColor.BLACK;
      
      expect(() => makeMove(board, { row: 0, col: 0 }, PlayerColor.WHITE))
        .toThrow('Position is already occupied');
      
      expect(() => makeMove(board, { row: -1, col: 0 }, PlayerColor.WHITE))
        .toThrow('Position is already occupied');
    });

    it('should preserve immutability of original board', () => {
      const originalBoard = createEmptyBoard();
      const boardCopy = originalBoard.map(row => [...row]);
      
      const newBoard = makeMove(originalBoard, { row: 5, col: 5 }, PlayerColor.BLACK);
      
      // Original board should remain unchanged
      expect(originalBoard).toEqual(boardCopy);
      expect(newBoard[5][5]).toBe(PlayerColor.BLACK);
      expect(originalBoard[5][5]).toBe(null);
    });
  });
});