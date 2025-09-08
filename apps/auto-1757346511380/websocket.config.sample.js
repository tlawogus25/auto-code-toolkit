/**
 * Sample WebSocket configuration
 * Copy this file to websocket.config.js and customize as needed
 */

export const websocketConfig = {
  // Development configuration
  development: {
    protocol: 'ws',
    host: 'localhost', 
    port: 8080,
    path: '/ws',
    params: {
      version: '1.0',
      client: 'web'
    },
    // Reconnection settings
    maxReconnectAttempts: 5,
    reconnectInterval: 1000,
    maxReconnectInterval: 30000,
    // Ping/pong settings
    pingInterval: 30000,
    pongTimeout: 5000
  },

  // Production configuration
  production: {
    protocol: 'wss',
    host: 'api.example.com',
    port: 443,
    path: '/websocket',
    params: {
      version: '1.0',
      client: 'web'
    },
    maxReconnectAttempts: 10,
    reconnectInterval: 2000,
    maxReconnectInterval: 60000,
    pingInterval: 30000,
    pongTimeout: 10000
  },

  // Staging configuration
  staging: {
    protocol: 'wss',
    host: 'staging-api.example.com',
    port: 443,
    path: '/websocket',
    params: {
      version: '1.0',
      client: 'web',
      debug: 'true'
    },
    maxReconnectAttempts: 3,
    reconnectInterval: 1500,
    maxReconnectInterval: 15000,
    pingInterval: 20000,
    pongTimeout: 7000
  }
}

/**
 * Get configuration for current environment
 * @param {string} env - Environment name (development, production, staging)
 * @returns {object} WebSocket configuration
 */
export function getWebSocketConfig(env = 'development') {
  return websocketConfig[env] || websocketConfig.development
}

/**
 * Example usage in your application:
 * 
 * import { getWebSocketConfig } from './websocket.config.js'
 * import { enhancedWebSocketService } from './services/websocketService'
 * 
 * const config = getWebSocketConfig(process.env.NODE_ENV)
 * enhancedWebSocketService.connect(config)
 */