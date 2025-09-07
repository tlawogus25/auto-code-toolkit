'use client';

import React, { useState } from 'react';
import { useGameStore } from '@/store/game-store';

export default function RoomList() {
  const { rooms, playerName, joinRoom, createRoom, setPlayerName } = useGameStore();
  const [newRoomName, setNewRoomName] = useState('');
  const [tempPlayerName, setTempPlayerName] = useState(playerName);
  const [showCreateRoom, setShowCreateRoom] = useState(false);

  const handleSetPlayerName = () => {
    if (tempPlayerName.trim()) {
      setPlayerName(tempPlayerName.trim());
    }
  };

  const handleCreateRoom = () => {
    if (newRoomName.trim() && playerName) {
      createRoom(newRoomName.trim());
      setNewRoomName('');
      setShowCreateRoom(false);
    }
  };

  const handleJoinRoom = (roomId: string) => {
    if (playerName) {
      joinRoom(roomId);
    }
  };

  if (!playerName) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Enter Your Name</h3>
        <div className="space-y-4">
          <input
            type="text"
            value={tempPlayerName}
            onChange={(e) => setTempPlayerName(e.target.value)}
            placeholder="Your name"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyPress={(e) => e.key === 'Enter' && handleSetPlayerName()}
          />
          <button
            onClick={handleSetPlayerName}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors"
            disabled={!tempPlayerName.trim()}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Game Rooms</h3>
        <div className="text-sm text-gray-600">
          Playing as: <span className="font-medium">{playerName}</span>
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="flex space-x-2">
          {!showCreateRoom ? (
            <button
              onClick={() => setShowCreateRoom(true)}
              className="bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 transition-colors"
            >
              Create Room
            </button>
          ) : (
            <div className="flex space-x-2 w-full">
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Room name"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && handleCreateRoom()}
              />
              <button
                onClick={handleCreateRoom}
                className="bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 transition-colors"
                disabled={!newRoomName.trim()}
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowCreateRoom(false);
                  setNewRoomName('');
                }}
                className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {rooms.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No rooms available</p>
          ) : (
            rooms.map((room) => (
              <div
                key={room.id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-md hover:bg-gray-50"
              >
                <div className="flex-1">
                  <h4 className="font-medium">{room.name}</h4>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span>Players: {room.playerCount}/2</span>
                    <span className={`capitalize ${
                      room.status === 'playing' ? 'text-green-600' :
                      room.status === 'waiting' ? 'text-yellow-600' :
                      'text-gray-600'
                    }`}>
                      {room.status}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleJoinRoom(room.id)}
                  className="bg-blue-500 text-white py-1 px-3 rounded text-sm hover:bg-blue-600 transition-colors"
                  disabled={room.playerCount >= 2 && room.status !== 'waiting'}
                >
                  {room.playerCount >= 2 ? 'Watch' : 'Join'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}