'use client';

import React from 'react';
import { useGameStore } from '@/store/game-store';
import { Position } from '@/types/game';
import { BOARD_SIZE } from '@/lib/game-logic';

interface GameBoardProps {
  disabled?: boolean;
}

export default function GameBoard({ disabled = false }: GameBoardProps) {
  const { currentRoom, makeGameMove } = useGameStore();

  if (!currentRoom) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
        <p className="text-gray-500">No active game</p>
      </div>
    );
  }

  const { board } = currentRoom.gameState;

  const handleCellClick = (row: number, col: number) => {
    if (disabled || board[row][col] !== 'empty') {
      return;
    }

    const position: Position = { row, col };
    makeGameMove(position);
  };

  const getCellContent = (cellState: string) => {
    if (cellState === 'black') return '●';
    if (cellState === 'white') return '○';
    return '';
  };

  const getCellClass = (cellState: string) => {
    const baseClass = 'w-8 h-8 border border-gray-400 flex items-center justify-center cursor-pointer text-xl font-bold transition-colors hover:bg-gray-100';
    
    if (cellState === 'black') return `${baseClass} text-black`;
    if (cellState === 'white') return `${baseClass} text-gray-600`;
    return baseClass;
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div 
        className="inline-block bg-amber-100 p-4 rounded-lg shadow-lg"
        style={{ 
          display: 'grid', 
          gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`,
          gap: '1px',
          backgroundColor: '#d97706'
        }}
      >
        {board.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <button
              key={`${rowIndex}-${colIndex}`}
              className={getCellClass(cell)}
              onClick={() => handleCellClick(rowIndex, colIndex)}
              disabled={disabled || cell !== 'empty'}
              style={{ backgroundColor: '#fef3c7' }}
            >
              {getCellContent(cell)}
            </button>
          ))
        )}
      </div>
      
      <div className="text-sm text-gray-600 text-center">
        <p>Click on an empty cell to make a move</p>
        <p>Get 5 in a row to win!</p>
      </div>
    </div>
  );
}