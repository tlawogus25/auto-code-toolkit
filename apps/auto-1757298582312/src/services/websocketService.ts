import { generateWebSocketURL, WebSocketConfig } from '../utils/websocketUtils'

export interface ConnectionState {
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  lastPong: number | null
}

export interface ServerMessage {
  type: string
  data?: any
  timestamp?: number
}

export interface ClientMessage {
  type: string
  data?: any
  timestamp: number
}

class EnhancedWebSocketService {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectInterval = 1000
  private maxReconnectInterval = 30000
  private pingInterval: number | null = null
  private pongTimeout: number | null = null
  private connectionAttemptId = 0
  private intentionalDisconnect = false
  private currentUrl: string | null = null
  private connectionListeners: ((state: ConnectionState) => void)[] = []
  private messageListeners: ((message: ServerMessage) => void)[] = []

  private connectionState: ConnectionState = {
    isConnected: false,
    isConnecting: false,
    error: null,
    lastPong: null
  }

  /**
   * Connect to WebSocket server with race condition prevention
   */
  async connect(config: WebSocketConfig = {}): Promise<void> {
    // Prevent multiple simultaneous connection attempts (StrictMode handling)
    if (this.connectionState.isConnecting) {
      throw new Error('Connection already in progress')
    }

    // Generate connection ID to handle race conditions
    const attemptId = ++this.connectionAttemptId
    this.intentionalDisconnect = false
    this.currentUrl = generateWebSocketURL(config)

    this.updateConnectionState({
      isConnecting: true,
      error: null
    })

    return new Promise((resolve, reject) => {
      try {
        // Check if this attempt is still valid (not superseded by another)
        if (attemptId !== this.connectionAttemptId) {
          reject(new Error('Connection attempt superseded'))
          return
        }

        this.ws = new WebSocket(this.currentUrl!)

        this.ws.onopen = () => {
          // Double-check attempt is still valid
          if (attemptId !== this.connectionAttemptId) {
            this.ws?.close()
            return
          }

          console.log('Connected to WebSocket server')
          this.reconnectAttempts = 0
          this.startPingInterval()
          
          this.updateConnectionState({
            isConnected: true,
            isConnecting: false,
            error: null
          })
          
          resolve()
        }

        this.ws.onmessage = (event) => {
          this.handleIncomingMessage(event)
        }

        this.ws.onclose = (event) => {
          this.stopPingInterval()
          
          // Only attempt reconnection if not intentional and this is the current attempt
          if (!this.intentionalDisconnect && attemptId === this.connectionAttemptId) {
            console.log('WebSocket connection closed', event.code, event.reason)
            this.updateConnectionState({
              isConnected: false,
              isConnecting: false,
              error: event.reason || 'Connection closed'
            })
            this.attemptReconnect()
          } else {
            this.updateConnectionState({
              isConnected: false,
              isConnecting: false,
              error: null
            })
          }
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          this.updateConnectionState({
            isConnected: false,
            isConnecting: false,
            error: 'Connection failed'
          })
          
          if (attemptId === this.connectionAttemptId) {
            reject(error)
          }
        }
      } catch (error) {
        this.updateConnectionState({
          isConnecting: false,
          error: 'Failed to create WebSocket connection'
        })
        reject(error)
      }
    })
  }

  /**
   * Disconnect with intentional flag to prevent reconnection
   */
  disconnect(): void {
    this.intentionalDisconnect = true
    this.connectionAttemptId++ // Invalidate any pending connections
    this.stopPingInterval()
    
    if (this.ws) {
      this.ws.close(1000, 'Intentional disconnect')
      this.ws = null
    }
    
    this.updateConnectionState({
      isConnected: false,
      isConnecting: false,
      error: null
    })
  }

  /**
   * Send message with connection validation
   */
  sendMessage(message: ClientMessage): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        ...message,
        timestamp: Date.now()
      }))
      return true
    } else {
      console.error('WebSocket is not connected')
      return false
    }
  }

  /**
   * Add connection state listener
   */
  onConnectionChange(listener: (state: ConnectionState) => void): () => void {
    this.connectionListeners.push(listener)
    // Immediately call with current state
    listener(this.connectionState)
    
    // Return unsubscribe function
    return () => {
      const index = this.connectionListeners.indexOf(listener)
      if (index > -1) {
        this.connectionListeners.splice(index, 1)
      }
    }
  }

  /**
   * Add message listener
   */
  onMessage(listener: (message: ServerMessage) => void): () => void {
    this.messageListeners.push(listener)
    
    return () => {
      const index = this.messageListeners.indexOf(listener)
      if (index > -1) {
        this.messageListeners.splice(index, 1)
      }
    }
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return { ...this.connectionState }
  }

  private handleIncomingMessage(event: MessageEvent): void {
    try {
      const message: ServerMessage = JSON.parse(event.data)
      
      // Handle ping/pong messages
      if (message.type === 'PING') {
        this.sendMessage({ type: 'PONG', timestamp: Date.now() })
        return
      }
      
      if (message.type === 'PONG') {
        this.updateConnectionState({
          lastPong: Date.now()
        })
        this.clearPongTimeout()
        return
      }
      
      // Optimize ROOM_LIST handling
      if (message.type === 'ROOM_LIST') {
        // Process room list data efficiently
        console.log('Received room list:', message.data)
      }
      
      // Notify message listeners
      this.messageListeners.forEach(listener => {
        try {
          listener(message)
        } catch (error) {
          console.error('Error in message listener:', error)
        }
      })
    } catch (error) {
      console.error('Failed to parse message:', error)
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts && !this.intentionalDisconnect) {
      this.reconnectAttempts++
      const backoffDelay = Math.min(
        this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
        this.maxReconnectInterval
      )
      
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${backoffDelay}ms`)
      
      setTimeout(() => {
        if (!this.intentionalDisconnect && this.currentUrl) {
          this.connect({ }).catch((error) => {
            console.error('Reconnection failed:', error)
          })
        }
      }, backoffDelay)
    } else {
      console.log('Max reconnection attempts reached or intentional disconnect')
    }
  }

  private startPingInterval(): void {
    this.stopPingInterval()
    
    this.pingInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendMessage({ type: 'PING', timestamp: Date.now() })
        
        // Set timeout for pong response
        this.pongTimeout = window.setTimeout(() => {
          console.warn('Pong timeout - connection may be dead')
          this.ws?.close()
        }, 5000)
      }
    }, 30000) // Ping every 30 seconds
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
    this.clearPongTimeout()
  }

  private clearPongTimeout(): void {
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout)
      this.pongTimeout = null
    }
  }

  private updateConnectionState(updates: Partial<ConnectionState>): void {
    this.connectionState = { ...this.connectionState, ...updates }
    
    // Notify all listeners
    this.connectionListeners.forEach(listener => {
      try {
        listener(this.connectionState)
      } catch (error) {
        console.error('Error in connection listener:', error)
      }
    })
  }
}

export const enhancedWebSocketService = new EnhancedWebSocketService()