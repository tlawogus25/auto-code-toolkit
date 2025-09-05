import React from 'react';
import { Room, PlayerColor, GameStatus as GameStatusEnum } from '../types/game.js';

interface GameStatusProps {
  room: Room;
  playerId: string | null;
  onLeaveRoom: () => void;
}

export const GameStatus: React.FC<GameStatusProps> = ({
  room,
  playerId,
  onLeaveRoom
}) => {
  const { gameState, players } = room;
  const currentPlayer = players.find(p => p.id === playerId);
  const isCurrentPlayerTurn = currentPlayer && gameState.currentPlayer === currentPlayer.color;

  const getStatusMessage = () => {
    switch (gameState.status) {
      case GameStatusEnum.WAITING:
        return 'Waiting for another player to join...';
      case GameStatusEnum.IN_PROGRESS:
        if (gameState.winner) {
          const winnerPlayer = players.find(p => p.color === gameState.winner);
          return `Game Over! ${winnerPlayer?.name || 'Unknown'} (${gameState.winner}) wins!`;
        }
        const currentPlayerName = players.find(p => p.color === gameState.currentPlayer)?.name || 'Unknown';
        return `${currentPlayerName}'s turn (${gameState.currentPlayer})`;
      case GameStatusEnum.FINISHED:
        if (gameState.winner) {
          const winnerPlayer = players.find(p => p.color === gameState.winner);
          return `🎉 Game Over! ${winnerPlayer?.name || 'Unknown'} (${gameState.winner}) wins!`;
        }
        return `Game Over! It's a draw!`;
      default:
        return 'Unknown game status';
    }
  };

  const getStatusColor = () => {
    switch (gameState.status) {
      case GameStatusEnum.WAITING:
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case GameStatusEnum.IN_PROGRESS:
        if (isCurrentPlayerTurn) {
          return 'text-green-600 bg-green-50 border-green-200';
        }
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case GameStatusEnum.FINISHED:
        return 'text-purple-600 bg-purple-50 border-purple-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const renderPlayerInfo = (player: any, index: number) => {
    const isYou = player.id === playerId;
    const isActive = gameState.currentPlayer === player.color && gameState.status === GameStatusEnum.IN_PROGRESS;
    
    return (
      <div
        key={player.id}
        className={`
          flex items-center space-x-3 p-3 rounded-lg border
          ${isActive ? 'bg-yellow-50 border-yellow-300' : 'bg-white border-gray-200'}
        `}
      >
        <div
          className={`
            w-6 h-6 rounded-full
            ${player.color === PlayerColor.BLACK ? 'bg-black' : 'bg-white border-2 border-gray-400'}
          `}
        />
        <div className="flex-1">
          <span className={`font-medium ${isActive ? 'text-yellow-800' : 'text-gray-800'}`}>
            {player.name} {isYou && '(You)'}
          </span>
          <div className="text-sm text-gray-500">
            {player.color} player
          </div>
        </div>
        {isActive && (
          <div className="text-sm font-medium text-yellow-600">
            Active
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          {room.name}
        </h2>
        <div className={`inline-flex items-center px-4 py-2 rounded-full border text-sm font-medium ${getStatusColor()}`}>
          {getStatusMessage()}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-800">Players</h3>
        {players.map(renderPlayerInfo)}
      </div>

      {gameState.moves.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-800">Game Info</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total Moves:</span>
                <span className="ml-2 font-medium">{gameState.moves.length}</span>
              </div>
              <div>
                <span className="text-gray-600">Room ID:</span>
                <span className="ml-2 font-mono text-xs">{room.id}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {gameState.status === GameStatusEnum.FINISHED && gameState.winner && (
        <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-lg p-4 text-center">
          <div className="text-white text-lg font-bold">
            🏆 Victory! 🏆
          </div>
          <div className="text-white text-sm mt-1">
            {players.find(p => p.color === gameState.winner)?.name} wins with {gameState.winner} stones!
          </div>
        </div>
      )}

      <div className="pt-4 border-t">
        <button
          onClick={onLeaveRoom}
          className="w-full bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg transition-colors"
        >
          Leave Room
        </button>
      </div>
    </div>
  );
};