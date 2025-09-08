import { WebSocketServer } from 'ws'
import { createServer } from 'http'
import { v4 as uuidv4 } from 'uuid'

const server = createServer()
const wss = new WebSocketServer({ server })

// Game state
const rooms = new Map()
const clients = new Map()

function createEmptyBoard() {
  return Array(15).fill(null).map(() => Array(15).fill(null))
}

function createInitialGameState() {
  return {
    board: createEmptyBoard(),
    currentPlayer: 'black',
    winner: null,
    isGameOver: false,
    moveHistory: []
  }
}

function createRoom(name, creatorId, creatorName) {
  const roomId = uuidv4()
  const room = {
    id: roomId,
    name,
    players: [
      {
        id: creatorId,
        name: creatorName,
        color: 'black'
      }
    ],
    maxPlayers: 2,
    gameState: createInitialGameState(),
    isActive: false
  }
  
  rooms.set(roomId, room)
  return room
}

function isValidMove(board, position) {
  const { row, col } = position
  return (
    row >= 0 && 
    row < 15 && 
    col >= 0 && 
    col < 15 && 
    board[row][col] === null
  )
}

function checkWinner(board, lastMove, player) {
  const directions = [
    [0, 1],   // horizontal
    [1, 0],   // vertical
    [1, 1],   // diagonal \
    [1, -1]   // diagonal /
  ]

  for (const [dx, dy] of directions) {
    if (checkDirection(board, lastMove, player, dx, dy)) {
      return player
    }
  }

  return null
}

function checkDirection(board, position, player, dx, dy) {
  let count = 1 // Count the placed stone

  // Check positive direction
  count += countConsecutive(board, position, player, dx, dy)
  
  // Check negative direction
  count += countConsecutive(board, position, player, -dx, -dy)

  return count >= 5
}

function countConsecutive(board, start, player, dx, dy) {
  let count = 0
  let row = start.row + dx
  let col = start.col + dy

  while (
    row >= 0 && 
    row < 15 && 
    col >= 0 && 
    col < 15 && 
    board[row][col] === player
  ) {
    count++
    row += dx
    col += dy
  }

  return count
}

function makeMove(gameState, position, player) {
  if (!isValidMove(gameState.board, position) || gameState.isGameOver) {
    return null
  }

  const newBoard = gameState.board.map(row => [...row])
  newBoard[position.row][position.col] = player

  const winner = checkWinner(newBoard, position, player)
  const isGameOver = winner !== null

  return {
    board: newBoard,
    currentPlayer: player === 'black' ? 'white' : 'black',
    winner,
    isGameOver,
    moveHistory: [...gameState.moveHistory, position]
  }
}

function broadcastToRoom(roomId, message) {
  const room = rooms.get(roomId)
  if (!room) return

  room.players.forEach(player => {
    const client = clients.get(player.id)
    if (client && client.readyState === client.OPEN) {
      client.send(JSON.stringify({
        ...message,
        timestamp: Date.now()
      }))
    }
  })
}

function sendToClient(clientId, message) {
  const client = clients.get(clientId)
  if (client && client.readyState === client.OPEN) {
    client.send(JSON.stringify({
      ...message,
      timestamp: Date.now()
    }))
  }
}

