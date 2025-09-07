import React, { useEffect } from 'react'
import { useGameStore } from './store/gameStore'
import { websocketService } from './services/websocketService'
import RoomLobby from './components/RoomLobby'
import Board from './components/Board'
import GameHUD from './components/GameHUD'

const App: React.FC = () => {
  const { currentRoom } = useGameStore()

  useEffect(() => {
    // Connect to WebSocket server on app start
    websocketService.connect().catch(console.error)

    return () => {
      websocketService.disconnect()
    }
  }, [])

  const handleLeaveRoom = () => {
    if (currentRoom) {
      websocketService.leaveRoom(currentRoom.id)
      useGameStore.getState().leaveRoom()
    }
  }

  if (!currentRoom) {
    return <RoomLobby />
  }

  return (
    <div className="app">
      <div className="game-header">
        <h1>Omok Game</h1>
        <button className="leave-btn" onClick={handleLeaveRoom}>
          Leave Room
        </button>
      </div>
      
      <div className="game-content">
        <GameHUD />
        <Board />
      </div>

    </div>
  )
}

export default App