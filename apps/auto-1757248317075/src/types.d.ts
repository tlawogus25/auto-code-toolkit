export type Stone = 'black' | 'white' | null;
export type Board = Stone[][];
export type Player = {
    id: string;
    name: string;
    stone: 'black' | 'white';
};
export type GameState = {
    board: Board;
    currentPlayer: 'black' | 'white';
    players: Record<string, Player>;
    winner: 'black' | 'white' | 'draw' | null;
    gameStarted: boolean;
    roomId: string | null;
};
export type Position = {
    row: number;
    col: number;
};
export type WinCondition = {
    positions: Position[];
    winner: 'black' | 'white';
};
export type Room = {
    id: string;
    name: string;
    players: Player[];
    maxPlayers: number;
    gameState: GameState;
};
export type GameMessage = {
    type: 'ROOM_CREATED';
    room: Room;
} | {
    type: 'ROOM_JOINED';
    room: Room;
    player: Player;
} | {
    type: 'ROOM_LEFT';
    roomId: string;
    playerId: string;
} | {
    type: 'GAME_STARTED';
    room: Room;
} | {
    type: 'MOVE_MADE';
    position: Position;
    player: Player;
    board: Board;
} | {
    type: 'GAME_ENDED';
    winner: 'black' | 'white' | 'draw';
    winCondition?: WinCondition;
} | {
    type: 'PLAYER_DISCONNECTED';
    playerId: string;
} | {
    type: 'ERROR';
    message: string;
};
export type ClientMessage = {
    type: 'CREATE_ROOM';
    roomName: string;
    playerName: string;
} | {
    type: 'JOIN_ROOM';
    roomId: string;
    playerName: string;
} | {
    type: 'LEAVE_ROOM';
} | {
    type: 'MAKE_MOVE';
    position: Position;
} | {
    type: 'START_GAME';
};
//# sourceMappingURL=types.d.ts.map