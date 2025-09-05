import { PlayerColor, Position, GameState, Room } from './game.js';

export enum MessageType {
  JOIN_ROOM = 'join_room',
  LEAVE_ROOM = 'leave_room',
  CREATE_ROOM = 'create_room',
  MAKE_MOVE = 'make_move',
  GAME_UPDATE = 'game_update',
  ERROR = 'error',
  ROOM_LIST = 'room_list'
}

export interface BaseMessage {
  type: MessageType;
  timestamp: number;
}

export interface JoinRoomMessage extends BaseMessage {
  type: MessageType.JOIN_ROOM;
  roomId: string;
  playerName: string;
}

export interface LeaveRoomMessage extends BaseMessage {
  type: MessageType.LEAVE_ROOM;
  roomId: string;
}

export interface CreateRoomMessage extends BaseMessage {
  type: MessageType.CREATE_ROOM;
  roomName: string;
  playerName: string;
}

export interface MakeMoveMessage extends BaseMessage {
  type: MessageType.MAKE_MOVE;
  roomId: string;
  position: Position;
}

export interface GameUpdateMessage extends BaseMessage {
  type: MessageType.GAME_UPDATE;
  gameState: GameState;
  room: Room;
}

export interface ErrorMessage extends BaseMessage {
  type: MessageType.ERROR;
  message: string;
}

export interface RoomListMessage extends BaseMessage {
  type: MessageType.ROOM_LIST;
  rooms: Room[];
}

export type ClientMessage = 
  | JoinRoomMessage 
  | LeaveRoomMessage 
  | CreateRoomMessage 
  | MakeMoveMessage;

export type ServerMessage = 
  | GameUpdateMessage 
  | ErrorMessage 
  | RoomListMessage;