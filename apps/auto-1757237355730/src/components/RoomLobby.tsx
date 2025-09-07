import React, { useState, useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { websocketService } from '../services/websocketService'

const RoomLobby: React.FC = () => {
  const [playerName, setPlayerName] = useState('')
  const [roomName, setRoomName] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const { availableRooms, isConnected } = useGameStore()

  useEffect(() => {
    if (isConnected) {
      // Request room list on connect
    }
  }, [isConnected])

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault()
    if (playerName.trim() && roomName.trim()) {
      websocketService.createRoom(roomName.trim(), playerName.trim())
      setShowCreateForm(false)
      setRoomName('')
    }
  }

  const handleJoinRoom = (roomId: string) => {
    if (playerName.trim()) {
      websocketService.joinRoom(roomId, playerName.trim())
    }
  }

  if (!isConnected) {
    return (
      <div className="lobby-container">
        <div className="connecting">
          <div className="spinner">⏳</div>
          <p>Connecting to server...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="lobby-container">
      <h1>Omok Game Lobby</h1>
      
      <div className="player-setup">
        <label>
          Your Name:
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
          />
        </label>
      </div>

      <div className="room-actions">
        {!showCreateForm ? (
          <button 
            className="create-room-btn"
            onClick={() => setShowCreateForm(true)}
            disabled={!playerName.trim()}
          >
            Create New Room
          </button>
        ) : (
          <form className="create-room-form" onSubmit={handleCreateRoom}>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Room name"
              maxLength={30}
              required
            />
            <div className="form-actions">
              <button type="submit">Create</button>
              <button 
                type="button" 
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="room-list">
        <h2>Available Rooms</h2>
        {availableRooms.length === 0 ? (
          <div className="no-rooms">
            No rooms available. Create one to get started!
          </div>
        ) : (
          <div className="rooms">
            {availableRooms.map((room) => (
              <div key={room.id} className="room-item">
                <div className="room-info">
                  <h3>{room.name}</h3>
                  <p>{room.players.length}/{room.maxPlayers} players</p>
                  <div className="room-players">
                    {room.players.map((player, index) => (
                      <span key={player.id} className="player-name">
                        {player.name}
                        {index < room.players.length - 1 && ', '}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  className="join-btn"
                  onClick={() => handleJoinRoom(room.id)}
                  disabled={!playerName.trim() || room.players.length >= room.maxPlayers}
                >
                  {room.players.length >= room.maxPlayers ? 'Full' : 'Join'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default RoomLobby