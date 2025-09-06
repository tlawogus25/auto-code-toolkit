import { describe, it, expect } from 'vitest';
import { 
  createEmptyBoard, 
  isValidPosition, 
  isPositionEmpty, 
  makeMove, 
  checkWin,
  getNextPlayer,
  isBoardFull,
  getWinner
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

    it('should detect horizontal win at board edges', () => {
      const board = createEmptyBoard();
      
      // Place 5 white stones at right edge
      for (let i = 10; i < 15; i++) {
        board[7][i] = PlayerColor.WHITE;
      }
      
      expect(checkWin(board, { row: 7, col: 12 }, PlayerColor.WHITE)).toBe(true);
      expect(checkWin(board, { row: 7, col: 14 }, PlayerColor.WHITE)).toBe(true);
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

    it('should detect vertical win at board edges', () => {
      const board = createEmptyBoard();
      
      // Place 5 white stones at bottom edge
      for (let i = 10; i < 15; i++) {
        board[i][7] = PlayerColor.WHITE;
      }
      
      expect(checkWin(board, { row: 12, col: 7 }, PlayerColor.WHITE)).toBe(true);
      expect(checkWin(board, { row: 14, col: 7 }, PlayerColor.WHITE)).toBe(true);
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
    it('should handle corner diagonal wins', () => {
      const board = createEmptyBoard();
      
      // Place 5 black stones diagonally from corner
      for (let i = 0; i < 5; i++) {
        board[i][i] = PlayerColor.BLACK;
      }
      
      expect(checkWin(board, { row: 0, col: 0 }, PlayerColor.BLACK)).toBe(true);
      
      // Test opposite diagonal from other corner
      const board2 = createEmptyBoard();
      for (let i = 0; i < 5; i++) {
        board2[i][14 - i] = PlayerColor.WHITE;
      }
      
      expect(checkWin(board2, { row: 2, col: 12 }, PlayerColor.WHITE)).toBe(true);
    });

    it('should not detect win for different colored stones', () => {
      const board = createEmptyBoard();
      
      // Place alternating colors horizontally
      board[7][0] = PlayerColor.BLACK;
      board[7][1] = PlayerColor.WHITE;
      board[7][2] = PlayerColor.BLACK;
      board[7][3] = PlayerColor.WHITE;
      board[7][4] = PlayerColor.BLACK;
      
      expect(checkWin(board, { row: 7, col: 0 }, PlayerColor.BLACK)).toBe(false);
      expect(checkWin(board, { row: 7, col: 1 }, PlayerColor.WHITE)).toBe(false);
    });

    it('should handle boundary cases for win detection', () => {
      const board = createEmptyBoard();
      
      // Test at board boundaries - top row
      for (let i = 0; i < 5; i++) {
        board[0][i] = PlayerColor.BLACK;
      }
      expect(checkWin(board, { row: 0, col: 2 }, PlayerColor.BLACK)).toBe(true);
      
      // Test at board boundaries - left column
      const board2 = createEmptyBoard();
      for (let i = 0; i < 5; i++) {
        board2[i][0] = PlayerColor.WHITE;
      }
      expect(checkWin(board2, { row: 2, col: 0 }, PlayerColor.WHITE)).toBe(true);
    });
  });

  describe('makeMove edge cases', () => {
    it('should throw error for invalid positions', () => {
      const board = createEmptyBoard();
      
      expect(() => makeMove(board, { row: -1, col: 0 }, PlayerColor.BLACK))
        .toThrow();
      expect(() => makeMove(board, { row: 0, col: -1 }, PlayerColor.BLACK))
        .toThrow();
      expect(() => makeMove(board, { row: 15, col: 0 }, PlayerColor.BLACK))
        .toThrow();
      expect(() => makeMove(board, { row: 0, col: 15 }, PlayerColor.BLACK))
        .toThrow();
    });

    it('should create new board instance without modifying original', () => {
      const originalBoard = createEmptyBoard();
      const originalValue = originalBoard[7][7];
      
      const newBoard = makeMove(originalBoard, { row: 7, col: 7 }, PlayerColor.BLACK);
      
      expect(originalBoard[7][7]).toBe(originalValue);
      expect(newBoard[7][7]).toBe(PlayerColor.BLACK);
      expect(newBoard).not.toBe(originalBoard);
    });
  });

  describe('isValidPosition edge cases', () => {
    it('should handle boundary positions correctly', () => {
      // Valid boundary positions
      expect(isValidPosition({ row: 0, col: 0 })).toBe(true);
      expect(isValidPosition({ row: 0, col: 14 })).toBe(true);
      expect(isValidPosition({ row: 14, col: 0 })).toBe(true);
      expect(isValidPosition({ row: 14, col: 14 })).toBe(true);
      
      // Invalid positions just outside boundaries
      expect(isValidPosition({ row: -1, col: -1 })).toBe(false);
      expect(isValidPosition({ row: 15, col: 15 })).toBe(false);
      expect(isValidPosition({ row: 0, col: 15 })).toBe(false);
      expect(isValidPosition({ row: 15, col: 0 })).toBe(false);
    });

    it('should handle large numbers correctly', () => {
      expect(isValidPosition({ row: 100, col: 7 })).toBe(false);
      expect(isValidPosition({ row: 7, col: 100 })).toBe(false);
      expect(isValidPosition({ row: -100, col: 7 })).toBe(false);
      expect(isValidPosition({ row: 7, col: -100 })).toBe(false);
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

    it('should return false for board with single empty cell', () => {
      const board = createEmptyBoard();
      
      // Fill entire board except one cell
      for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
          if (i === 7 && j === 7) continue; // Leave center empty
          board[i][j] = (i + j) % 2 === 0 ? PlayerColor.BLACK : PlayerColor.WHITE;
        }
      }
      
      expect(isBoardFull(board)).toBe(false);
    });
  });

  describe('getWinner', () => {
    it('should return null for empty game state', () => {
      const gameState = {
        board: createEmptyBoard(),
        currentPlayer: PlayerColor.BLACK,
        status: GameStatus.IN_PROGRESS,
        winner: null,
        moves: [],
        roomId: 'test-room'
      };
      
      expect(getWinner(gameState)).toBe(null);
    });

    it('should return winner when last move creates winning condition', () => {
      const board = createEmptyBoard();
      
      // Set up a winning horizontal line
      for (let i = 0; i < 5; i++) {
        board[7][i] = PlayerColor.BLACK;
      }
      
      const gameState = {
        board,
        currentPlayer: PlayerColor.WHITE,
        status: GameStatus.FINISHED,
        winner: PlayerColor.BLACK,
        moves: [
          { position: { row: 7, col: 0 }, player: PlayerColor.BLACK, timestamp: 1 },
          { position: { row: 8, col: 0 }, player: PlayerColor.WHITE, timestamp: 2 },
          { position: { row: 7, col: 1 }, player: PlayerColor.BLACK, timestamp: 3 },
          { position: { row: 8, col: 1 }, player: PlayerColor.WHITE, timestamp: 4 },
          { position: { row: 7, col: 2 }, player: PlayerColor.BLACK, timestamp: 5 },
          { position: { row: 8, col: 2 }, player: PlayerColor.WHITE, timestamp: 6 },
          { position: { row: 7, col: 3 }, player: PlayerColor.BLACK, timestamp: 7 },
          { position: { row: 8, col: 3 }, player: PlayerColor.WHITE, timestamp: 8 },
          { position: { row: 7, col: 4 }, player: PlayerColor.BLACK, timestamp: 9 }
        ],
        roomId: 'test-room'
      };
      
      expect(getWinner(gameState)).toBe(PlayerColor.BLACK);
    });

    it('should return null when last move does not create winning condition', () => {
      const board = createEmptyBoard();
      board[7][0] = PlayerColor.BLACK;
      board[7][1] = PlayerColor.BLACK;
      board[7][2] = PlayerColor.BLACK;
      board[7][3] = PlayerColor.BLACK;
      // Only 4 in a row, not winning
      
      const gameState = {
        board,
        currentPlayer: PlayerColor.WHITE,
        status: GameStatus.IN_PROGRESS,
        winner: null,
        moves: [
          { position: { row: 7, col: 0 }, player: PlayerColor.BLACK, timestamp: 1 },
          { position: { row: 8, col: 0 }, player: PlayerColor.WHITE, timestamp: 2 },
          { position: { row: 7, col: 1 }, player: PlayerColor.BLACK, timestamp: 3 },
          { position: { row: 8, col: 1 }, player: PlayerColor.WHITE, timestamp: 4 },
          { position: { row: 7, col: 2 }, player: PlayerColor.BLACK, timestamp: 5 },
          { position: { row: 8, col: 2 }, player: PlayerColor.WHITE, timestamp: 6 },
          { position: { row: 7, col: 3 }, player: PlayerColor.BLACK, timestamp: 7 }
        ],
        roomId: 'test-room'
      };
      
      expect(getWinner(gameState)).toBe(null);
    });

    it('should handle game state with board mismatch correctly', () => {
      const board = createEmptyBoard();
      // Board has different state than what moves suggest
      board[7][7] = PlayerColor.WHITE;
      
      const gameState = {
        board,
        currentPlayer: PlayerColor.WHITE,
        status: GameStatus.IN_PROGRESS,
        winner: null,
        moves: [
          { position: { row: 7, col: 7 }, player: PlayerColor.BLACK, timestamp: 1 }
        ],
        roomId: 'test-room'
      };
      
      expect(getWinner(gameState)).toBe(null);
    });
  });

  describe('Complex win scenarios', () => {
    it('should detect win in middle of longer sequence', () => {
      const board = createEmptyBoard();
      
      // Place 7 stones horizontally
      for (let i = 2; i < 9; i++) {
        board[7][i] = PlayerColor.BLACK;
      }
      
      // Check various positions in the sequence
      expect(checkWin(board, { row: 7, col: 3 }, PlayerColor.BLACK)).toBe(true);
      expect(checkWin(board, { row: 7, col: 5 }, PlayerColor.BLACK)).toBe(true);
      expect(checkWin(board, { row: 7, col: 7 }, PlayerColor.BLACK)).toBe(true);
    });

    it('should detect multiple possible wins on same position', () => {
      const board = createEmptyBoard();
      
      // Create intersection where both horizontal and vertical lines win
      const centerPos = { row: 7, col: 7 };
      
      // Horizontal line
      for (let i = 5; i < 10; i++) {
        board[7][i] = PlayerColor.WHITE;
      }
      
      // Vertical line  
      for (let i = 5; i < 10; i++) {
        board[i][7] = PlayerColor.WHITE;
      }
      
      expect(checkWin(board, centerPos, PlayerColor.WHITE)).toBe(true);
    });

    it('should handle diagonal wins near board edges correctly', () => {
      const board = createEmptyBoard();
      
      // Diagonal from top-right corner area
      const positions = [
        { row: 0, col: 10 },
        { row: 1, col: 11 },
        { row: 2, col: 12 },
        { row: 3, col: 13 },
        { row: 4, col: 14 }
      ];
      
      positions.forEach(pos => {
        board[pos.row][pos.col] = PlayerColor.BLACK;
      });
      
      expect(checkWin(board, positions[2], PlayerColor.BLACK)).toBe(true);
      expect(checkWin(board, positions[0], PlayerColor.BLACK)).toBe(true);
      expect(checkWin(board, positions[4], PlayerColor.BLACK)).toBe(true);
    });

    it('should handle anti-diagonal wins near board edges correctly', () => {
      const board = createEmptyBoard();
      
      // Anti-diagonal from bottom-right corner area
      const positions = [
        { row: 10, col: 14 },
        { row: 11, col: 13 },
        { row: 12, col: 12 },
        { row: 13, col: 11 },
        { row: 14, col: 10 }
      ];
      
      positions.forEach(pos => {
        board[pos.row][pos.col] = PlayerColor.WHITE;
      });
      
      expect(checkWin(board, positions[2], PlayerColor.WHITE)).toBe(true);
      expect(checkWin(board, positions[0], PlayerColor.WHITE)).toBe(true);
      expect(checkWin(board, positions[4], PlayerColor.WHITE)).toBe(true);
    });
  });

  describe('Performance and stress tests', () => {
    it('should handle checking win on heavily filled board efficiently', () => {
      const board = createEmptyBoard();
      
      // Fill most of the board with alternating patterns
      for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE - 5; j++) {
          board[i][j] = (i + j) % 2 === 0 ? PlayerColor.BLACK : PlayerColor.WHITE;
        }
      }
      
      // Add a winning line at the end
      for (let i = 0; i < 5; i++) {
        board[7][BOARD_SIZE - 5 + i] = PlayerColor.BLACK;
      }
      
      const startTime = performance.now();
      const hasWin = checkWin(board, { row: 7, col: BOARD_SIZE - 3 }, PlayerColor.BLACK);
      const endTime = performance.now();
      
      expect(hasWin).toBe(true);
      expect(endTime - startTime).toBeLessThan(10); // Should complete within 10ms
    });

    it('should handle multiple consecutive win checks efficiently', () => {
      const board = createEmptyBoard();
      
      // Set up multiple winning lines
      for (let i = 0; i < 5; i++) {
        board[3][i] = PlayerColor.BLACK; // Horizontal
        board[i][3] = PlayerColor.WHITE; // Vertical
        board[i + 5][i + 5] = PlayerColor.BLACK; // Diagonal
      }
      
      const startTime = performance.now();
      
      // Check multiple positions rapidly
      for (let testRun = 0; testRun < 100; testRun++) {
        checkWin(board, { row: 3, col: 2 }, PlayerColor.BLACK);
        checkWin(board, { row: 2, col: 3 }, PlayerColor.WHITE);
        checkWin(board, { row: 7, col: 7 }, PlayerColor.BLACK);
      }
      
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(50); // Should complete within 50ms
    });
  });

  describe('Advanced game scenarios', () => {
    it('should handle simultaneous potential wins correctly', () => {
      const board = createEmptyBoard();
      
      // Create a scenario where both players could win
      // Black has 4 in a row horizontally with gaps on both ends
      board[7][2] = PlayerColor.BLACK;
      board[7][3] = PlayerColor.BLACK;
      board[7][4] = PlayerColor.BLACK;
      board[7][5] = PlayerColor.BLACK;
      
      // White has 4 in a row vertically with gaps on both ends  
      board[3][7] = PlayerColor.WHITE;
      board[4][7] = PlayerColor.WHITE;
      board[5][7] = PlayerColor.WHITE;
      board[6][7] = PlayerColor.WHITE;
      
      // Neither should win yet
      expect(checkWin(board, { row: 7, col: 3 }, PlayerColor.BLACK)).toBe(false);
      expect(checkWin(board, { row: 5, col: 7 }, PlayerColor.WHITE)).toBe(false);
      
      // Black wins by filling the gap
      board[7][1] = PlayerColor.BLACK;
      expect(checkWin(board, { row: 7, col: 1 }, PlayerColor.BLACK)).toBe(true);
    });

    it('should handle complex overlapping patterns', () => {
      const board = createEmptyBoard();
      
      // Create an X pattern with black stones
      const center = { row: 7, col: 7 };
      
      // Main diagonal
      for (let i = -2; i <= 2; i++) {
        board[center.row + i][center.col + i] = PlayerColor.BLACK;
      }
      
      // Anti-diagonal  
      for (let i = -2; i <= 2; i++) {
        board[center.row + i][center.col - i] = PlayerColor.BLACK;
      }
      
      // The center position should trigger win for both diagonals
      expect(checkWin(board, center, PlayerColor.BLACK)).toBe(true);
      
      // Any position in either diagonal should also trigger win
      expect(checkWin(board, { row: 5, col: 5 }, PlayerColor.BLACK)).toBe(true);
      expect(checkWin(board, { row: 5, col: 9 }, PlayerColor.BLACK)).toBe(true);
    });

    it('should correctly identify false wins with gaps', () => {
      const board = createEmptyBoard();
      
      // Create 4 stones with a gap in the middle
      board[7][0] = PlayerColor.BLACK;
      board[7][1] = PlayerColor.BLACK;
      // gap at [7][2]
      board[7][3] = PlayerColor.BLACK;
      board[7][4] = PlayerColor.BLACK;
      
      expect(checkWin(board, { row: 7, col: 0 }, PlayerColor.BLACK)).toBe(false);
      expect(checkWin(board, { row: 7, col: 4 }, PlayerColor.BLACK)).toBe(false);
    });

    it('should handle wins at exact board boundaries', () => {
      const board = createEmptyBoard();
      
      // Vertical win at left edge
      for (let i = 0; i < 5; i++) {
        board[i][0] = PlayerColor.WHITE;
      }
      expect(checkWin(board, { row: 0, col: 0 }, PlayerColor.WHITE)).toBe(true);
      expect(checkWin(board, { row: 4, col: 0 }, PlayerColor.WHITE)).toBe(true);
      
      // Horizontal win at top edge
      const board2 = createEmptyBoard();
      for (let i = 0; i < 5; i++) {
        board2[0][i] = PlayerColor.BLACK;
      }
      expect(checkWin(board2, { row: 0, col: 2 }, PlayerColor.BLACK)).toBe(true);
    });

    it('should validate board state consistency', () => {
      const board = createEmptyBoard();
      
      // Test immutability of original board after makeMove
      const originalBoard = createEmptyBoard();
      const position = { row: 7, col: 7 };
      
      const newBoard = makeMove(originalBoard, position, PlayerColor.BLACK);
      
      // Original should be unchanged
      expect(originalBoard[7][7]).toBe(null);
      // New board should have the move
      expect(newBoard[7][7]).toBe(PlayerColor.BLACK);
      // Boards should be different references
      expect(newBoard).not.toBe(originalBoard);
    });

    it('should handle rapid sequence of moves correctly', () => {
      let board = createEmptyBoard();
      const moves = [
        { pos: { row: 7, col: 7 }, player: PlayerColor.BLACK },
        { pos: { row: 7, col: 8 }, player: PlayerColor.WHITE },
        { pos: { row: 6, col: 7 }, player: PlayerColor.BLACK },
        { pos: { row: 6, col: 8 }, player: PlayerColor.WHITE },
        { pos: { row: 8, col: 7 }, player: PlayerColor.BLACK },
        { pos: { row: 8, col: 8 }, player: PlayerColor.WHITE },
        { pos: { row: 5, col: 7 }, player: PlayerColor.BLACK },
        { pos: { row: 5, col: 8 }, player: PlayerColor.WHITE },
        { pos: { row: 9, col: 7 }, player: PlayerColor.BLACK }
      ];
      
      for (const move of moves) {
        board = makeMove(board, move.pos, move.player);
      }
      
      // Black should have won with vertical line
      expect(checkWin(board, { row: 9, col: 7 }, PlayerColor.BLACK)).toBe(true);
      
      // Verify all moves were applied
      expect(board[7][7]).toBe(PlayerColor.BLACK);
      expect(board[7][8]).toBe(PlayerColor.WHITE);
      expect(board[9][7]).toBe(PlayerColor.BLACK);
    });
  });

  describe('Error handling and robustness', () => {
    it('should handle null/undefined inputs gracefully', () => {
      const board = createEmptyBoard();
      
      // Test with invalid positions that might cause issues
      expect(() => isValidPosition({ row: NaN, col: 5 })).not.toThrow();
      expect(() => isValidPosition({ row: 5, col: Infinity })).not.toThrow();
      expect(() => isValidPosition({ row: -Infinity, col: 5 })).not.toThrow();
      
      expect(isValidPosition({ row: NaN, col: 5 })).toBe(false);
      expect(isValidPosition({ row: 5, col: Infinity })).toBe(false);
      expect(isValidPosition({ row: -Infinity, col: 5 })).toBe(false);
    });

    it('should handle edge case positions consistently', () => {
      const board = createEmptyBoard();
      
      // Test positions exactly at boundaries
      expect(isValidPosition({ row: 0, col: 0 })).toBe(true);
      expect(isValidPosition({ row: BOARD_SIZE - 1, col: BOARD_SIZE - 1 })).toBe(true);
      expect(isValidPosition({ row: BOARD_SIZE, col: BOARD_SIZE })).toBe(false);
      expect(isValidPosition({ row: -1, col: -1 })).toBe(false);
    });

    it('should maintain board integrity after multiple operations', () => {
      const board = createEmptyBoard();
      let currentBoard = board;
      
      // Perform multiple moves and verify board state
      const testPositions = [
        { row: 0, col: 0 }, { row: 0, col: 14 },
        { row: 14, col: 0 }, { row: 14, col: 14 },
        { row: 7, col: 7 }
      ];
      
      for (let i = 0; i < testPositions.length; i++) {
        const player = i % 2 === 0 ? PlayerColor.BLACK : PlayerColor.WHITE;
        currentBoard = makeMove(currentBoard, testPositions[i], player);
        
        // Verify the move was applied
        expect(currentBoard[testPositions[i].row][testPositions[i].col]).toBe(player);
        
        // Verify other positions remain unchanged or have expected values
        for (let j = 0; j < i; j++) {
          const prevPlayer = j % 2 === 0 ? PlayerColor.BLACK : PlayerColor.WHITE;
          expect(currentBoard[testPositions[j].row][testPositions[j].col]).toBe(prevPlayer);
        }
      }
    });
  });
});