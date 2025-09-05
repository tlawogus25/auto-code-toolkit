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

  afterEach(() => {
    client1.close();
    client2.close();
    // Note: GameServer doesn't expose a close method, but connections will be cleaned up
  });

  const sendMessage = (client: WebSocket, message: ClientMessage, expectedType?: MessageType): Promise<ServerMessage> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Message timeout'));
      }, 5000);

      const messageHandler = (data: WebSocket.Data) => {
        try {
          const response: ServerMessage = JSON.parse(data.toString());
          
          // If we're looking for a specific message type, keep listening until we get it
          if (expectedType && response.type !== expectedType) {
            return; // Keep listening
          }
          
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

  const waitForMessage = (client: WebSocket, expectedType?: MessageType): Promise<ServerMessage> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Message timeout'));
      }, 5000);

      const messageHandler = (data: WebSocket.Data) => {
        try {
          const response: ServerMessage = JSON.parse(data.toString());
          
          // If we're looking for a specific message type, keep listening until we get it
          if (expectedType && response.type !== expectedType) {
            return; // Keep listening
          }
          
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

  it('should allow complete game flow from room creation to victory', async () => {
    // Player 1 creates a room
    const createRoomResponse = await sendMessage(client1, {
      type: MessageType.CREATE_ROOM,
      roomName: 'Test Room',
      playerName: 'Player1',
      timestamp: Date.now()
    }, MessageType.GAME_UPDATE);

    expect(createRoomResponse.type).toBe(MessageType.GAME_UPDATE);
    if (createRoomResponse.type === MessageType.GAME_UPDATE) {
      roomId = createRoomResponse.room.id;
      expect(createRoomResponse.room.players).toHaveLength(1);
      expect(createRoomResponse.room.players[0].name).toBe('Player1');
    }

    // Player 2 joins the room
    const joinRoomResponse = await sendMessage(client2, {
      type: MessageType.JOIN_ROOM,
      roomId: roomId,
      playerName: 'Player2',
      timestamp: Date.now()
    }, MessageType.GAME_UPDATE);

    expect(joinRoomResponse.type).toBe(MessageType.GAME_UPDATE);
    if (joinRoomResponse.type === MessageType.GAME_UPDATE) {
      expect(joinRoomResponse.room.players).toHaveLength(2);
      expect(joinRoomResponse.gameState.status).toBe('in_progress');
      expect(joinRoomResponse.gameState.currentPlayer).toBe('black');
    }

    // Player 1 should also receive the game update
    const player1Update = await waitForMessage(client1, MessageType.GAME_UPDATE);
    expect(player1Update.type).toBe(MessageType.GAME_UPDATE);

    // Play a winning game - horizontal line for black player
    const moves = [
      // Player 1 (Black) moves
      { player: client1, position: { row: 7, col: 5 } },
      // Player 2 (White) moves  
      { player: client2, position: { row: 8, col: 5 } },
      // Player 1 (Black)
      { player: client1, position: { row: 7, col: 6 } },
      // Player 2 (White)
      { player: client2, position: { row: 8, col: 6 } },
      // Player 1 (Black)
      { player: client1, position: { row: 7, col: 7 } },
      // Player 2 (White)
      { player: client2, position: { row: 8, col: 7 } },
      // Player 1 (Black)
      { player: client1, position: { row: 7, col: 8 } },
      // Player 2 (White)
      { player: client2, position: { row: 8, col: 8 } },
      // Player 1 (Black) - winning move
      { player: client1, position: { row: 7, col: 9 } }
    ];

    let lastResponse: ServerMessage | null = null;

    for (const move of moves) {
      const moveResponse = await sendMessage(move.player, {
        type: MessageType.MAKE_MOVE,
        roomId: roomId,
        position: move.position,
        timestamp: Date.now()
      }, MessageType.GAME_UPDATE);

      expect(moveResponse.type).toBe(MessageType.GAME_UPDATE);
      lastResponse = moveResponse;

      // The other player should also receive the update
      const otherPlayer = move.player === client1 ? client2 : client1;
      const otherUpdate = await waitForMessage(otherPlayer, MessageType.GAME_UPDATE);
      expect(otherUpdate.type).toBe(MessageType.GAME_UPDATE);
    }

    // Check final game state
    if (lastResponse && lastResponse.type === MessageType.GAME_UPDATE) {
      expect(lastResponse.gameState.status).toBe('finished');
      expect(lastResponse.gameState.winner).toBe('black');
      expect(lastResponse.gameState.moves).toHaveLength(9);
    }
  });

  it('should prevent invalid moves', async () => {
    // Create room and have both players join
    const createResponse = await sendMessage(client1, {
      type: MessageType.CREATE_ROOM,
      roomName: 'Invalid Move Test',
      playerName: 'Player1',
      timestamp: Date.now()
    }, MessageType.GAME_UPDATE);

    if (createResponse.type === MessageType.GAME_UPDATE) {
      roomId = createResponse.room.id;
    }

    const joinResponse = await sendMessage(client2, {
      type: MessageType.JOIN_ROOM,
      roomId: roomId || 'test',  
      playerName: 'Player2',
      timestamp: Date.now()
    }, MessageType.GAME_UPDATE);

    await waitForMessage(client1, MessageType.GAME_UPDATE);

    // Player 1 makes first move
    await sendMessage(client1, {
      type: MessageType.MAKE_MOVE,
      roomId: roomId,
      position: { row: 7, col: 7 },
      timestamp: Date.now()
    }, MessageType.GAME_UPDATE);

    await waitForMessage(client2, MessageType.GAME_UPDATE);

    // Player 1 tries to move again (should fail - not their turn)
    const invalidTurnResponse = await sendMessage(client1, {
      type: MessageType.MAKE_MOVE,
      roomId: roomId,
      position: { row: 8, col: 8 },
      timestamp: Date.now()
    }, MessageType.ERROR);

    expect(invalidTurnResponse.type).toBe(MessageType.ERROR);
    if (invalidTurnResponse.type === MessageType.ERROR) {
      expect(invalidTurnResponse.message).toContain('Not your turn');
    }

    // Player 2 tries to place stone in occupied position
    const occupiedPositionResponse = await sendMessage(client2, {
      type: MessageType.MAKE_MOVE,
      roomId: roomId,
      position: { row: 7, col: 7 }, // Same position as Player 1
      timestamp: Date.now()
    }, MessageType.ERROR);

    expect(occupiedPositionResponse.type).toBe(MessageType.ERROR);
    if (occupiedPositionResponse.type === MessageType.ERROR) {
      expect(occupiedPositionResponse.message).toContain('occupied');
    }
  });

  it('should handle player disconnection gracefully', async () => {
    // Create room with both players
    const createResponse = await sendMessage(client1, {
      type: MessageType.CREATE_ROOM,
      roomName: 'Disconnect Test',
      playerName: 'Player1',
      timestamp: Date.now()
    }, MessageType.GAME_UPDATE);

    if (createResponse.type === MessageType.GAME_UPDATE) {
      roomId = createResponse.room.id;
    }

    await sendMessage(client2, {
      type: MessageType.JOIN_ROOM,
      roomId: roomId,
      playerName: 'Player2', 
      timestamp: Date.now()
    }, MessageType.GAME_UPDATE);

    await waitForMessage(client1, MessageType.GAME_UPDATE);

    // Player 1 leaves the room
    await sendMessage(client1, {
      type: MessageType.LEAVE_ROOM,
      roomId: roomId,
      timestamp: Date.now()
    }, MessageType.GAME_UPDATE);

    // Player 2 should receive an update showing the room now has only 1 player
    const updateAfterLeave = await waitForMessage(client2, MessageType.GAME_UPDATE);
    expect(updateAfterLeave.type).toBe(MessageType.GAME_UPDATE);
    if (updateAfterLeave.type === MessageType.GAME_UPDATE) {
      expect(updateAfterLeave.room.players).toHaveLength(1);
      expect(updateAfterLeave.gameState.status).toBe('waiting');
    }
  });
});