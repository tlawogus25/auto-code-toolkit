import React, { useState } from 'react';
import { Room, GameStatus } from '../types/game.js';

interface RoomManagerProps {
  rooms: Room[];
  onCreateRoom: (roomName: string, playerName: string) => void;
  onJoinRoom: (roomId: string, playerName: string) => void;
  isConnected: boolean;
}

export const RoomManager: React.FC<RoomManagerProps> = ({
  rooms,
  onCreateRoom,
  onJoinRoom,
  isConnected
}) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [joinPlayerName, setJoinPlayerName] = useState('');

  const handleCreateRoom = () => {
    if (roomName.trim() && playerName.trim()) {
      onCreateRoom(roomName.trim(), playerName.trim());
      setRoomName('');
      setPlayerName('');
      setShowCreateForm(false);
    }
  };

  const handleJoinRoom = (roomId: string) => {
    if (joinPlayerName.trim()) {
      onJoinRoom(roomId, joinPlayerName.trim());
      setJoinPlayerName('');
    }
  };

  const getStatusColor = (status: GameStatus) => {
    switch (status) {
      case GameStatus.WAITING:
        return 'text-yellow-600';
      case GameStatus.IN_PROGRESS:
        return 'text-green-600';
      case GameStatus.FINISHED:
        return 'text-gray-600';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusText = (status: GameStatus) => {
    switch (status) {
      case GameStatus.WAITING:
        return 'Waiting for players';
      case GameStatus.IN_PROGRESS:
        return 'Game in progress';
      case GameStatus.FINISHED:
        return 'Game finished';
      default:
        return 'Unknown';
    }
  };

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Connecting to server...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-4">
          Omok Game Rooms
        </h1>
        
        <div className="text-center">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
          >
            {showCreateForm ? 'Cancel' : 'Create New Room'}
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Create New Room</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Room Name
              </label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter room name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your name"
              />
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={handleCreateRoom}
              disabled={!roomName.trim() || !playerName.trim()}
              className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg transition-colors"
            >
              Create Room
            </button>
          </div>
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Your Name (for joining rooms)
        </label>
        <input
          type="text"
          value={joinPlayerName}
          onChange={(e) => setJoinPlayerName(e.target.value)}
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter your name to join rooms"
        />
      </div>

      <div className="bg-white rounded-lg shadow-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Available Rooms ({rooms.length})</h2>
        </div>
        
        {rooms.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No rooms available. Create one to get started!
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {rooms.map((room) => (
              <div key={room.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900">
                      {room.name}
                    </h3>
                    <div className="mt-1 flex items-center space-x-4">
                      <span className={`text-sm font-medium ${getStatusColor(room.gameState.status)}`}>
                        {getStatusText(room.gameState.status)}
                      </span>
                      <span className="text-sm text-gray-500">
                        Players: {room.players.length}/{room.maxPlayers}
                      </span>
                      {room.players.length > 0 && (
                        <span className="text-sm text-gray-500">
                          {room.players.map(p => p.name).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="ml-4">
                    {room.players.length < room.maxPlayers && room.gameState.status === GameStatus.WAITING ? (
                      <button
                        onClick={() => handleJoinRoom(room.id)}
                        disabled={!joinPlayerName.trim()}
                        className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md transition-colors"
                      >
                        Join Room
                      </button>
                    ) : (
                      <span className="text-sm text-gray-500 px-4 py-2">
                        {room.players.length >= room.maxPlayers ? 'Full' : 'In Progress'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};