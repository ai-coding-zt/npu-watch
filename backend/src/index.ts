import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as WebSocketServer } from 'ws';
import { router as apiRouter } from './routes/api.js';
import { scheduler } from './services/scheduler.js';
import { setupWebSocket } from './routes/ws.js';

const app = express();
const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.use('/api', apiRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({ success: false, error: err.message });
});

const server = createServer(app);
const wss = new WebSocketServer({ server });

setupWebSocket(wss);

server.listen(Number(PORT), HOST, async () => {
  console.log(`NPU Watch API running on http://${HOST}:${PORT}`);
  console.log(`WebSocket server running on ws://${HOST}:${PORT}/api/terminal/:serverId`);
  
  try {
    await scheduler.start();
  } catch (error) {
    console.error('Failed to start scheduler:', error);
  }
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  scheduler.stop();
  wss.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  scheduler.stop();
  wss.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
