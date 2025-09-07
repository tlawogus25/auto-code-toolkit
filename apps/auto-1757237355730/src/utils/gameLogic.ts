import { CellState, Player, Position, GameState, BOARD_SIZE } from '../types/game'

export function createEmptyBoard(): CellState[][] {
  return Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null))
}

export function createInitialGameState(): GameState {
  return {
    board: createEmptyBoard(),
    currentPlayer: 'black',
    winner: null,
    isGameOver: false,
    moveHistory: []
  }
}

export function isValidMove(board: CellState[][], position: Position): boolean {
  const { row, col } = position
  return (
    row >= 0 && 
    row < BOARD_SIZE && 
    col >= 0 && 
    col < BOARD_SIZE && 
    board[row][col] === null
  )
}

export function makeMove(
  gameState: GameState, 
  position: Position
): GameState | null {
  if (!isValidMove(gameState.board, position) || gameState.isGameOver) {
    return null
  }

  const newBoard = gameState.board.map(row => [...row])
  newBoard[position.row][position.col] = gameState.currentPlayer

  const winner = checkWinner(newBoard, position, gameState.currentPlayer)
  const isGameOver = winner !== null || isBoardFull(newBoard)

  return {
    board: newBoard,
    currentPlayer: gameState.currentPlayer === 'black' ? 'white' : 'black',
    winner,
    isGameOver,
    moveHistory: [...gameState.moveHistory, position]
  }
}

export function checkWinner(
  board: CellState[][], 
  lastMove: Position, 
  player: Player
): Player | null {
  const directions = [
    [0, 1],   // horizontal
    [1, 0],   // vertical
    [1, 1],   // diagonal \
    [1, -1]   // diagonal /
  ]

  for (const [dx, dy] of directions) {
    if (checkDirection(board, lastMove, player, dx, dy)) {
      return player
    }
  }

  return null
}

function checkDirection(
  board: CellState[][],
  position: Position,
  player: Player,
  dx: number,
  dy: number
): boolean {
  let count = 1 // Count the placed stone

  // Check positive direction
  count += countConsecutive(board, position, player, dx, dy)
  
  // Check negative direction
  count += countConsecutive(board, position, player, -dx, -dy)

  return count >= 5
}

function countConsecutive(
  board: CellState[][],
  start: Position,
  player: Player,
  dx: number,
  dy: number
): number {
  let count = 0
  let row = start.row + dx
  let col = start.col + dy

  while (
    row >= 0 && 
    row < BOARD_SIZE && 
    col >= 0 && 
    col < BOARD_SIZE && 
    board[row][col] === player
  ) {
    count++
    row += dx
    col += dy
  }

  return count
}

export function isBoardFull(board: CellState[][]): boolean {
  return board.every(row => row.every(cell => cell !== null))
}

export function getWinningLine(
  board: CellState[][],
  lastMove: Position,
  player: Player
): Position[] | null {
  const directions = [
    [0, 1],   // horizontal
    [1, 0],   // vertical  
    [1, 1],   // diagonal \
    [1, -1]   // diagonal /
  ]

  for (const [dx, dy] of directions) {
    const line = getDirectionLine(board, lastMove, player, dx, dy)
    if (line.length >= 5) {
      return line.slice(0, 5) // Return exactly 5 stones
    }
  }

  return null
}

function getDirectionLine(
  board: CellState[][],
  position: Position,
  player: Player,
  dx: number,
  dy: number
): Position[] {
  const line: Position[] = [position]

  // Check positive direction
  let row = position.row + dx
  let col = position.col + dy
  while (
    row >= 0 && 
    row < BOARD_SIZE && 
    col >= 0 && 
    col < BOARD_SIZE && 
    board[row][col] === player
  ) {
    line.push({ row, col })
    row += dx
    col += dy
  }

  // Check negative direction
  row = position.row - dx
  col = position.col - dy
  while (
    row >= 0 && 
    row < BOARD_SIZE && 
    col >= 0 && 
    col < BOARD_SIZE && 
    board[row][col] === player
  ) {
    line.unshift({ row, col })
    row -= dx
    col -= dy
  }

  return line
}