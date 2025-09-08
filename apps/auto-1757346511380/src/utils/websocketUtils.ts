/**
 * WebSocket URL utilities for dynamic connection management
 */

export interface WebSocketConfig {
  protocol?: 'ws' | 'wss'
  host?: string
  port?: number
  path?: string
  params?: Record<string, string>
}

/**
 * Generates a WebSocket URL from configuration options
 * @param config WebSocket configuration
 * @returns Complete WebSocket URL
 */
export function generateWebSocketURL(config: WebSocketConfig = {}): string {
  const {
    protocol = window.location.protocol === 'https:' ? 'wss' : 'ws',
    host = window.location.hostname,
    port = window.location.protocol === 'https:' ? 443 : 8080,
    path = '',
    params = {}
  } = config

  let url = `${protocol}://${host}`

  // Add port if not default
  if ((protocol === 'ws' && port !== 80) || (protocol === 'wss' && port !== 443)) {
    url += `:${port}`
  }

  // Add path
  if (path) {
    url += path.startsWith('/') ? path : `/${path}`
  }

  // Add query parameters
  const queryString = new URLSearchParams(params).toString()
  if (queryString) {
    url += `?${queryString}`
  }

  return url
}

/**
 * Validates if a WebSocket URL is properly formatted
 * @param url WebSocket URL to validate
 * @returns true if valid, false otherwise
 */
export function isValidWebSocketURL(url: string): boolean {
  try {
    const parsedURL = new URL(url)
    return parsedURL.protocol === 'ws:' || parsedURL.protocol === 'wss:'
  } catch {
    return false
  }
}

/**
 * Extracts configuration from a WebSocket URL
 * @param url WebSocket URL
 * @returns WebSocket configuration object
 */
export function parseWebSocketURL(url: string): WebSocketConfig | null {
  try {
    const parsedURL = new URL(url)
    
    if (parsedURL.protocol !== 'ws:' && parsedURL.protocol !== 'wss:') {
      return null
    }

    const params: Record<string, string> = {}
    parsedURL.searchParams.forEach((value, key) => {
      params[key] = value
    })

    const protocol = parsedURL.protocol.slice(0, -1) as 'ws' | 'wss'
    let port: number | undefined
    
    if (parsedURL.port) {
      port = parseInt(parsedURL.port, 10)
    } else {
      // Handle explicit default ports in URL
      if (parsedURL.protocol === 'wss:' && parsedURL.href.includes(':443')) {
        port = 443
      } else if (parsedURL.protocol === 'ws:' && parsedURL.href.includes(':80')) {
        port = 80
      }
    }

    return {
      protocol,
      host: parsedURL.hostname,
      port,
      path: parsedURL.pathname,
      params
    }
  } catch {
    return null
  }
}