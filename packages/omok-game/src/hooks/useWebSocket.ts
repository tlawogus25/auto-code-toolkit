import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '@/store/game-store';
import { WebSocketMessage } from '@/types/websocket';

export function useWebSocket(url: string) {
  const socketRef = useRef<WebSocket | null>(null);
  const {
    setSocket,
    setIsConnected,
    setRooms,
    updateGameState,
    setCurrentRoom,
  } = useGameStore();

  const handleMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'room_list':
        setRooms(message.payload.rooms);
        break;
      case 'game_update':
        updateGameState(message.payload.gameState);
        break;
      case 'error':
        console.error('WebSocket error:', message.payload.message);
        break;
      default:
        console.log('Unhandled message type:', message.type);
    }
  }, [setRooms, updateGameState]);

  useEffect(() => {
    const connect = () => {
      socketRef.current = new WebSocket(url);
      const socket = socketRef.current;

      socket.onopen = () => {
        console.log('WebSocket connected');
        setSocket(socket);
        setIsConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      socket.onclose = () => {
        console.log('WebSocket disconnected');
        setSocket(null);
        setIsConnected(false);
        
        // Attempt to reconnect after 3 seconds
        setTimeout(connect, 3000);
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    };

    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [url, setSocket, setIsConnected, handleMessage]);

  return socketRef.current;
}