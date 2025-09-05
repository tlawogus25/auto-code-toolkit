import React, { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore.js';
import { gameClient } from '../client/websocketClient.js';
import { RoomManager } from './RoomManager.js';
import { GameBoard } from './GameBoard.js';
import { GameStatus } from './GameStatus.js';
import { GameStatus as GameStatusEnum } from '../types/game.js';

export const OmokGame: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  
  const {
    currentRoom,
    playerId,
    playerName,
    isConnected,
    rooms
  } = useGameStore();

  useEffect(() => {
    const initializeConnection = async () => {
      try {
        await gameClient.connect();
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to connect to game server:', error);
        // You could show an error message to the user here
      }
    };

    if (!isInitialized) {
      initializeConnection();
    }

    return () => {
      gameClient.disconnect();
    };
  }, [isInitialized]);

  const handleCreateRoom = (roomName: string, playerName: string) => {
    gameClient.createRoom(roomName, playerName);
    // Store player info locally
    const playerId = Math.random().toString(36).substring(2, 15);
    useGameStore.getState().setPlayer(playerId, playerName);
  };

  const handleJoinRoom = (roomId: string, playerName: string) => {
    gameClient.joinRoom(roomId, playerName);
    // Store player info locally
    const playerId = Math.random().toString(36).substring(2, 15);
    useGameStore.getState().setPlayer(playerId, playerName);
  };

  const handleLeaveRoom = () => {
    if (currentRoom) {
      gameClient.leaveRoom(currentRoom.id);
      useGameStore.getState().setCurrentRoom(null);
    }
  };

  const handleMakeMove = (position: { row: number; col: number }) => {
    if (currentRoom) {
      gameClient.makeMove(currentRoom.id, position.row, position.col);
    }
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-700">Connecting to Omok Server...</h2>
          <p className="text-gray-500 mt-2">Please wait while we establish connection</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto py-8 px-4">
        {!currentRoom ? (
          <RoomManager
            rooms={rooms}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            isConnected={isConnected}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Game Status Sidebar */}
            <div className="lg:col-span-1 order-2 lg:order-1">
              <GameStatus
                room={currentRoom}
                playerId={playerId}
                onLeaveRoom={handleLeaveRoom}
              />
            </div>

            {/* Game Board */}
            <div className="lg:col-span-2 order-1 lg:order-2 flex justify-center items-start">
              <div className="bg-white p-6 rounded-lg shadow-lg">
                <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
                  {currentRoom.name}
                </h2>
                
                <GameBoard
                  board={currentRoom.gameState.board}
                  onCellClick={handleMakeMove}
                  disabled={
                    currentRoom.gameState.status !== GameStatusEnum.IN_PROGRESS ||
                    !playerId ||
                    !currentRoom.players.find(p => p.id === playerId) ||
                    currentRoom.gameState.currentPlayer !== 
                      currentRoom.players.find(p => p.id === playerId)?.color
                  }
                  currentPlayer={currentRoom.gameState.currentPlayer}
                />

                {currentRoom.gameState.status === GameStatusEnum.FINISHED && (
                  <div className="mt-6 text-center">
                    <div className="bg-gradient-to-r from-green-400 to-blue-500 text-white p-4 rounded-lg">
                      {currentRoom.gameState.winner ? (
                        <div>
                          <h3 className="text-xl font-bold">🎉 Game Over! 🎉</h3>
                          <p className="mt-1">
                            {currentRoom.players.find(p => p.color === currentRoom.gameState.winner)?.name || 'Unknown'} 
                            {' '}({currentRoom.gameState.winner}) wins!
                          </p>
                        </div>
                      ) : (
                        <div>
                          <h3 className="text-xl font-bold">Game Over!</h3>
                          <p className="mt-1">It's a draw!</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Connection Status Indicator */}
      <div className="fixed bottom-4 right-4">
        <div className={`px-3 py-2 rounded-full text-sm font-medium ${
          isConnected 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
      </div>
    </div>
  );
};