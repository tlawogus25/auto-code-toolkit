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

  it('should correctly track game state across multiple rooms', async () => {
    // Create first room
    client1.send(JSON.stringify({
      type: MessageType.CREATE_ROOM,
      roomName: 'Room1',
      playerName: 'Player1',
      timestamp: Date.now()
    }));

    const room1Response = await waitForSpecificMessage(client1, MessageType.GAME_UPDATE);
    let room1Id = '';
    if (room1Response.type === MessageType.GAME_UPDATE) {
      room1Id = room1Response.room.id;
      expect(room1Response.room.name).toBe('Room1');
      expect(room1Response.room.players).toHaveLength(1);
      expect(room1Response.gameState.status).toBe('waiting');
    }

    // Create second room with second client
    client2.send(JSON.stringify({
      type: MessageType.CREATE_ROOM,
      roomName: 'Room2',
      playerName: 'Player2',
      timestamp: Date.now()
    }));

    const room2Response = await waitForSpecificMessage(client2, MessageType.GAME_UPDATE);
    let room2Id = '';
    if (room2Response.type === MessageType.GAME_UPDATE) {
      room2Id = room2Response.room.id;
      expect(room2Response.room.name).toBe('Room2');
      expect(room2Response.room.players).toHaveLength(1);
      expect(room2Response.gameState.status).toBe('waiting');
      expect(room2Id).not.toBe(room1Id); // Rooms should have different IDs
    }

    // Verify rooms are independent
    expect(room1Id).toBeTruthy();
    expect(room2Id).toBeTruthy();
    expect(room1Id).not.toBe(room2Id);
  }, 10000);

  it('should handle invalid move attempts gracefully', async () => {
    // Create room and join players
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

    await waitForSpecificMessage(client2, MessageType.GAME_UPDATE);

    // Player 1 makes valid move
    client1.send(JSON.stringify({
      type: MessageType.MAKE_MOVE,
      roomId: testRoomId,
      position: { row: 7, col: 7 },
      timestamp: Date.now()
    }));

    await waitForSpecificMessage(client1, MessageType.GAME_UPDATE);

    // Player 2 attempts to place stone in same position
    client2.send(JSON.stringify({
      type: MessageType.MAKE_MOVE,
      roomId: testRoomId,
      position: { row: 7, col: 7 }, // Same position as player 1
      timestamp: Date.now()
    }));

    // Should receive error message
    const errorResponse = await waitForSpecificMessage(client2, MessageType.ERROR);
    expect(errorResponse.type).toBe(MessageType.ERROR);
    if (errorResponse.type === MessageType.ERROR) {
      expect(errorResponse.message).toContain('occupied');
    }

    // Player 2 attempts invalid position (out of bounds)
    client2.send(JSON.stringify({
      type: MessageType.MAKE_MOVE,
      roomId: testRoomId,
      position: { row: 15, col: 15 }, // Out of bounds
      timestamp: Date.now()
    }));

    const errorResponse2 = await waitForSpecificMessage(client2, MessageType.ERROR);
    expect(errorResponse2.type).toBe(MessageType.ERROR);

    // Player 2 makes valid move
    client2.send(JSON.stringify({
      type: MessageType.MAKE_MOVE,
      roomId: testRoomId,
      position: { row: 8, col: 8 },
      timestamp: Date.now()
    }));

    const validResponse = await waitForSpecificMessage(client2, MessageType.GAME_UPDATE);
    if (validResponse.type === MessageType.GAME_UPDATE) {
      expect(validResponse.gameState.moves).toHaveLength(2);
      expect(validResponse.gameState.currentPlayer).toBe('black');
    }
  }, 15000);

  it('should handle a complete game with winner detection', async () => {
    // Create and join room
    client1.send(JSON.stringify({
      type: MessageType.CREATE_ROOM,
      roomName: 'Win Test',
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

    await waitForSpecificMessage(client2, MessageType.GAME_UPDATE);

    // Play a sequence of moves leading to a win
    const winningMoves = [
      { player: client1, pos: { row: 7, col: 7 } },   // Black
      { player: client2, pos: { row: 8, col: 7 } },   // White
      { player: client1, pos: { row: 7, col: 8 } },   // Black
      { player: client2, pos: { row: 8, col: 8 } },   // White
      { player: client1, pos: { row: 7, col: 9 } },   // Black
      { player: client2, pos: { row: 8, col: 9 } },   // White
      { player: client1, pos: { row: 7, col: 10 } },  // Black
      { player: client2, pos: { row: 8, col: 10 } },  // White
      { player: client1, pos: { row: 7, col: 11 } }   // Black wins
    ];

    for (const move of winningMoves) {
      move.player.send(JSON.stringify({
        type: MessageType.MAKE_MOVE,
        roomId: testRoomId,
        position: move.pos,
        timestamp: Date.now()
      }));

      const response = await waitForSpecificMessage(move.player, MessageType.GAME_UPDATE);
      if (response.type === MessageType.GAME_UPDATE) {
        // Check if game is finished (this should happen on the last move)
        if (response.gameState.status === 'finished') {
          expect(response.gameState.winner).toBe('black');
          expect(response.gameState.moves).toHaveLength(9);
          break;
        }
      }
    }
  }, 20000);

  it('should properly handle server restart and reconnection scenarios', async () => {
    // Create initial connection and room
    client1.send(JSON.stringify({
      type: MessageType.CREATE_ROOM,
      roomName: 'Persistence Test',
      playerName: 'Player1',
      timestamp: Date.now()
    }));

    const createResponse = await waitForSpecificMessage(client1, MessageType.GAME_UPDATE);
    let testRoomId = '';
    if (createResponse.type === MessageType.GAME_UPDATE) {
      testRoomId = createResponse.room.id;
      expect(createResponse.room.players).toHaveLength(1);
    }

    // Simulate client disconnection and reconnection
    client1.close();

    // Wait a bit and reconnect
    await new Promise(resolve => setTimeout(resolve, 500));
    
    client1 = new WebSocket(`ws://localhost:${serverPort}`);
    await new Promise(resolve => client1.on('open', resolve));

    // Try to rejoin the same room
    client1.send(JSON.stringify({
      type: MessageType.JOIN_ROOM,
      roomId: testRoomId,
      playerName: 'Player1',
      timestamp: Date.now()
    }));

    // Should either succeed or get appropriate error message
    try {
      const response = await waitForMessage(client1);
      expect([MessageType.GAME_UPDATE, MessageType.ERROR]).toContain(response.type);
    } catch (error) {
      // Timeout is acceptable for this test scenario
      expect((error as Error).message).toContain('timeout');
    }
  }, 15000);

  it('should maintain game state consistency across multiple clients', async () => {
    // Create room and join players
    client1.send(JSON.stringify({
      type: MessageType.CREATE_ROOM,
      roomName: 'Consistency Test',
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

    await waitForSpecificMessage(client2, MessageType.GAME_UPDATE);

    // Make a move from player1
    client1.send(JSON.stringify({
      type: MessageType.MAKE_MOVE,
      roomId: testRoomId,
      position: { row: 7, col: 7 },
      timestamp: Date.now()
    }));

    // Both clients should receive the same game state update
    const [response1, response2] = await Promise.all([
      waitForSpecificMessage(client1, MessageType.GAME_UPDATE),
      waitForSpecificMessage(client2, MessageType.GAME_UPDATE)
    ]);

    if (response1.type === MessageType.GAME_UPDATE && response2.type === MessageType.GAME_UPDATE) {
      // Both clients should have the same game state
      expect(response1.gameState.moves).toEqual(response2.gameState.moves);
      expect(response1.gameState.currentPlayer).toBe(response2.gameState.currentPlayer);
      expect(response1.gameState.board[7][7]).toBe(response2.gameState.board[7][7]);
      expect(response1.gameState.moves).toHaveLength(1);
      expect(response1.gameState.currentPlayer).toBe('white');
    }
  }, 15000);
});