import { GameServer } from './server/gameServer.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8080;

const server = new GameServer(PORT);

process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});