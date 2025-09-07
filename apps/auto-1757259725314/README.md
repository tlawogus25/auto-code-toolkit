# Enhanced WebSocket Demo

This sandbox demonstrates an enhanced WebSocket implementation with:

## Features

- **Dynamic WebSocket URL Generation**: Configurable URLs with environment-specific settings
- **StrictMode Race Condition Handling**: Prevents duplicate connections in React StrictMode
- **Connection Management**: Robust reconnection logic with exponential backoff
- **Ping/Pong Implementation**: Connection health monitoring
- **Enhanced Error Handling**: Comprehensive error states and user feedback
- **Message Badge System**: Real-time server message notifications

## Project Structure

```
├── src/
│   ├── services/
│   │   └── websocketService.ts     # Enhanced WebSocket service
│   ├── utils/
│   │   └── websocketUtils.ts       # URL generation utilities
│   ├── components/
│   │   ├── ConnectionStatus.tsx    # Connection state display
│   │   └── MessageBadge.tsx        # Server message notifications
│   └── App.tsx                     # Main application
├── docs/
│   └── SANDBOX_PROMOTION_GUIDE.md  # Integration guide
├── tests/                          # Unit tests
└── websocket.config.sample.js      # Configuration template

```

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy and configure WebSocket settings:
   ```bash
   cp websocket.config.sample.js websocket.config.js
   # Edit websocket.config.js for your environment
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

## Integration Guide

Ready to integrate this enhanced WebSocket implementation into your main project? 

📖 **[Sandbox Promotion Guide](./docs/SANDBOX_PROMOTION_GUIDE.md)**

This comprehensive guide covers:
- Platform-specific integration steps (macOS/Windows)
- Pre-integration checklist
- Common integration issues and solutions
- Rollback procedures
- Best practices

## Configuration

The WebSocket service supports dynamic configuration:

```typescript
import { enhancedWebSocketService } from './services/websocketService'

// Connect with custom configuration
await enhancedWebSocketService.connect({
  protocol: 'wss',
  host: 'api.example.com', 
  port: 443,
  path: '/websocket',
  params: { version: '1.0', client: 'web' }
})
```

## Key Improvements

### StrictMode Compatibility
- Prevents duplicate WebSocket connections
- Race condition handling with connection attempt IDs
- Proper cleanup in React StrictMode

### Connection Management
- Exponential backoff reconnection strategy
- Intentional disconnect flags
- Connection state tracking

### Health Monitoring
- Automatic ping/pong implementation
- Connection timeout detection
- Last pong timestamp tracking

### Error Handling
- Comprehensive error states
- User-friendly error messages
- Connection status indicators

## Testing

Run the test suite:
```bash
npm test          # Unit tests
npm run test:e2e  # End-to-end tests (if available)
```

## Building

Build for production:
```bash
npm run build
npm run typecheck  # Type checking
npm run lint      # Code linting
```
