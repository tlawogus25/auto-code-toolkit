import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';
import { GameServer } from '../server/gameServer.js';
import { MessageType } from '../types/messages.js';

describe('Omok Game E2E Play Tests', () => {
  let server: GameServer;
  let serverPort: number;

  beforeEach(async () => {
    serverPort = 8081 + Math.floor(Math.random() * 1000);
    server = new GameServer(serverPort);
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 200));
  });

  afterEach(async () => {
    await server.close();
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  it('should connect and receive room list', async () => {
    const client = new WebSocket(`ws://localhost:${serverPort}`);

    const result = await new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Test timeout'));
      }, 5000);

      client.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          clearTimeout(timeout);
          client.close();
          resolve(message);
        } catch (error) {
          clearTimeout(timeout);
          client.close();
          reject(error);
        }
      });

      client.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    expect(result).toBeDefined();
    expect(result.type).toBe(MessageType.ROOM_LIST);
  });

  it('should create a room successfully', async () => {
    const client = new WebSocket(`ws://localhost:${serverPort}`);

    const result = await new Promise<any>((resolve, reject) => {
      let messageCount = 0;
      const timeout = setTimeout(() => {
        reject(new Error('Test timeout'));
      }, 5000);

      client.on('open', () => {
        client.send(JSON.stringify({
          type: MessageType.CREATE_ROOM,
          roomName: 'Test Room',
          playerName: 'TestPlayer',
          timestamp: Date.now()
        }));
      });

      client.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          messageCount++;
          
          if (message.type === MessageType.GAME_UPDATE) {
            clearTimeout(timeout);
            client.close();
            resolve(message);
            return;
          }
          
          // Ignore ROOM_LIST messages
        } catch (error) {
          clearTimeout(timeout);
          client.close();
          reject(error);
        }
      });

      client.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    expect(result).toBeDefined();
    expect(result.type).toBe(MessageType.GAME_UPDATE);
    expect(result.room).toBeDefined();
    expect(result.room.name).toBe('Test Room');
  });

  it('should handle invalid moves with error message', async () => {
    const client = new WebSocket(`ws://localhost:${serverPort}`);

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);

      client.on('open', () => {
        // Try to make a move without being in a room (should fail)
        client.send(JSON.stringify({
          type: MessageType.MAKE_MOVE,
          roomId: 'nonexistent-room',
          position: { row: 0, col: 0 },
          timestamp: Date.now()
        }));
      });

      client.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === MessageType.ERROR) {
            clearTimeout(timeout);
            client.close();
            resolve(message);
          }
          // Ignore room list messages
        } catch (error) {
          clearTimeout(timeout);
          client.close();
          reject(error);
        }
      });

      client.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    expect(true).toBe(true); // Test passes if no exceptions thrown
  });
});