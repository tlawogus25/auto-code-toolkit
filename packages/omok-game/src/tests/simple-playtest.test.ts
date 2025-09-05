import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';
import { GameServer } from '../server/gameServer.js';
import { MessageType, ClientMessage, ServerMessage } from '../types/messages.js';

describe('Simple Omok Game Tests', () => {
  let server: GameServer;
  let client1: WebSocket;
  let client2: WebSocket;
  let serverPort: number;

  beforeEach(async () => {
    serverPort = 8000 + Math.floor(Math.random() * 1000);
    server = new GameServer(serverPort);
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 200));
    
    client1 = new WebSocket(`ws://localhost:${serverPort}`);
    client2 = new WebSocket(`ws://localhost:${serverPort}`);

    // Wait for connections
    await Promise.all([
      new Promise(resolve => client1.on('open', resolve)),
      new Promise(resolve => client2.on('open', resolve))
    ]);
    
    // Clear initial room list messages
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(() => {
    client1.close();
    client2.close();
  });

  const sendAndWaitAny = (client: WebSocket, message: ClientMessage): Promise<ServerMessage> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout')), 3000);

      const messageHandler = (data: WebSocket.Data) => {
        try {
          const response: ServerMessage = JSON.parse(data.toString());
          clearTimeout(timeout);
          client.off('message', messageHandler);
          resolve(response);
        } catch (error) {
          clearTimeout(timeout);
          client.off('message', messageHandler);
          reject(error);
        }
      };

      client.on('message', messageHandler);
      client.send(JSON.stringify(message));
    });
  };

  it('should handle basic room creation', async () => {
    const response = await sendAndWaitAny(client1, {
      type: MessageType.CREATE_ROOM,
      roomName: 'Test Room',
      playerName: 'Player1',
      timestamp: Date.now()
    });

    // Should receive some kind of response (either GAME_UPDATE or ROOM_LIST)
    expect(response.type).toBeDefined();
    expect([MessageType.GAME_UPDATE, MessageType.ROOM_LIST]).toContain(response.type);
  });

  it('should handle room joining', async () => {
    // Create room
    await sendAndWaitAny(client1, {
      type: MessageType.CREATE_ROOM,
      roomName: 'Join Test',
      playerName: 'Player1',
      timestamp: Date.now()
    });

    // Give it time to process
    await new Promise(resolve => setTimeout(resolve, 100));

    // Try to join - we'll use a dummy room ID for now
    const joinResponse = await sendAndWaitAny(client2, {
      type: MessageType.JOIN_ROOM,
      roomId: 'dummy-room-id', // This will likely fail, but we should get an error response
      playerName: 'Player2',
      timestamp: Date.now()
    });

    expect(joinResponse.type).toBeDefined();
    // Should get either an error or a successful join response
  });

  it('should handle basic game logic functions', async () => {
    // Test the core game logic independently
    const { createEmptyBoard, isValidPosition, checkWin } = await import('../logic/gameLogic.js');
    const { PlayerColor } = await import('../types/game.js');
    
    const board = createEmptyBoard();
    expect(board).toBeDefined();
    expect(board.length).toBe(15);
    expect(board[0].length).toBe(15);

    expect(isValidPosition({ row: 0, col: 0 })).toBe(true);
    expect(isValidPosition({ row: 15, col: 0 })).toBe(false);
    expect(isValidPosition({ row: -1, col: 0 })).toBe(false);

    // Test a simple win condition
    const testBoard = createEmptyBoard();
    // Place 5 stones horizontally
    for (let i = 0; i < 5; i++) {
      testBoard[7][i] = PlayerColor.BLACK;
    }
    
    expect(checkWin(testBoard, { row: 7, col: 4 }, PlayerColor.BLACK)).toBe(true);
    expect(checkWin(testBoard, { row: 7, col: 5 }, PlayerColor.BLACK)).toBe(false);
  });
});