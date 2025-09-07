import { GameState, Position, Player, RoomListItem } from './game';

export type MessageType = 
  | 'create_room'
  | 'join_room'
  | 'leave_room'
  | 'make_move'
  | 'game_update'
  | 'room_list'
  | 'error';

export interface WebSocketMessage {
  type: MessageType;
  payload: any;
  timestamp: number;
  userId?: string;
}

export interface CreateRoomMessage extends WebSocketMessage {
  type: 'create_room';
  payload: {
    roomId: string;
    roomName: string;
  };
}

export interface JoinRoomMessage extends WebSocketMessage {
  type: 'join_room';
  payload: {
    roomId: string;
    playerName: string;
  };
}

export interface LeaveRoomMessage extends WebSocketMessage {
  type: 'leave_room';
  payload: {
    roomId: string;
  };
}

export interface MakeMoveMessage extends WebSocketMessage {
  type: 'make_move';
  payload: {
    roomId: string;
    position: Position;
  };
}

export interface GameUpdateMessage extends WebSocketMessage {
  type: 'game_update';
  payload: {
    gameState: GameState;
  };
}

export interface RoomListMessage extends WebSocketMessage {
  type: 'room_list';
  payload: {
    rooms: RoomListItem[];
  };
}

export interface ErrorMessage extends WebSocketMessage {
  type: 'error';
  payload: {
    message: string;
    code?: string;
  };
}