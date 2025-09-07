import { describe, it, expect } from 'vitest'
import { 
  createEmptyBoard, 
  createInitialGameState,
  isValidMove,
  makeMove,
  checkWinner,
  isBoardFull,
  getWinningLine
} from '../src/utils/gameLogic'
import { BOARD_SIZE } from '../src/types/game'

describe('Game Logic', () => {
  describe('createEmptyBoard', () => {
    it('should create a board with correct dimensions', () => {
      const board = createEmptyBoard()
      expect(board.length).toBe(BOARD_SIZE)
      expect(board[0].length).toBe(BOARD_SIZE)
    })

    it('should create a board with all null values', () => {
      const board = createEmptyBoard()
      board.forEach(row => {
        row.forEach(cell => {
          expect(cell).toBe(null)
        })
      })
    })
  })

  describe('createInitialGameState', () => {
    it('should create initial game state with correct values', () => {
      const gameState = createInitialGameState()
      expect(gameState.currentPlayer).toBe('black')
      expect(gameState.winner).toBe(null)
      expect(gameState.isGameOver).toBe(false)
      expect(gameState.moveHistory).toEqual([])
      expect(gameState.board.length).toBe(BOARD_SIZE)
    })
  })

  describe('isValidMove', () => {
    it('should return true for valid moves', () => {
      const board = createEmptyBoard()
      expect(isValidMove(board, { row: 0, col: 0 })).toBe(true)
      expect(isValidMove(board, { row: 7, col: 7 })).toBe(true)
      expect(isValidMove(board, { row: 14, col: 14 })).toBe(true)
    })

    it('should return false for out-of-bounds moves', () => {
      const board = createEmptyBoard()
      expect(isValidMove(board, { row: -1, col: 0 })).toBe(false)
      expect(isValidMove(board, { row: 0, col: -1 })).toBe(false)
      expect(isValidMove(board, { row: 15, col: 0 })).toBe(false)
      expect(isValidMove(board, { row: 0, col: 15 })).toBe(false)
    })

    it('should return false for occupied positions', () => {
      const board = createEmptyBoard()
      board[7][7] = 'black'
      expect(isValidMove(board, { row: 7, col: 7 })).toBe(false)
    })
  })

  describe('makeMove', () => {
    it('should place stone and switch players', () => {
      const gameState = createInitialGameState()
      const newState = makeMove(gameState, { row: 7, col: 7 })
      
      expect(newState).not.toBe(null)
      expect(newState!.board[7][7]).toBe('black')
      expect(newState!.currentPlayer).toBe('white')
      expect(newState!.moveHistory).toEqual([{ row: 7, col: 7 }])
    })

    it('should return null for invalid moves', () => {
      const gameState = createInitialGameState()
      gameState.board[7][7] = 'black'
      
      const newState = makeMove(gameState, { row: 7, col: 7 })
      expect(newState).toBe(null)
    })

    it('should not allow moves when game is over', () => {
      const gameState = createInitialGameState()
      gameState.isGameOver = true
      
      const newState = makeMove(gameState, { row: 7, col: 7 })
      expect(newState).toBe(null)
    })
  })

  describe('checkWinner', () => {
    it('should detect horizontal wins', () => {
      const board = createEmptyBoard()
      // Place 5 black stones horizontally
      for (let i = 0; i < 5; i++) {
        board[7][i] = 'black'
      }
      
      const winner = checkWinner(board, { row: 7, col: 4 }, 'black')
      expect(winner).toBe('black')
    })

    it('should detect vertical wins', () => {
      const board = createEmptyBoard()
      // Place 5 black stones vertically
      for (let i = 0; i < 5; i++) {
        board[i][7] = 'black'
      }
      
      const winner = checkWinner(board, { row: 4, col: 7 }, 'black')
      expect(winner).toBe('black')
    })

    it('should detect diagonal wins (top-left to bottom-right)', () => {
      const board = createEmptyBoard()
      // Place 5 black stones diagonally
      for (let i = 0; i < 5; i++) {
        board[i][i] = 'black'
      }
      
      const winner = checkWinner(board, { row: 4, col: 4 }, 'black')
      expect(winner).toBe('black')
    })

    it('should detect diagonal wins (top-right to bottom-left)', () => {
      const board = createEmptyBoard()
      // Place 5 black stones diagonally
      for (let i = 0; i < 5; i++) {
        board[i][9 - i] = 'black'
      }
      
      const winner = checkWinner(board, { row: 2, col: 7 }, 'black')
      expect(winner).toBe('black')
    })

    it('should return null when no win condition is met', () => {
      const board = createEmptyBoard()
      board[7][7] = 'black'
      
      const winner = checkWinner(board, { row: 7, col: 7 }, 'black')
      expect(winner).toBe(null)
    })

    it('should not detect wins with only 4 stones', () => {
      const board = createEmptyBoard()
      // Place 4 black stones horizontally
      for (let i = 0; i < 4; i++) {
        board[7][i] = 'black'
      }
      
      const winner = checkWinner(board, { row: 7, col: 3 }, 'black')
      expect(winner).toBe(null)
    })
  })

  describe('isBoardFull', () => {
    it('should return false for empty board', () => {
      const board = createEmptyBoard()
      expect(isBoardFull(board)).toBe(false)
    })

    it('should return false for partially filled board', () => {
      const board = createEmptyBoard()
      board[7][7] = 'black'
      expect(isBoardFull(board)).toBe(false)
    })

    it('should return true for completely filled board', () => {
      const board = createEmptyBoard()
      for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          board[row][col] = (row + col) % 2 === 0 ? 'black' : 'white'
        }
      }
      expect(isBoardFull(board)).toBe(true)
    })
  })

  describe('getWinningLine', () => {
    it('should return winning line for horizontal win', () => {
      const board = createEmptyBoard()
      // Place 5 black stones horizontally
      for (let i = 0; i < 5; i++) {
        board[7][i + 2] = 'black'
      }
      
      const winningLine = getWinningLine(board, { row: 7, col: 4 }, 'black')
      expect(winningLine).toEqual([
        { row: 7, col: 2 },
        { row: 7, col: 3 },
        { row: 7, col: 4 },
        { row: 7, col: 5 },
        { row: 7, col: 6 }
      ])
    })

    it('should return winning line for vertical win', () => {
      const board = createEmptyBoard()
      // Place 5 black stones vertically
      for (let i = 0; i < 5; i++) {
        board[i + 3][7] = 'black'
      }
      
      const winningLine = getWinningLine(board, { row: 5, col: 7 }, 'black')
      expect(winningLine).toEqual([
        { row: 3, col: 7 },
        { row: 4, col: 7 },
        { row: 5, col: 7 },
        { row: 6, col: 7 },
        { row: 7, col: 7 }
      ])
    })

    it('should return null when no winning line exists', () => {
      const board = createEmptyBoard()
      board[7][7] = 'black'
      
      const winningLine = getWinningLine(board, { row: 7, col: 7 }, 'black')
      expect(winningLine).toBe(null)
    })
  })

  describe('Integration tests', () => {
    it('should handle a complete game sequence', () => {
      let gameState = createInitialGameState()
      
      // Black's moves
      gameState = makeMove(gameState, { row: 7, col: 7 })!
      expect(gameState.currentPlayer).toBe('white')
      
      // White's move
      gameState = makeMove(gameState, { row: 8, col: 7 })!
      expect(gameState.currentPlayer).toBe('black')
      
      // Continue with black moves for potential win
      gameState = makeMove(gameState, { row: 7, col: 8 })!
      gameState = makeMove(gameState, { row: 8, col: 8 })!
      gameState = makeMove(gameState, { row: 7, col: 9 })!
      gameState = makeMove(gameState, { row: 8, col: 9 })!
      gameState = makeMove(gameState, { row: 7, col: 10 })!
      gameState = makeMove(gameState, { row: 8, col: 10 })!
      
      // Winning move
      gameState = makeMove(gameState, { row: 7, col: 11 })!
      expect(gameState.winner).toBe('black')
      expect(gameState.isGameOver).toBe(true)
    })
  })
})