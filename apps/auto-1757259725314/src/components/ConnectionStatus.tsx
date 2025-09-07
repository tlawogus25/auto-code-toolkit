import React from 'react'
import { ConnectionState } from '../services/websocketService'

interface ConnectionStatusProps {
  connectionState: ConnectionState
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ connectionState }) => {
  const getStatusColor = () => {
    if (connectionState.isConnected) return '#4ade80' // green
    if (connectionState.isConnecting) return '#fbbf24' // yellow
    return '#ef4444' // red
  }

  const getStatusText = () => {
    if (connectionState.isConnected) return 'Connected'
    if (connectionState.isConnecting) return 'Connecting...'
    return 'Disconnected'
  }

  return (
    <div className="connection-status">
      <div 
        className="status-indicator"
        style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: getStatusColor(),
          display: 'inline-block',
          marginRight: '8px'
        }}
      />
      <span className="status-text">{getStatusText()}</span>
      
      {connectionState.error && (
        <div className="error-message" style={{
          color: '#ef4444',
          fontSize: '12px',
          marginTop: '4px'
        }}>
          Error: {connectionState.error}
        </div>
      )}
      
      {connectionState.lastPong && (
        <div className="last-pong" style={{
          color: '#6b7280',
          fontSize: '11px',
          marginTop: '2px'
        }}>
          Last pong: {new Date(connectionState.lastPong).toLocaleTimeString()}
        </div>
      )}
    </div>
  )
}

export default ConnectionStatus