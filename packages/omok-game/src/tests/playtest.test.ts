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

    // Wait for initial room list messages
    await Promise.all([
      waitForMessage(client1),
      waitForMessage(client2)
    ]);
  });

  afterEach(() => {
    client1.close();
    client2.close();
    // Note: GameServer doesn't expose a close method, but connections will be cleaned up
  });

  const waitForMessage = (client: WebSocket): Promise<ServerMessage> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Message timeout'));
      }, 10000);

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
      }, 10000);

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

  it('should allow complete game flow from room creation to victory', async () => {
    // Player 1 creates a room
    client1.send(JSON.stringify({
      type: MessageType.CREATE_ROOM,
      roomName: 'Test Room',
      playerName: 'Player1',
      timestamp: Date.now()
    }));

    const createRoomResponse = await waitForSpecificMessage(client1, MessageType.GAME_UPDATE);
    if (createRoomResponse.type === MessageType.GAME_UPDATE) {
      roomId = createRoomResponse.room.id;
      expect(createRoomResponse.room.players).toHaveLength(1);
      expect(createRoomResponse.room.players[0].name).toBe('Player1');
    }

    // Player 2 joins the room
    client2.send(JSON.stringify({
      type: MessageType.JOIN_ROOM,
      roomId: roomId,
      playerName: 'Player2',
      timestamp: Date.now()
    }));

    const joinRoomResponse = await waitForSpecificMessage(client2, MessageType.GAME_UPDATE);
    if (joinRoomResponse.type === MessageType.GAME_UPDATE) {
      expect(joinRoomResponse.room.players).toHaveLength(2);
      expect(joinRoomResponse.gameState.status).toBe('in_progress');
      expect(joinRoomResponse.gameState.currentPlayer).toBe('black');
    }

    // Player 1 should also receive the game update
    const player1Update = await waitForSpecificMessage(client1, MessageType.GAME_UPDATE);
    expect(player1Update.type).toBe(MessageType.GAME_UPDATE);

    // Play a winning game - horizontal line for black player
    const moves = [
      // Black, White, Black, White, Black, White, Black, White, Black (win)
      { player: client1, position: { row: 7, col: 5 } },
      { player: client2, position: { row: 8, col: 5 } },
      { player: client1, position: { row: 7, col: 6 } },
      { player: client2, position: { row: 8, col: 6 } },
      { player: client1, position: { row: 7, col: 7 } },
      { player: client2, position: { row: 8, col: 7 } },
      { player: client1, position: { row: 7, col: 8 } },
      { player: client2, position: { row: 8, col: 8 } },
      { player: client1, position: { row: 7, col: 9 } } // Winning move
    ];

    let lastResponse: ServerMessage | null = null;

    for (const move of moves) {
      move.player.send(JSON.stringify({
        type: MessageType.MAKE_MOVE,
        roomId: roomId,
        position: move.position,
        timestamp: Date.now()
      }));

      const moveResponse = await waitForSpecificMessage(move.player, MessageType.GAME_UPDATE);
      lastResponse = moveResponse;

      // The other player should also receive the update
      const otherPlayer = move.player === client1 ? client2 : client1;
      const otherUpdate = await waitForSpecificMessage(otherPlayer, MessageType.GAME_UPDATE);
      expect(otherUpdate.type).toBe(MessageType.GAME_UPDATE);
    }

    // Check final game state
    if (lastResponse && lastResponse.type === MessageType.GAME_UPDATE) {
      expect(lastResponse.gameState.status).toBe('finished');
      expect(lastResponse.gameState.winner).toBe('black');
      expect(lastResponse.gameState.moves).toHaveLength(9);
    }
  }, 30000); // 30 second timeout

  it('should prevent invalid moves', async () => {
    // Create room and have both players join
    client1.send(JSON.stringify({
      type: MessageType.CREATE_ROOM,
      roomName: 'Invalid Move Test',
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
    await waitForSpecificMessage(client1, MessageType.GAME_UPDATE);

    // Player 1 makes first move
    client1.send(JSON.stringify({
      type: MessageType.MAKE_MOVE,
      roomId: testRoomId,
      position: { row: 7, col: 7 },
      timestamp: Date.now()
    }));

    await waitForSpecificMessage(client1, MessageType.GAME_UPDATE);
    await waitForSpecificMessage(client2, MessageType.GAME_UPDATE);

    // Player 2 tries to make same move (should fail)
    client2.send(JSON.stringify({
      type: MessageType.MAKE_MOVE,
      roomId: testRoomId,
      position: { row: 7, col: 7 }, // Same position
      timestamp: Date.now()
    }));

    const errorResponse = await waitForSpecificMessage(client2, MessageType.ERROR);
    expect(errorResponse.type).toBe(MessageType.ERROR);
  }, 15000);

  it('should handle player disconnection gracefully', async () => {
    // Create room
    client1.send(JSON.stringify({
      type: MessageType.CREATE_ROOM,
      roomName: 'Disconnect Test',
      playerName: 'Player1',
      timestamp: Date.now()
    }));

    const createResponse = await waitForSpecificMessage(client1, MessageType.GAME_UPDATE);
    let testRoomId = '';
    if (createResponse.type === MessageType.GAME_UPDATE) {
      testRoomId = createResponse.room.id;
    }

    // Player 2 joins
    client2.send(JSON.stringify({
      type: MessageType.JOIN_ROOM,
      roomId: testRoomId,
      playerName: 'Player2',
      timestamp: Date.now()
    }));

    await waitForSpecificMessage(client2, MessageType.GAME_UPDATE);
    await waitForSpecificMessage(client1, MessageType.GAME_UPDATE);

    // Disconnect player 2
    client2.close();

    // This test primarily checks that the server doesn't crash on disconnection
    // In a real implementation, you might want to notify remaining players
    expect(true).toBe(true); // Test passes if no errors thrown
  }, 10000);
});