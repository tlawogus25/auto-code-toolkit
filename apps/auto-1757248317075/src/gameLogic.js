"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BOARD_SIZE = void 0;
exports.createEmptyBoard = createEmptyBoard;
exports.isValidMove = isValidMove;
exports.makeMove = makeMove;
exports.checkWinner = checkWinner;
exports.isBoardFull = isBoardFull;
exports.getGameResult = getGameResult;
exports.getNextPlayer = getNextPlayer;
exports.BOARD_SIZE = 15;
function createEmptyBoard() {
    return Array(exports.BOARD_SIZE).fill(null).map(() => Array(exports.BOARD_SIZE).fill(null));
}
function isValidMove(board, position) {
    const { row, col } = position;
    if (row < 0 || row >= exports.BOARD_SIZE || col < 0 || col >= exports.BOARD_SIZE) {
        return false;
    }
    return board[row][col] === null;
}
function makeMove(board, position, stone) {
    if (!isValidMove(board, position) || stone === null) {
        return board;
    }
    const newBoard = board.map(row => [...row]);
    newBoard[position.row][position.col] = stone;
    return newBoard;
}
function checkWinner(board, lastMove) {
    const stone = board[lastMove.row][lastMove.col];
    if (stone === null)
        return null;
    const directions = [
        [0, 1], // horizontal
        [1, 0], // vertical
        [1, 1], // diagonal \
        [1, -1], // diagonal /
    ];
    for (const [dx, dy] of directions) {
        const positions = [];
        // Check in both directions from the last move
        for (let direction = -1; direction <= 1; direction += 2) {
            let row = lastMove.row;
            let col = lastMove.col;
            while (true) {
                row += dx * direction;
                col += dy * direction;
                if (row < 0 || row >= exports.BOARD_SIZE ||
                    col < 0 || col >= exports.BOARD_SIZE ||
                    board[row][col] !== stone) {
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
                if (dx === 0)
                    return a.col - b.col;
                if (dy === 0)
                    return a.row - b.row;
                if (dx === dy)
                    return a.row - b.row;
                return a.row - b.row;
            });
            return {
                positions: positions.slice(0, 5),
                winner: stone
            };
        }
    }
    return null;
}
function isBoardFull(board) {
    return board.every(row => row.every(cell => cell !== null));
}
function getGameResult(board, lastMove) {
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
function getNextPlayer(currentPlayer) {
    return currentPlayer === 'black' ? 'white' : 'black';
}
//# sourceMappingURL=gameLogic.js.map