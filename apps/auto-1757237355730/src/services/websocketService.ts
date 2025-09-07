import { ClientMessage, ServerMessage } from '../types/network'
import { useGameStore } from '../store/gameStore'

class WebSocketService {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectInterval = 1000

  connect(url: string = 'ws://localhost:8080'): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url)
        
        this.ws.onopen = () => {
          console.log('Connected to WebSocket server')
          this.reconnectAttempts = 0
          useGameStore.getState().setConnection(true)
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const message: ServerMessage = JSON.parse(event.data)
            this.handleMessage(message)
          } catch (error) {
            console.error('Failed to parse message:', error)
          }
        }

        this.ws.onclose = () => {
          console.log('WebSocket connection closed')
          useGameStore.getState().setConnection(false)
          this.attemptReconnect(url)
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          useGameStore.getState().setConnection(false, 'Connection failed')
          reject(error)
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  private attemptReconnect(url: string) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
      
      setTimeout(() => {
        this.connect(url).catch(() => {
          // Connection failed, will try again if under max attempts
        })
      }, this.reconnectInterval * this.reconnectAttempts)
    }
  }

  private handleMessage(message: ServerMessage) {
    const store = useGameStore.getState()

    switch (message.type) {
      case 'ROOM_CREATED':
        store.setCurrentRoom(message.room)
        store.setPlayer(message.playerId, 'black') // Room creator is black
        break

      case 'ROOM_JOINED':
        store.setCurrentRoom(message.room)
        store.setPlayer(message.playerId, message.playerColor)
        break

      case 'GAME_UPDATE':
        store.setGameState(message.gameState)
        break

      case 'PLAYER_JOINED':
        if (store.currentRoom) {
          // Update room state with new player
          const updatedRoom = {
            ...store.currentRoom,
            players: [
              ...store.currentRoom.players,
              {
                id: message.playerId,
                name: message.playerName,
                color: message.playerColor
              }
            ]
          }
          store.setCurrentRoom(updatedRoom)
        }
        break

      case 'PLAYER_LEFT':
        if (store.currentRoom) {
          const updatedRoom = {
            ...store.currentRoom,
            players: store.currentRoom.players.filter(p => p.id !== message.playerId)
          }
          store.setCurrentRoom(updatedRoom)
        }
        break

      case 'GAME_OVER':
        const currentState = store.gameState
        store.setGameState({
          ...currentState,
          winner: message.winner,
          isGameOver: true
        })
        break

      case 'ROOM_LIST':
        store.setAvailableRooms(message.rooms)
        break

      case 'ERROR':
        console.error('Server error:', message.message)
        store.setConnection(store.isConnected, message.message)
        break

      default:
        console.warn('Unknown message type:', message)
    }
  }

  sendMessage(message: ClientMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        ...message,
        timestamp: Date.now()
      }))
    } else {
      console.error('WebSocket is not connected')
    }
  }

  createRoom(roomName: string, playerName: string) {
    this.sendMessage({
      type: 'CREATE_ROOM',
      roomName,
      playerName,
      timestamp: Date.now()
    })
  }

  joinRoom(roomId: string, playerName: string) {
    this.sendMessage({
      type: 'JOIN_ROOM',
      roomId,
      playerName,
      timestamp: Date.now()
    })
  }

  makeMove(roomId: string, position: { row: number; col: number }) {
    this.sendMessage({
      type: 'MAKE_MOVE',
      roomId,
      position,
      timestamp: Date.now()
    })
  }

  leaveRoom(roomId: string) {
    this.sendMessage({
      type: 'LEAVE_ROOM',
      roomId,
      timestamp: Date.now()
    })
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}

export const websocketService = new WebSocketService()