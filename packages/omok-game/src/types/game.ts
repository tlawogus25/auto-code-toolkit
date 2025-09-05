export enum PlayerColor {
  BLACK = 'black',
  WHITE = 'white'
}

export enum GameStatus {
  WAITING = 'waiting',
  IN_PROGRESS = 'in_progress',
  FINISHED = 'finished'
}

export interface Position {
  row: number;
  col: number;
}

export interface Move {
  position: Position;
  player: PlayerColor;
  timestamp: number;
}

export interface GameState {
  board: (PlayerColor | null)[][];
  currentPlayer: PlayerColor;
  status: GameStatus;
  winner: PlayerColor | null;
  moves: Move[];
  roomId: string;
}

export interface Player {
  id: string;
  name: string;
  color: PlayerColor;
  connected: boolean;
}

export interface Room {
  id: string;
  name: string;
  players: Player[];
  gameState: GameState;
  maxPlayers: number;
}

export const BOARD_SIZE = 15;
export const WIN_CONDITION = 5;