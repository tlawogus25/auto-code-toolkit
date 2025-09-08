import { describe, it, expect, beforeEach } from 'vitest'
import { 
  generateWebSocketURL, 
  isValidWebSocketURL, 
  parseWebSocketURL 
} from '../src/utils/websocketUtils'

// Mock window.location
const mockLocation = {
  hostname: 'localhost',
  protocol: 'http:'
}

beforeEach(() => {
  Object.defineProperty(window, 'location', {
    value: mockLocation,
    writable: true
  })
})

describe('websocketUtils', () => {
  describe('generateWebSocketURL', () => {
    it('should generate default WebSocket URL', () => {
      mockLocation.protocol = 'http:'
      const url = generateWebSocketURL()
      expect(url).toBe('ws://localhost:8080')
    })

    it('should use wss protocol when current page is https', () => {
      mockLocation.protocol = 'https:'
      const url = generateWebSocketURL()
      expect(url).toBe('wss://localhost')
    })

    it('should generate URL with custom configuration', () => {
      const config = {
        protocol: 'wss' as const,
        host: 'api.example.com',
        port: 9000,
        path: '/websocket'
      }
      const url = generateWebSocketURL(config)
      expect(url).toBe('wss://api.example.com:9000/websocket')
    })

    it('should handle path with leading slash', () => {
      mockLocation.protocol = 'http:'
      const config = { path: '/ws' }
      const url = generateWebSocketURL(config)
      expect(url).toBe('ws://localhost:8080/ws')
    })

    it('should handle path without leading slash', () => {
      mockLocation.protocol = 'http:'
      const config = { path: 'ws' }
      const url = generateWebSocketURL(config)
      expect(url).toBe('ws://localhost:8080/ws')
    })

    it('should include query parameters', () => {
      mockLocation.protocol = 'http:'
      const config = {
        params: { 
          version: '1.0', 
          client: 'web' 
        }
      }
      const url = generateWebSocketURL(config)
      expect(url).toBe('ws://localhost:8080?version=1.0&client=web')
    })

    it('should not include default ports', () => {
      const wsConfig = {
        protocol: 'ws' as const,
        port: 80
      }
      const wssConfig = {
        protocol: 'wss' as const,
        port: 443
      }
      
      expect(generateWebSocketURL(wsConfig)).toBe('ws://localhost')
      expect(generateWebSocketURL(wssConfig)).toBe('wss://localhost')
    })

    it('should include non-default ports', () => {
      const config = {
        protocol: 'ws' as const,
        port: 3000
      }
      const url = generateWebSocketURL(config)
      expect(url).toBe('ws://localhost:3000')
    })

    it('should handle complex configuration', () => {
      const config = {
        protocol: 'wss' as const,
        host: 'api.example.com',
        port: 9000,
        path: '/v1/websocket',
        params: {
          token: 'abc123',
          version: '2.0',
          client: 'web'
        }
      }
      const url = generateWebSocketURL(config)
      expect(url).toBe('wss://api.example.com:9000/v1/websocket?token=abc123&version=2.0&client=web')
    })
  })

  describe('isValidWebSocketURL', () => {
    it('should validate ws URLs', () => {
      expect(isValidWebSocketURL('ws://localhost:8080')).toBe(true)
      expect(isValidWebSocketURL('ws://example.com/ws')).toBe(true)
    })

    it('should validate wss URLs', () => {
      expect(isValidWebSocketURL('wss://api.example.com:443')).toBe(true)
      expect(isValidWebSocketURL('wss://secure.example.com/websocket')).toBe(true)
    })

    it('should reject non-WebSocket protocols', () => {
      expect(isValidWebSocketURL('http://example.com')).toBe(false)
      expect(isValidWebSocketURL('https://example.com')).toBe(false)
      expect(isValidWebSocketURL('ftp://example.com')).toBe(false)
    })

    it('should reject malformed URLs', () => {
      expect(isValidWebSocketURL('not-a-url')).toBe(false)
      expect(isValidWebSocketURL('ws://')).toBe(false)
      expect(isValidWebSocketURL('')).toBe(false)
    })

    it('should handle URLs with query parameters', () => {
      expect(isValidWebSocketURL('ws://localhost:8080?version=1.0')).toBe(true)
      expect(isValidWebSocketURL('wss://api.example.com/ws?token=abc&client=web')).toBe(true)
    })
  })

  describe('parseWebSocketURL', () => {
    it('should parse basic ws URL', () => {
      const config = parseWebSocketURL('ws://localhost:8080')
      expect(config).toEqual({
        protocol: 'ws',
        host: 'localhost',
        port: 8080,
        path: '/',
        params: {}
      })
    })

    it('should parse basic wss URL', () => {
      const config = parseWebSocketURL('wss://api.example.com:443')
      expect(config).toEqual({
        protocol: 'wss',
        host: 'api.example.com',
        port: undefined, // Default port is omitted by URL constructor
        path: '/',
        params: {}
      })
    })

    it('should parse wss URL with explicit non-default port', () => {
      const config = parseWebSocketURL('wss://api.example.com:8443')
      expect(config).toEqual({
        protocol: 'wss',
        host: 'api.example.com',
        port: 8443,
        path: '/',
        params: {}
      })
    })

    it('should parse URL with path', () => {
      const config = parseWebSocketURL('ws://localhost:8080/websocket/v1')
      expect(config).toEqual({
        protocol: 'ws',
        host: 'localhost',
        port: 8080,
        path: '/websocket/v1',
        params: {}
      })
    })

    it('should parse URL with query parameters', () => {
      const config = parseWebSocketURL('ws://localhost:8080/ws?version=1.0&client=web')
      expect(config).toEqual({
        protocol: 'ws',
        host: 'localhost', 
        port: 8080,
        path: '/ws',
        params: {
          version: '1.0',
          client: 'web'
        }
      })
    })

    it('should handle URL without explicit port', () => {
      const config = parseWebSocketURL('wss://api.example.com/ws')
      expect(config).toEqual({
        protocol: 'wss',
        host: 'api.example.com',
        port: undefined,
        path: '/ws',
        params: {}
      })
    })

    it('should return null for invalid URLs', () => {
      expect(parseWebSocketURL('http://example.com')).toBe(null)
      expect(parseWebSocketURL('https://example.com')).toBe(null)
      expect(parseWebSocketURL('not-a-url')).toBe(null)
      expect(parseWebSocketURL('')).toBe(null)
    })

    it('should handle complex URL', () => {
      const url = 'wss://api.example.com:9000/v1/websocket?token=abc123&version=2.0&client=web'
      const config = parseWebSocketURL(url)
      expect(config).toEqual({
        protocol: 'wss',
        host: 'api.example.com',
        port: 9000,
        path: '/v1/websocket',
        params: {
          token: 'abc123',
          version: '2.0',
          client: 'web'
        }
      })
    })

    it('should handle URLs with empty query parameters', () => {
      const config = parseWebSocketURL('ws://localhost:8080?')
      expect(config).toEqual({
        protocol: 'ws',
        host: 'localhost',
        port: 8080,
        path: '/',
        params: {}
      })
    })
  })

  describe('round-trip compatibility', () => {
    it('should generate and parse URLs consistently', () => {
      const originalConfig = {
        protocol: 'wss' as const,
        host: 'api.example.com',
        port: 9000,
        path: '/websocket',
        params: {
          version: '1.0',
          client: 'web'
        }
      }
      
      const generatedURL = generateWebSocketURL(originalConfig)
      const parsedConfig = parseWebSocketURL(generatedURL)
      
      expect(parsedConfig).toEqual(originalConfig)
    })

    it('should handle default port round-trip', () => {
      const config = {
        protocol: 'wss' as const,
        host: 'example.com',
        port: 443
      }
      
      const url = generateWebSocketURL(config)
      const parsed = parseWebSocketURL(url)
      
      expect(url).toBe('wss://example.com')
      expect(parsed?.protocol).toBe('wss')
      expect(parsed?.host).toBe('example.com')
      expect(parsed?.port).toBeUndefined() // Default ports are omitted
    })
  })
})