import {
  createEmptyBoard,
  createInitialGameState,
  isValidMove,
  makeMove,
  checkWinner,
  isBoardFull,
  BOARD_SIZE,
} from '../../src/lib/game-logic';
import { GameBoard, Player } from '../../src/types/game';

describe('Game Logic', () => {
  describe('createEmptyBoard', () => {
    it('should create an empty board with correct dimensions', () => {
      const board = createEmptyBoard();
      expect(board).toHaveLength(BOARD_SIZE);
      expect(board[0]).toHaveLength(BOARD_SIZE);
      
      for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
          expect(board[i][j]).toBe('empty');
        }
      }
    });
  });

  describe('createInitialGameState', () => {
    it('should create initial game state correctly', () => {
      const roomId = 'test-room';
      const gameState = createInitialGameState(roomId);
      
      expect(gameState.roomId).toBe(roomId);
      expect(gameState.currentPlayer).toBe('black');
      expect(gameState.status).toBe('waiting');
      expect(gameState.winner).toBeNull();
      expect(gameState.moveHistory).toEqual([]);
      expect(gameState.players.black).toBeNull();
      expect(gameState.players.white).toBeNull();
      expect(gameState.board).toHaveLength(BOARD_SIZE);
    });
  });

  describe('isValidMove', () => {
    let board: GameBoard;

    beforeEach(() => {
      board = createEmptyBoard();
    });

    it('should return true for valid moves', () => {
      expect(isValidMove(board, { row: 0, col: 0 })).toBe(true);
      expect(isValidMove(board, { row: 7, col: 7 })).toBe(true);
      expect(isValidMove(board, { row: BOARD_SIZE - 1, col: BOARD_SIZE - 1 })).toBe(true);
    });

    it('should return false for invalid positions', () => {
      expect(isValidMove(board, { row: -1, col: 0 })).toBe(false);
      expect(isValidMove(board, { row: 0, col: -1 })).toBe(false);
      expect(isValidMove(board, { row: BOARD_SIZE, col: 0 })).toBe(false);
      expect(isValidMove(board, { row: 0, col: BOARD_SIZE })).toBe(false);
    });

    it('should return false for occupied positions', () => {
      board[5][5] = 'black';
      expect(isValidMove(board, { row: 5, col: 5 })).toBe(false);
    });
  });

  describe('checkWinner', () => {
    let board: GameBoard;

    beforeEach(() => {
      board = createEmptyBoard();
    });

    it('should detect horizontal win', () => {
      // Place 5 black stones horizontally
      for (let i = 0; i < 5; i++) {
        board[7][i] = 'black';
      }
      
      expect(checkWinner(board, { row: 7, col: 4 }, 'black')).toBe('black');
    });

    it('should detect vertical win', () => {
      // Place 5 black stones vertically
      for (let i = 0; i < 5; i++) {
        board[i][7] = 'black';
      }
      
      expect(checkWinner(board, { row: 4, col: 7 }, 'black')).toBe('black');
    });

    it('should detect diagonal win (top-left to bottom-right)', () => {
      // Place 5 black stones diagonally
      for (let i = 0; i < 5; i++) {
        board[i][i] = 'black';
      }
      
      expect(checkWinner(board, { row: 4, col: 4 }, 'black')).toBe('black');
    });

    it('should detect diagonal win (top-right to bottom-left)', () => {
      // Place 5 black stones diagonally
      for (let i = 0; i < 5; i++) {
        board[i][4 - i] = 'black';
      }
      
      expect(checkWinner(board, { row: 2, col: 2 }, 'black')).toBe('black');
    });

    it('should return null when no winner', () => {
      // Place 4 black stones horizontally (not enough to win)
      for (let i = 0; i < 4; i++) {
        board[7][i] = 'black';
      }
      
      expect(checkWinner(board, { row: 7, col: 3 }, 'black')).toBeNull();
    });

    it('should detect win for white pieces', () => {
      // Place 5 white stones horizontally
      for (let i = 0; i < 5; i++) {
        board[7][i] = 'white';
      }
      
      expect(checkWinner(board, { row: 7, col: 4 }, 'white')).toBe('white');
    });

    it('should detect win when stones are not consecutive from start', () => {
      // Place stones in the middle of a line
      for (let i = 3; i < 8; i++) {
        board[7][i] = 'black';
      }
      
      expect(checkWinner(board, { row: 7, col: 5 }, 'black')).toBe('black');
    });
  });

  describe('makeMove', () => {
    it('should make a valid move and switch players', () => {
      const gameState = createInitialGameState('test-room');
      const position = { row: 7, col: 7 };
      
      const newState = makeMove(gameState, position);
      
      expect(newState.board[7][7]).toBe('black');
      expect(newState.currentPlayer).toBe('white');
      expect(newState.moveHistory).toEqual([position]);
    });

    it('should not make an invalid move', () => {
      const gameState = createInitialGameState('test-room');
      gameState.board[7][7] = 'black';
      
      const position = { row: 7, col: 7 };
      const newState = makeMove(gameState, position);
      
      expect(newState).toBe(gameState);
    });

    it('should detect winner and finish game', () => {
      const gameState = createInitialGameState('test-room');
      
      // Place 4 black stones horizontally
      for (let i = 0; i < 4; i++) {
        gameState.board[7][i] = 'black';
      }
      
      // Make the winning move
      const newState = makeMove(gameState, { row: 7, col: 4 });
      
      expect(newState.winner).toBe('black');
      expect(newState.status).toBe('finished');
    });
  });

  describe('isBoardFull', () => {
    it('should return false for empty board', () => {
      const board = createEmptyBoard();
      expect(isBoardFull(board)).toBe(false);
    });

    it('should return false for partially filled board', () => {
      const board = createEmptyBoard();
      board[0][0] = 'black';
      board[1][1] = 'white';
      expect(isBoardFull(board)).toBe(false);
    });

    it('should return true for completely filled board', () => {
      const board = createEmptyBoard();
      
      // Fill the entire board
      for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
          board[i][j] = (i + j) % 2 === 0 ? 'black' : 'white';
        }
      }
      
      expect(isBoardFull(board)).toBe(true);
    });
  });
});