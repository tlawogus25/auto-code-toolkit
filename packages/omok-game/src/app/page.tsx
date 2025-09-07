'use client';

import React, { useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useGameStore } from '@/store/game-store';
import GameBoard from '@/components/GameBoard';
import GameInfo from '@/components/GameInfo';
import RoomList from '@/components/RoomList';

const WS_URL = 'ws://localhost:8080';

export default function HomePage() {
  const { currentRoom, leaveRoom } = useGameStore();
  
  useWebSocket(WS_URL);

  const handleLeaveRoom = () => {
    leaveRoom();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {!currentRoom ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <RoomList />
          <GameInfo />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Room: {currentRoom.name}</h2>
            <button
              onClick={handleLeaveRoom}
              className="bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600 transition-colors"
            >
              Leave Room
            </button>
          </div>
          
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
            <div className="xl:col-span-3">
              <GameBoard />
            </div>
            <div className="xl:col-span-1">
              <GameInfo />
            </div>
          </div>
        </div>
      )}

      <div className="text-center text-sm text-gray-500">
        <p>Make sure the WebSocket server is running on port 8080</p>
        <p>Run: <code className="bg-gray-200 px-2 py-1 rounded">npm run server</code></p>
      </div>
    </div>
  );
}