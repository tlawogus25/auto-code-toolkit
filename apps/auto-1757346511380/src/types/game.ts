export type Player = 'black' | 'white'
export type CellState = Player | null

export interface Position {
  row: number
  col: number
}

export interface GameState {
  board: CellState[][]
  currentPlayer: Player
  winner: Player | null
  isGameOver: boolean
  moveHistory: Position[]
}

export interface Room {
  id: string
  name: string
  players: Array<{
    id: string
    name: string
    color: Player
  }>
  maxPlayers: number
  gameState: GameState
  isActive: boolean
}

export interface GameMove {
  position: Position
  player: Player
  timestamp: number
}

export const BOARD_SIZE = 15