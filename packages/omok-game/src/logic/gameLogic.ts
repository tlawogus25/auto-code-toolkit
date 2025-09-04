import { PlayerColor, Position, GameState, BOARD_SIZE, WIN_CONDITION } from '../types/game.js';

export function createEmptyBoard(): (PlayerColor | null)[][] {
  return Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
}

export function isValidPosition(position: Position): boolean {
  const { row, col } = position;
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

export function isPositionEmpty(board: (PlayerColor | null)[][], position: Position): boolean {
  if (!isValidPosition(position)) return false;
  return board[position.row][position.col] === null;
}

export function makeMove(
  board: (PlayerColor | null)[][], 
  position: Position, 
  player: PlayerColor
): (PlayerColor | null)[][] {
  if (!isPositionEmpty(board, position)) {
    throw new Error('Position is already occupied');
  }

  const newBoard = board.map(row => [...row]);
  newBoard[position.row][position.col] = player;
  return newBoard;
}

const directions = [
  [0, 1],   // horizontal
  [1, 0],   // vertical
  [1, 1],   // diagonal /
  [1, -1]   // diagonal \
];

function countConsecutive(
  board: (PlayerColor | null)[][],
  position: Position,
  direction: number[],
  player: PlayerColor
): number {
  const [dr, dc] = direction;
  let count = 1; // Count the current position

  // Count in positive direction
  let r = position.row + dr;
  let c = position.col + dc;
  while (
    r >= 0 && r < BOARD_SIZE && 
    c >= 0 && c < BOARD_SIZE && 
    board[r][c] === player
  ) {
    count++;
    r += dr;
    c += dc;
  }

  // Count in negative direction
  r = position.row - dr;
  c = position.col - dc;
  while (
    r >= 0 && r < BOARD_SIZE && 
    c >= 0 && c < BOARD_SIZE && 
    board[r][c] === player
  ) {
    count++;
    r -= dr;
    c -= dc;
  }

  return count;
}

export function checkWin(
  board: (PlayerColor | null)[][], 
  position: Position, 
  player: PlayerColor
): boolean {
  if (!isValidPosition(position) || board[position.row][position.col] !== player) {
    return false;
  }

  return directions.some(direction => 
    countConsecutive(board, position, direction, player) >= WIN_CONDITION
  );
}

export function getWinner(gameState: GameState): PlayerColor | null {
  if (gameState.moves.length === 0) return null;

  const lastMove = gameState.moves[gameState.moves.length - 1];
  if (checkWin(gameState.board, lastMove.position, lastMove.player)) {
    return lastMove.player;
  }

  return null;
}

export function isBoardFull(board: (PlayerColor | null)[][]): boolean {
  return board.every(row => row.every(cell => cell !== null));
}

export function getNextPlayer(currentPlayer: PlayerColor): PlayerColor {
  return currentPlayer === PlayerColor.BLACK ? PlayerColor.WHITE : PlayerColor.BLACK;
}