import React, { useState, useEffect } from 'react'
import { ServerMessage } from '../services/websocketService'

interface MessageBadgeProps {
  message: ServerMessage | null
  autoHideDelay?: number
}

const MessageBadge: React.FC<MessageBadgeProps> = ({ 
  message, 
  autoHideDelay = 3000 
}) => {
  const [visible, setVisible] = useState(false)
  const [currentMessage, setCurrentMessage] = useState<ServerMessage | null>(null)

  useEffect(() => {
    if (message) {
      setCurrentMessage(message)
      setVisible(true)

      const timer = setTimeout(() => {
        setVisible(false)
      }, autoHideDelay)

      return () => clearTimeout(timer)
    }
  }, [message, autoHideDelay])

  if (!visible || !currentMessage) {
    return null
  }

  const getBadgeStyle = () => {
    const baseStyle = {
      position: 'fixed' as const,
      top: '20px',
      right: '20px',
      padding: '12px 16px',
      borderRadius: '8px',
      color: 'white',
      fontSize: '14px',
      fontWeight: 'bold' as const,
      zIndex: 1000,
      transition: 'all 0.3s ease',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
    }

    switch (currentMessage.type) {
      case 'ERROR':
        return { ...baseStyle, backgroundColor: '#ef4444' }
      case 'SUCCESS':
        return { ...baseStyle, backgroundColor: '#10b981' }
      case 'WARNING':
        return { ...baseStyle, backgroundColor: '#f59e0b' }
      default:
        return { ...baseStyle, backgroundColor: '#3b82f6' }
    }
  }

  const getMessageText = () => {
    if (typeof currentMessage.data === 'string') {
      return currentMessage.data
    }
    
    if (currentMessage.data?.message) {
      return currentMessage.data.message
    }
    
    return `Server message: ${currentMessage.type}`
  }

  return (
    <div style={getBadgeStyle()}>
      {getMessageText()}
    </div>
  )
}

export default MessageBadge