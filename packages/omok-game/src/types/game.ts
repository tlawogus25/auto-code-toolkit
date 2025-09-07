export type CellState = 'empty' | 'black' | 'white';

export type GameBoard = CellState[][];

export type Player = 'black' | 'white';

export type GameStatus = 'waiting' | 'playing' | 'finished';

export interface Position {
  row: number;
  col: number;
}

export interface GameState {
  board: GameBoard;
  currentPlayer: Player;
  status: GameStatus;
  winner: Player | null;
  moveHistory: Position[];
  roomId: string;
  players: {
    black: string | null;
    white: string | null;
  };
}

export interface Room {
  id: string;
  name: string;
  gameState: GameState;
  createdAt: Date;
}

export interface RoomListItem {
  id: string;
  name: string;
  playerCount: number;
  status: string;
}