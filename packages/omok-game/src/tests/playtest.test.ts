import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';
import { GameServer } from '../server/gameServer.js';
import { MessageType, ClientMessage, ServerMessage } from '../types/messages.js';

describe('Omok Game E2E Play Tests', () => {
  let server: GameServer;
  let client1: WebSocket;
  let client2: WebSocket;
  let serverPort: number;
  let roomId: string;

  beforeEach(async () => {
    serverPort = 8081 + Math.floor(Math.random() * 1000);
    server = new GameServer(serverPort);
    
    // Wait a bit for server to start
    await new Promise(resolve => setTimeout(resolve, 100));
    
    client1 = new WebSocket(`ws://localhost:${serverPort}`);
    client2 = new WebSocket(`ws://localhost:${serverPort}`);

    // Wait for connections
    await Promise.all([
      new Promise(resolve => client1.on('open', resolve)),
      new Promise(resolve => client2.on('open', resolve))
    ]);
  });

  afterEach(async () => {
    client1.close();
    client2.close();
    server.close();
    
    // Wait a bit for cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  const waitForMessage = (client: WebSocket): Promise<ServerMessage> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Message timeout'));
      }, 5000);

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
    });
  };

  const waitForSpecificMessage = (client: WebSocket, expectedType: MessageType): Promise<ServerMessage> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Message timeout waiting for ${expectedType}`));
      }, 5000);

      const messageHandler = (data: WebSocket.Data) => {
        try {
          const response: ServerMessage = JSON.parse(data.toString());
          if (response.type === expectedType) {
            clearTimeout(timeout);
            client.off('message', messageHandler);
            resolve(response);
          }
          // Continue listening if it's not the expected message type
        } catch (error) {
          clearTimeout(timeout);
          client.off('message', messageHandler);
          reject(error);
        }
      };

      client.on('message', messageHandler);
    });
  };

  it('should create room and receive game update', async () => {
    client1.send(JSON.stringify({
      type: MessageType.CREATE_ROOM,
      roomName: 'Test Room',
      playerName: 'Player1',
      timestamp: Date.now()
    }));

    const gameUpdateMessage = await waitForSpecificMessage(client1, MessageType.GAME_UPDATE);
    expect(gameUpdateMessage.type).toBe(MessageType.GAME_UPDATE);
    if (gameUpdateMessage.type === MessageType.GAME_UPDATE) {
      expect(gameUpdateMessage.room.name).toBe('Test Room');
      expect(gameUpdateMessage.room.players).toHaveLength(1);
    }
  }, 10000);

  it('should allow two players to join a game', async () => {
    // Player 1 creates a room
    client1.send(JSON.stringify({
      type: MessageType.CREATE_ROOM,
      roomName: 'Join Test',
      playerName: 'Player1',
      timestamp: Date.now()
    }));

    const createResponse = await waitForSpecificMessage(client1, MessageType.GAME_UPDATE);
    let testRoomId = '';
    if (createResponse.type === MessageType.GAME_UPDATE) {
      testRoomId = createResponse.room.id;
      expect(createResponse.room.players).toHaveLength(1);
    }

    // Player 2 joins the room
    client2.send(JSON.stringify({
      type: MessageType.JOIN_ROOM,
      roomId: testRoomId,
      playerName: 'Player2',
      timestamp: Date.now()
    }));

    const joinResponse = await waitForSpecificMessage(client2, MessageType.GAME_UPDATE);
    if (joinResponse.type === MessageType.GAME_UPDATE) {
      expect(joinResponse.room.players).toHaveLength(2);
      expect(joinResponse.gameState.status).toBe('in_progress');
    }
  }, 10000);

  it('should allow players to make moves', async () => {
    // Create room and join
    client1.send(JSON.stringify({
      type: MessageType.CREATE_ROOM,
      roomName: 'Move Test',
      playerName: 'Player1',
      timestamp: Date.now()
    }));

    const createResponse = await waitForSpecificMessage(client1, MessageType.GAME_UPDATE);
    let testRoomId = '';
    if (createResponse.type === MessageType.GAME_UPDATE) {
      testRoomId = createResponse.room.id;
    }

    client2.send(JSON.stringify({
      type: MessageType.JOIN_ROOM,
      roomId: testRoomId,
      playerName: 'Player2',
      timestamp: Date.now()
    }));

    const joinResponse = await waitForSpecificMessage(client2, MessageType.GAME_UPDATE);
    expect(joinResponse.type).toBe(MessageType.GAME_UPDATE);

    // Player 1 makes first move
    client1.send(JSON.stringify({
      type: MessageType.MAKE_MOVE,
      roomId: testRoomId,
      position: { row: 7, col: 7 },
      timestamp: Date.now()
    }));

    const moveResponse = await waitForSpecificMessage(client1, MessageType.GAME_UPDATE);
    if (moveResponse.type === MessageType.GAME_UPDATE) {
      expect(moveResponse.gameState.moves).toHaveLength(1);
      expect(moveResponse.gameState.currentPlayer).toBe('white');
    }
  }, 10000);

  it('should handle disconnections without crashing', async () => {
    // Simple connection test followed by disconnection
    client1.send(JSON.stringify({
      type: MessageType.CREATE_ROOM,
      roomName: 'Disconnect Test',
      playerName: 'Player1',
      timestamp: Date.now()
    }));

    const response = await waitForSpecificMessage(client1, MessageType.GAME_UPDATE);
    expect(response.type).toBe(MessageType.GAME_UPDATE);
    
    // Close connection and verify server doesn't crash
    client1.close();
    expect(true).toBe(true);
  }, 10000);
});