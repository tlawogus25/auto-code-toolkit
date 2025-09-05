'use client';

import { OmokGame } from '../../../src/components/OmokGame';
import { useEffect } from 'react';
import { useGameStore } from '../../../src/store/gameStore';
import { gameClient } from '../../../src/client/websocketClient';

interface GamePageProps {
  params: {
    roomId: string;
  };
}

export default function GamePage({ params }: GamePageProps) {
  const { roomId } = params;
  const { setCurrentRoom } = useGameStore();

  useEffect(() => {
    // Auto-join room if roomId is provided in URL
    // This would be implemented based on your room joining logic
    console.log('Joining room:', roomId);
  }, [roomId]);

  return (
    <main>
      <div className="container mx-auto py-8 px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Omok Game
          </h1>
          <p className="text-gray-600">
            Room ID: <span className="font-mono text-sm">{roomId}</span>
          </p>
        </div>
        <OmokGame />
      </div>
    </main>
  );
}