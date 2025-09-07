import { Position, Player, Room, GameState } from './game'

export interface BaseMessage {
  type: string
  timestamp: number
}

export interface JoinRoomMessage extends BaseMessage {
  type: 'JOIN_ROOM'
  roomId: string
  playerName: string
}

export interface CreateRoomMessage extends BaseMessage {
  type: 'CREATE_ROOM'
  roomName: string
  playerName: string
}

export interface MakeMoveMessage extends BaseMessage {
  type: 'MAKE_MOVE'
  roomId: string
  position: Position
}

export interface LeaveRoomMessage extends BaseMessage {
  type: 'LEAVE_ROOM'
  roomId: string
}

export interface RoomJoinedMessage extends BaseMessage {
  type: 'ROOM_JOINED'
  room: Room
  playerId: string
  playerColor: Player
}

export interface RoomCreatedMessage extends BaseMessage {
  type: 'ROOM_CREATED'
  room: Room
  playerId: string
}

export interface GameUpdateMessage extends BaseMessage {
  type: 'GAME_UPDATE'
  gameState: GameState
  lastMove?: Position
}

export interface PlayerJoinedMessage extends BaseMessage {
  type: 'PLAYER_JOINED'
  playerName: string
  playerId: string
  playerColor: Player
}

export interface PlayerLeftMessage extends BaseMessage {
  type: 'PLAYER_LEFT'
  playerName: string
  playerId: string
}

export interface GameOverMessage extends BaseMessage {
  type: 'GAME_OVER'
  winner: Player
  winningLine?: Position[]
}

export interface ErrorMessage extends BaseMessage {
  type: 'ERROR'
  message: string
}

export interface RoomListMessage extends BaseMessage {
  type: 'ROOM_LIST'
  rooms: Room[]
}

export type ServerMessage = 
  | RoomJoinedMessage
  | RoomCreatedMessage
  | GameUpdateMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | GameOverMessage
  | ErrorMessage
  | RoomListMessage

export type ClientMessage =
  | JoinRoomMessage
  | CreateRoomMessage
  | MakeMoveMessage
  | LeaveRoomMessage