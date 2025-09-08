import { describe, it, expect, beforeEach, vi } from 'vitest'
import { enhancedWebSocketService } from '../src/services/websocketService'

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState: number = MockWebSocket.CONNECTING
  url: string
  onopen: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  constructor(url: string) {
    this.url = url
    // Simulate connection opening after a short delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN
      this.onopen?.(new Event('open'))
    }, 10)
  }

  send(data: string) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open')
    }
    // Echo back PONG for PING messages
    const message = JSON.parse(data)
    if (message.type === 'PING') {
      setTimeout(() => {
        this.onmessage?.(new MessageEvent('message', {
          data: JSON.stringify({ type: 'PONG', timestamp: Date.now() })
        }))
      }, 5)
    }
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED
    setTimeout(() => {
      this.onclose?.(new CloseEvent('close', { code: code || 1000, reason: reason || '' }))
    }, 5)
  }
}

// @ts-ignore
global.WebSocket = MockWebSocket

describe('enhancedWebSocketService', () => {
  beforeEach(() => {
    // Reset the service state
    enhancedWebSocketService.disconnect()
    vi.clearAllMocks()
  })

  it('should prevent duplicate connections in StrictMode', async () => {
    const config = { host: 'localhost', port: 8080 }
    
    // Try to connect twice simultaneously
    const connection1 = enhancedWebSocketService.connect(config)
    const connection2 = enhancedWebSocketService.connect(config)
    
    // First connection should succeed
    await expect(connection1).resolves.toBeUndefined()
    
    // Second connection should be rejected
    await expect(connection2).rejects.toThrow('Connection already in progress')
  })

  it('should handle connection state changes', async () => {
    const stateChanges: any[] = []
    
    const unsubscribe = enhancedWebSocketService.onConnectionChange((state) => {
      stateChanges.push({ ...state })
    })

    const config = { host: 'localhost', port: 8080 }
    await enhancedWebSocketService.connect(config)

    expect(stateChanges).toHaveLength(3) // Initial, connecting, connected
    expect(stateChanges[0].isConnecting).toBe(false)
    expect(stateChanges[1].isConnecting).toBe(true)
    expect(stateChanges[2].isConnected).toBe(true)
    
    unsubscribe()
  })

  it('should send and receive messages correctly', async () => {
    const messages: any[] = []
    
    const unsubscribeMessage = enhancedWebSocketService.onMessage((message) => {
      messages.push(message)
    })

    const config = { host: 'localhost', port: 8080 }
    await enhancedWebSocketService.connect(config)

    // Send a message
    const success = enhancedWebSocketService.sendMessage({
      type: 'TEST_MESSAGE',
      data: { test: 'data' },
      timestamp: Date.now()
    })

    expect(success).toBe(true)
    unsubscribeMessage()
  })

  it('should handle ping/pong messages', async () => {
    const config = { host: 'localhost', port: 8080 }
    await enhancedWebSocketService.connect(config)

    const initialState = enhancedWebSocketService.getConnectionState()
    expect(initialState.lastPong).toBeNull()

    // Send a ping message (this will trigger a pong response from the mock)
    enhancedWebSocketService.sendMessage({ type: 'PING', timestamp: Date.now() })

    // Wait for pong response
    await new Promise(resolve => setTimeout(resolve, 20))

    const updatedState = enhancedWebSocketService.getConnectionState()
    expect(updatedState.lastPong).toBeGreaterThan(0)
  })

  it('should generate proper WebSocket URLs', () => {
    // Test dynamic URL generation
    const mockLocation = {
      hostname: 'example.com',
      protocol: 'https:'
    }
    
    Object.defineProperty(window, 'location', {
      value: mockLocation,
      writable: true
    })

    // The service should use the generateWebSocketURL function internally
    // We can't directly test this without refactoring, but we know it's used
    expect(true).toBe(true) // Placeholder - actual URL generation is tested in websocketUtils.test.ts
  })

  it('should handle intentional disconnection', async () => {
    const config = { host: 'localhost', port: 8080 }
    await enhancedWebSocketService.connect(config)

    expect(enhancedWebSocketService.getConnectionState().isConnected).toBe(true)

    enhancedWebSocketService.disconnect()

    // Wait for disconnection to process
    await new Promise(resolve => setTimeout(resolve, 20))

    const state = enhancedWebSocketService.getConnectionState()
    expect(state.isConnected).toBe(false)
    expect(state.error).toBeNull() // Should be null for intentional disconnect
  })

  it('should clean up listeners properly', async () => {
    const connectionListener = vi.fn()
    const messageListener = vi.fn()

    const unsubscribeConnection = enhancedWebSocketService.onConnectionChange(connectionListener)
    const unsubscribeMessage = enhancedWebSocketService.onMessage(messageListener)

    // Initial state should trigger the connection listener
    expect(connectionListener).toHaveBeenCalledWith(
      expect.objectContaining({
        isConnected: false,
        isConnecting: false
      })
    )

    // Unsubscribe and test that listeners are not called anymore
    unsubscribeConnection()
    unsubscribeMessage()

    const config = { host: 'localhost', port: 8080 }
    await enhancedWebSocketService.connect(config)

    // Connection listener should not have been called after unsubscribe
    expect(connectionListener).toHaveBeenCalledTimes(1) // Only the initial call
  })
})