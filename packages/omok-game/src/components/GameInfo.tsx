'use client';

import React from 'react';
import { useGameStore } from '@/store/game-store';

export default function GameInfo() {
  const { currentRoom, isConnected } = useGameStore();

  if (!currentRoom) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Game Status</h3>
        <div className="space-y-2">
          <p className="text-gray-600">No active game</p>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-600">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const { gameState } = currentRoom;
  const { status, currentPlayer, winner, players, moveHistory } = gameState;

  const getStatusText = () => {
    switch (status) {
      case 'waiting':
        return 'Waiting for players...';
      case 'playing':
        return `${currentPlayer === 'black' ? 'Black' : 'White'}'s turn`;
      case 'finished':
        return winner ? `${winner === 'black' ? 'Black' : 'White'} wins!` : 'Game finished';
      default:
        return 'Unknown status';
    }
  };

  const getPlayerColor = (playerId: string | null) => {
    if (players.black === playerId) return 'black';
    if (players.white === playerId) return 'white';
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
      <h3 className="text-lg font-semibold">Game Info</h3>
      
      <div className="space-y-3">
        <div>
          <h4 className="font-medium text-gray-700">Room</h4>
          <p className="text-gray-600">{currentRoom.name}</p>
        </div>
        
        <div>
          <h4 className="font-medium text-gray-700">Status</h4>
          <p className={`font-medium ${
            status === 'finished' && winner 
              ? winner === 'black' ? 'text-black' : 'text-gray-600'
              : 'text-blue-600'
          }`}>
            {getStatusText()}
          </p>
        </div>
        
        <div>
          <h4 className="font-medium text-gray-700">Players</h4>
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded-full bg-black"></div>
              <span className="text-sm">
                Black: {players.black ? 'Player 1' : 'Empty'}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded-full border-2 border-gray-600 bg-white"></div>
              <span className="text-sm">
                White: {players.white ? 'Player 2' : 'Empty'}
              </span>
            </div>
          </div>
        </div>
        
        <div>
          <h4 className="font-medium text-gray-700">Moves</h4>
          <p className="text-sm text-gray-600">{moveHistory.length} moves made</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-600">
            {isConnected ? 'Connected' : 'Reconnecting...'}
          </span>
        </div>
      </div>
    </div>
  );
}