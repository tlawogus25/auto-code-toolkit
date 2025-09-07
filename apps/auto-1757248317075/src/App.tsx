import React, { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useGameStore } from './gameStore';
import { RoomSelection } from './components/RoomSelection';
import { GameBoard } from './components/GameBoard';
import { GameStatus } from './components/GameStatus';

function App() {
  const { 
    socket, 
    setSocket, 
    setConnected, 
    handleMessage, 
    roomId,
    setError 
  } = useGameStore();

  useEffect(() => {
    const newSocket = io('http://localhost:3001', {
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
      setError(null);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
      setError('서버와의 연결이 끊어졌습니다.');
    });

    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setError('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
    });

    newSocket.on('message', (message) => {
      console.log('Received message:', message);
      handleMessage(message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [setSocket, setConnected, handleMessage, setError]);

  if (!roomId) {
    return <RoomSelection />;
  }

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '800px', 
      margin: '0 auto',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <h1 style={{ textAlign: 'center', marginBottom: '20px' }}>오목 게임</h1>
      <GameStatus />
      <GameBoard />
    </div>
  );
}

export default App;