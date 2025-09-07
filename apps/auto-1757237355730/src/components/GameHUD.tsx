import React from 'react'
import { useGameStore } from '../store/gameStore'

const GameHUD: React.FC = () => {
  const { 
    gameState, 
    currentRoom, 
    playerColor, 
    isConnected,
    connectionError 
  } = useGameStore()

  const getCurrentPlayerName = () => {
    if (!currentRoom) return 'Unknown'
    const player = currentRoom.players.find(p => p.color === gameState.currentPlayer)
    return player?.name || 'Unknown'
  }

  const getPlayerName = (color: 'black' | 'white') => {
    if (!currentRoom) return 'Empty'
    const player = currentRoom.players.find(p => p.color === color)
    return player?.name || 'Waiting...'
  }

  const isCurrentPlayerTurn = () => {
    return playerColor === gameState.currentPlayer
  }

  if (!currentRoom) {
    return (
      <div className="hud-container">
        <div className="connection-status">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢' : '🔴'} 
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
          {connectionError && (
            <div className="error-message">{connectionError}</div>
          )}
        </div>
        <div className="no-room">
          Not in a room
        </div>
      </div>
    )
  }

  return (
    <div className="hud-container">
      <div className="connection-status">
        <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '🟢' : '🔴'} 
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      <div className="room-info">
        <h3>Room: {currentRoom.name}</h3>
        <div className="room-id">ID: {currentRoom.id.slice(0, 8)}...</div>
      </div>

      <div className="players-info">
        <div className="player-section">
          <div className={`player black ${playerColor === 'black' ? 'you' : ''}`}>
            <span className="stone">●</span>
            <span className="name">{getPlayerName('black')}</span>
            {playerColor === 'black' && <span className="you-indicator">(You)</span>}
          </div>
          <div className={`player white ${playerColor === 'white' ? 'you' : ''}`}>
            <span className="stone">○</span>
            <span className="name">{getPlayerName('white')}</span>
            {playerColor === 'white' && <span className="you-indicator">(You)</span>}
          </div>
        </div>
      </div>

      <div className="game-status">
        {gameState.isGameOver ? (
          <div className="game-over">
            🎉 {gameState.winner === playerColor ? 'You Win!' : 
                `${getPlayerName(gameState.winner!)} Wins!`}
          </div>
        ) : (
          <div className="turn-info">
            <div className={`current-turn ${isCurrentPlayerTurn() ? 'your-turn' : ''}`}>
              <span className="stone">
                {gameState.currentPlayer === 'black' ? '●' : '○'}
              </span>
              {isCurrentPlayerTurn() ? 'Your turn' : `${getCurrentPlayerName()}'s turn`}
            </div>
          </div>
        )}
      </div>

      <div className="move-counter">
        Move #{gameState.moveHistory.length + 1}
      </div>
    </div>
  )
}

export default GameHUD