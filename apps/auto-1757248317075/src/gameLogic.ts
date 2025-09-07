import { Board, Stone, Position, WinCondition } from './types';

export const BOARD_SIZE = 15;

export function createEmptyBoard(): Board {
  return Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
}

export function isValidMove(board: Board, position: Position): boolean {
  const { row, col } = position;
  
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
    return false;
  }
  
  return board[row][col] === null;
}

export function makeMove(board: Board, position: Position, stone: Stone): Board {
  if (!isValidMove(board, position) || stone === null) {
    return board;
  }
  
  const newBoard = board.map(row => [...row]);
  newBoard[position.row][position.col] = stone;
  return newBoard;
}

export function checkWinner(board: Board, lastMove: Position): WinCondition | null {
  const stone = board[lastMove.row][lastMove.col];
  if (stone === null) return null;

  const directions = [
    [0, 1],   // horizontal
    [1, 0],   // vertical
    [1, 1],   // diagonal \
    [1, -1],  // diagonal /
  ];

  for (const [dx, dy] of directions) {
    const positions: Position[] = [];
    
    // Check in both directions from the last move
    for (let direction = -1; direction <= 1; direction += 2) {
      let row = lastMove.row;
      let col = lastMove.col;
      
      while (true) {
        row += dx * direction;
        col += dy * direction;
        
        if (
          row < 0 || row >= BOARD_SIZE ||
          col < 0 || col >= BOARD_SIZE ||
          board[row][col] !== stone
        ) {
          break;
        }
        
        positions.push({ row, col });
      }
    }
    
    // Add the last move position
    positions.push(lastMove);
    
    // Check if we have 5 or more in a row
    if (positions.length >= 5) {
      // Sort positions to get the actual 5 in a row
      positions.sort((a, b) => {
        if (dx === 0) return a.col - b.col;
        if (dy === 0) return a.row - b.row;
        if (dx === dy) return a.row - b.row;
        return a.row - b.row;
      });
      
      return {
        positions: positions.slice(0, 5),
        winner: stone as 'black' | 'white'
      };
    }
  }
  
  return null;
}

export function isBoardFull(board: Board): boolean {
  return board.every(row => row.every(cell => cell !== null));
}

export function getGameResult(board: Board, lastMove: Position | null): { winner: 'black' | 'white' | 'draw' | null; winCondition?: WinCondition } {
  if (lastMove) {
    const winCondition = checkWinner(board, lastMove);
    if (winCondition) {
      return { winner: winCondition.winner, winCondition };
    }
  }
  
  if (isBoardFull(board)) {
    return { winner: 'draw' };
  }
  
  return { winner: null };
}

export function getNextPlayer(currentPlayer: 'black' | 'white'): 'black' | 'white' {
  return currentPlayer === 'black' ? 'white' : 'black';
}