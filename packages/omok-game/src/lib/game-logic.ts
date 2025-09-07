import { GameBoard, CellState, Player, Position, GameState } from '@/types/game';

export const BOARD_SIZE = 15;

export function createEmptyBoard(): GameBoard {
  return Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill('empty'));
}

export function createInitialGameState(roomId: string): GameState {
  return {
    board: createEmptyBoard(),
    currentPlayer: 'black',
    status: 'waiting',
    winner: null,
    moveHistory: [],
    roomId,
    players: {
      black: null,
      white: null,
    },
  };
}

export function isValidMove(board: GameBoard, position: Position): boolean {
  const { row, col } = position;
  
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
    return false;
  }
  
  return board[row][col] === 'empty';
}

export function makeMove(gameState: GameState, position: Position): GameState {
  if (!isValidMove(gameState.board, position)) {
    return gameState;
  }

  const newBoard = gameState.board.map(row => [...row]);
  newBoard[position.row][position.col] = gameState.currentPlayer;

  const newMoveHistory = [...gameState.moveHistory, position];
  const winner = checkWinner(newBoard, position, gameState.currentPlayer);
  
  return {
    ...gameState,
    board: newBoard,
    currentPlayer: gameState.currentPlayer === 'black' ? 'white' : 'black',
    status: winner ? 'finished' : 'playing',
    winner,
    moveHistory: newMoveHistory,
  };
}

export function checkWinner(board: GameBoard, lastMove: Position, player: Player): Player | null {
  const directions = [
    [0, 1],   // horizontal
    [1, 0],   // vertical
    [1, 1],   // diagonal \
    [1, -1],  // diagonal /
  ];

  for (const [dx, dy] of directions) {
    let count = 1; // count the piece just placed
    
    // Check in positive direction
    let row = lastMove.row + dx;
    let col = lastMove.col + dy;
    while (
      row >= 0 && row < BOARD_SIZE && 
      col >= 0 && col < BOARD_SIZE && 
      board[row][col] === player
    ) {
      count++;
      row += dx;
      col += dy;
    }
    
    // Check in negative direction
    row = lastMove.row - dx;
    col = lastMove.col - dy;
    while (
      row >= 0 && row < BOARD_SIZE && 
      col >= 0 && col < BOARD_SIZE && 
      board[row][col] === player
    ) {
      count++;
      row -= dx;
      col -= dy;
    }
    
    if (count >= 5) {
      return player;
    }
  }
  
  return null;
}

export function isBoardFull(board: GameBoard): boolean {
  return board.every(row => row.every(cell => cell !== 'empty'));
}