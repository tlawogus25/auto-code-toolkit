import { Board, Stone, Position, WinCondition } from './types';
export declare const BOARD_SIZE = 15;
export declare function createEmptyBoard(): Board;
export declare function isValidMove(board: Board, position: Position): boolean;
export declare function makeMove(board: Board, position: Position, stone: Stone): Board;
export declare function checkWinner(board: Board, lastMove: Position): WinCondition | null;
export declare function isBoardFull(board: Board): boolean;
export declare function getGameResult(board: Board, lastMove: Position | null): {
    winner: 'black' | 'white' | 'draw' | null;
    winCondition?: WinCondition;
};
export declare function getNextPlayer(currentPlayer: 'black' | 'white'): 'black' | 'white';
//# sourceMappingURL=gameLogic.d.ts.map