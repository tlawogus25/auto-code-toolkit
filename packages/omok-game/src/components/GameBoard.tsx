import React from 'react';
import { PlayerColor, Position, BOARD_SIZE } from '../types/game.js';

interface GameBoardProps {
  board: (PlayerColor | null)[][];
  onCellClick: (position: Position) => void;
  disabled?: boolean;
  currentPlayer?: PlayerColor;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  board,
  onCellClick,
  disabled = false,
  currentPlayer
}) => {
  const handleCellClick = (row: number, col: number) => {
    if (disabled || board[row][col] !== null) return;
    onCellClick({ row, col });
  };

  const getCellStyle = (row: number, col: number) => {
    const stone = board[row][col];
    const baseStyle = `
      w-6 h-6 border border-amber-800 cursor-pointer
      hover:bg-amber-100 transition-colors duration-150
      flex items-center justify-center
      ${disabled ? 'cursor-not-allowed opacity-50' : ''}
    `;

    if (stone) {
      const stoneColor = stone === PlayerColor.BLACK ? 'bg-black' : 'bg-white border-gray-300';
      return `${baseStyle} ${stoneColor}`;
    }

    return baseStyle;
  };

  const renderStone = (stone: PlayerColor | null) => {
    if (!stone) return null;
    
    return (
      <div 
        className={`
          w-4 h-4 rounded-full
          ${stone === PlayerColor.BLACK ? 'bg-black' : 'bg-white border border-gray-400'}
        `}
      />
    );
  };

  return (
    <div className="inline-block bg-amber-600 p-4 rounded-lg shadow-lg">
      <div 
        className="gap-0 bg-amber-700 p-2 rounded"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`,
          width: 'fit-content'
        }}
      >
        {board.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={getCellStyle(rowIndex, colIndex)}
              onClick={() => handleCellClick(rowIndex, colIndex)}
            >
              {renderStone(cell)}
            </div>
          ))
        )}
      </div>
      
      {currentPlayer && !disabled && (
        <div className="mt-4 text-center">
          <span className="text-white font-semibold">
            Current Player: 
            <span className={`ml-2 px-2 py-1 rounded ${
              currentPlayer === PlayerColor.BLACK ? 'bg-black text-white' : 'bg-white text-black'
            }`}>
              {currentPlayer === PlayerColor.BLACK ? 'Black' : 'White'}
            </span>
          </span>
        </div>
      )}
    </div>
  );
};