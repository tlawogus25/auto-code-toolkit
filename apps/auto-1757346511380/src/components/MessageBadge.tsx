import React, { useState, useEffect } from 'react'
import { ServerMessage } from '../services/websocketService'

interface MessageBadgeProps {
  message: ServerMessage | null
}

const MessageBadge: React.FC<MessageBadgeProps> = ({ message }) => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (message) {
      setIsVisible(true)
      const timer = setTimeout(() => {
        setIsVisible(false)
      }, 3000) // Show for 3 seconds

      return () => clearTimeout(timer)
    }
  }, [message])

  if (!isVisible || !message) {
    return null
  }

  const getMessageTypeColor = (type: string) => {
    switch (type) {
      case 'ROOM_LIST':
        return '#3b82f6' // blue
      case 'CHAT_MESSAGE':
        return '#10b981' // green
      case 'ERROR':
        return '#ef4444' // red
      case 'WARNING':
        return '#f59e0b' // amber
      default:
        return '#6b7280' // gray
    }
  }

  return (
    <div
      className="message-badge"
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        backgroundColor: getMessageTypeColor(message.type),
        color: 'white',
        padding: '12px 16px',
        borderRadius: '8px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        zIndex: 1000,
        maxWidth: '300px',
        animation: isVisible ? 'slideInRight 0.3s ease-out' : 'slideOutRight 0.3s ease-in'
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
        {message.type}
      </div>
      <div style={{ fontSize: '14px', opacity: 0.9 }}>
        {message.data ? JSON.stringify(message.data) : 'No data'}
      </div>
      {message.timestamp && (
        <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      )}
    </div>
  )
}

export default MessageBadge