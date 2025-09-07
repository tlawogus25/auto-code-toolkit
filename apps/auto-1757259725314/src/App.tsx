import React, { useEffect, useState, useRef } from 'react'
import { enhancedWebSocketService, ConnectionState, ServerMessage } from './services/websocketService'
import ConnectionStatus from './components/ConnectionStatus'
import MessageBadge from './components/MessageBadge'

const App: React.FC = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    enhancedWebSocketService.getConnectionState()
  )
  const [lastMessage, setLastMessage] = useState<ServerMessage | null>(null)
  const [messageInput, setMessageInput] = useState('')
  const [messages, setMessages] = useState<ServerMessage[]>([])
  
  // Refs to prevent re-registration of listeners in StrictMode
  const connectionListenerRef = useRef<(() => void) | null>(null)
  const messageListenerRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    // Cleanup any existing listeners
    if (connectionListenerRef.current) {
      connectionListenerRef.current()
    }
    if (messageListenerRef.current) {
      messageListenerRef.current()
    }

    // Register connection state listener
    connectionListenerRef.current = enhancedWebSocketService.onConnectionChange((state) => {
      setConnectionState(state)
    })

    // Register message listener
    messageListenerRef.current = enhancedWebSocketService.onMessage((message) => {
      setLastMessage(message)
      setMessages(prev => [...prev.slice(-19), message]) // Keep last 20 messages
    })

    // Connect to WebSocket server on app start
    enhancedWebSocketService.connect({
      host: 'localhost',
      port: 8080,
      path: '/ws'
    }).catch(console.error)

    return () => {
      // Cleanup listeners
      if (connectionListenerRef.current) {
        connectionListenerRef.current()
        connectionListenerRef.current = null
      }
      if (messageListenerRef.current) {
        messageListenerRef.current()
        messageListenerRef.current = null
      }
      
      // Disconnect on unmount
      enhancedWebSocketService.disconnect()
    }
  }, [])

  const handleSendMessage = () => {
    if (messageInput.trim() && connectionState.isConnected) {
      const success = enhancedWebSocketService.sendMessage({
        type: 'CHAT_MESSAGE',
        data: { text: messageInput.trim() },
        timestamp: Date.now()
      })
      
      if (success) {
        setMessageInput('')
      }
    }
  }

  const handleReconnect = () => {
    enhancedWebSocketService.connect({
      host: 'localhost',
      port: 8080,
      path: '/ws'
    }).catch(console.error)
  }

  const handleDisconnect = () => {
    enhancedWebSocketService.disconnect()
  }

  return (
    <div className="app" style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <div className="header" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px',
        padding: '10px',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <h1>Enhanced WebSocket Demo</h1>
        <ConnectionStatus connectionState={connectionState} />
      </div>

      <div className="controls" style={{ marginBottom: '20px' }}>
        <button 
          onClick={handleReconnect}
          disabled={connectionState.isConnected || connectionState.isConnecting}
          style={{
            marginRight: '10px',
            padding: '8px 16px',
            backgroundColor: connectionState.isConnected ? '#6b7280' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: connectionState.isConnected ? 'not-allowed' : 'pointer'
          }}
        >
          Reconnect
        </button>
        <button 
          onClick={handleDisconnect}
          disabled={!connectionState.isConnected}
          style={{
            padding: '8px 16px',
            backgroundColor: connectionState.isConnected ? '#ef4444' : '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: connectionState.isConnected ? 'pointer' : 'not-allowed'
          }}
        >
          Disconnect
        </button>
      </div>

      <div className="message-input" style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Type a message..."
          style={{
            width: '300px',
            padding: '8px',
            marginRight: '10px',
            border: '1px solid #d1d5db',
            borderRadius: '4px'
          }}
        />
        <button
          onClick={handleSendMessage}
          disabled={!connectionState.isConnected || !messageInput.trim()}
          style={{
            padding: '8px 16px',
            backgroundColor: connectionState.isConnected && messageInput.trim() ? '#10b981' : '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: connectionState.isConnected && messageInput.trim() ? 'pointer' : 'not-allowed'
          }}
        >
          Send Message
        </button>
      </div>

      <div className="messages" style={{
        border: '1px solid #d1d5db',
        borderRadius: '4px',
        padding: '10px',
        height: '300px',
        overflowY: 'auto',
        backgroundColor: '#f9fafb'
      }}>
        <h3>Messages:</h3>
        {messages.length === 0 ? (
          <p style={{ color: '#6b7280' }}>No messages yet...</p>
        ) : (
          messages.map((message, index) => (
            <div key={index} style={{
              margin: '5px 0',
              padding: '5px',
              backgroundColor: 'white',
              borderRadius: '3px',
              fontSize: '14px'
            }}>
              <strong>{message.type}:</strong> {JSON.stringify(message.data || {})}
              {message.timestamp && (
                <span style={{ color: '#6b7280', fontSize: '12px', marginLeft: '10px' }}>
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
              )}
            </div>
          ))
        )}
      </div>

      <MessageBadge message={lastMessage} />
    </div>
  )
}

export default App