wss.on('connection', (ws) => {
  const clientId = uuidv4()
  clients.set(clientId, ws)
  
  console.log(`Client ${clientId} connected`)

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString())
      
      switch (message.type) {
        case 'CREATE_ROOM':
          const room = createRoom(message.roomName, clientId, message.playerName)
          sendToClient(clientId, {
            type: 'ROOM_CREATED',
            room,
            playerId: clientId
          })
          break

        case 'JOIN_ROOM':
          const roomToJoin = rooms.get(message.roomId)
          if (!roomToJoin) {
            sendToClient(clientId, {
              type: 'ERROR',
              message: 'Room not found'
            })
            break
          }

          if (roomToJoin.players.length >= roomToJoin.maxPlayers) {
            sendToClient(clientId, {
              type: 'ERROR',
              message: 'Room is full'
            })
            break
          }

          // Add player to room
          const playerColor = roomToJoin.players.length === 0 ? 'black' : 'white'
          roomToJoin.players.push({
            id: clientId,
            name: message.playerName,
            color: playerColor
          })

          if (roomToJoin.players.length === 2) {
            roomToJoin.isActive = true
          }

          sendToClient(clientId, {
            type: 'ROOM_JOINED',
            room: roomToJoin,
            playerId: clientId,
            playerColor: playerColor
          })

          // Notify other players
          broadcastToRoom(message.roomId, {
            type: 'PLAYER_JOINED',
            playerName: message.playerName,
            playerId: clientId,
            playerColor: playerColor
          })
          break

        case 'MAKE_MOVE':
          const gameRoom = rooms.get(message.roomId)
          if (!gameRoom) {
            sendToClient(clientId, {
              type: 'ERROR',
              message: 'Room not found'
            })
            break
          }

          const player = gameRoom.players.find(p => p.id === clientId)
          if (!player) {
            sendToClient(clientId, {
              type: 'ERROR',
              message: 'Player not in room'
            })
            break
          }

          if (gameRoom.gameState.currentPlayer !== player.color) {
            sendToClient(clientId, {
              type: 'ERROR',
              message: 'Not your turn'
            })
            break
          }

          const newGameState = makeMove(
            gameRoom.gameState,
            message.position,
            player.color
          )

          if (!newGameState) {
            sendToClient(clientId, {
              type: 'ERROR',
              message: 'Invalid move'
            })
            break
          }

          gameRoom.gameState = newGameState

          broadcastToRoom(message.roomId, {
            type: 'GAME_UPDATE',
            gameState: newGameState,
            lastMove: message.position
          })

          if (newGameState.winner) {
            broadcastToRoom(message.roomId, {
              type: 'GAME_OVER',
              winner: newGameState.winner
            })
          }
          break

        case 'LEAVE_ROOM':
          const leaveRoom = rooms.get(message.roomId)
          if (leaveRoom) {
            const playerIndex = leaveRoom.players.findIndex(p => p.id === clientId)
            if (playerIndex !== -1) {
              const leavingPlayer = leaveRoom.players[playerIndex]
              leaveRoom.players.splice(playerIndex, 1)

              broadcastToRoom(message.roomId, {
                type: 'PLAYER_LEFT',
                playerName: leavingPlayer.name,
                playerId: clientId
              })

              if (leaveRoom.players.length === 0) {
                rooms.delete(message.roomId)
              } else {
                leaveRoom.isActive = false
                leaveRoom.gameState = createInitialGameState()
              }
            }
          }
          break

        default:
          console.log('Unknown message type:', message.type)
      }
    } catch (error) {
      console.error('Error handling message:', error)
      sendToClient(clientId, {
        type: 'ERROR',
        message: 'Invalid message format'
      })
    }
  })

  ws.on('close', () => {
    console.log(`Client ${clientId} disconnected`)
    clients.delete(clientId)

    // Remove from any rooms
    for (const [roomId, room] of rooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.id === clientId)
      if (playerIndex !== -1) {
        const leavingPlayer = room.players[playerIndex]
        room.players.splice(playerIndex, 1)

        broadcastToRoom(roomId, {
          type: 'PLAYER_LEFT',
          playerName: leavingPlayer.name,
          playerId: clientId
        })

        if (room.players.length === 0) {
          rooms.delete(roomId)
        } else {
          room.isActive = false
          room.gameState = createInitialGameState()
        }
      }
    }
  })
})

const PORT = process.env.PORT || 8080
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`)
})

// Send room list updates periodically
setInterval(() => {
  const roomList = Array.from(rooms.values()).filter(room => !room.isActive)
  const message = {
    type: 'ROOM_LIST',
    rooms: roomList,
    timestamp: Date.now()
  }
  
  clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify(message))
    }
  })
}, 5000)