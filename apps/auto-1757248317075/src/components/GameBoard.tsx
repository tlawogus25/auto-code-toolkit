import React from 'react';
import { useGameStore } from '../gameStore';
import { BOARD_SIZE } from '../gameLogic';
import { Position } from '../types';

export const GameBoard: React.FC = () => {
  const { board, makeMove, currentPlayer, players, gameStarted, winner } = useGameStore();
  
  const currentPlayerId = Object.keys(players).find(
    id => players[id].stone === currentPlayer
  );

  const handleCellClick = (row: number, col: number) => {
    if (!gameStarted || winner || board[row][col] !== null) {
      return;
    }

    const position: Position = { row, col };
    makeMove(position);
  };

  const getCellStyle = (row: number, col: number) => {
    const stone = board[row][col];
    const baseStyle = {
      width: '30px',
      height: '30px',
      border: '1px solid #999',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: gameStarted && !winner && !stone ? 'pointer' : 'default',
      backgroundColor: '#deb887',
      position: 'relative' as const,
    };

    if (stone) {
      return {
        ...baseStyle,
        cursor: 'default',
      };
    }

    return baseStyle;
  };

  const getStoneStyle = (stone: 'black' | 'white') => ({
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: stone === 'black' ? '#000' : '#fff',
    border: stone === 'white' ? '1px solid #999' : 'none',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: `repeat(${BOARD_SIZE}, 30px)`,
        gap: '1px',
        padding: '10px',
        backgroundColor: '#8b7355',
        borderRadius: '8px',
      }}>
        {board.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              style={getCellStyle(rowIndex, colIndex)}
              onClick={() => handleCellClick(rowIndex, colIndex)}
            >
              {cell && <div style={getStoneStyle(cell)} />}
            </div>
          ))
        )}
      </div>
      
      {gameStarted && !winner && (
        <div style={{ 
          padding: '10px 20px', 
          backgroundColor: currentPlayer === 'black' ? '#333' : '#f5f5f5',
          color: currentPlayer === 'black' ? 'white' : 'black',
          borderRadius: '4px',
          fontSize: '16px',
          fontWeight: 'bold'
        }}>
          {currentPlayer === 'black' ? '흑돌' : '백돌'} 차례
          {currentPlayerId && players[currentPlayerId] && 
            ` (${players[currentPlayerId].name})`
          }
        </div>
      )}
    </div>
  );
};