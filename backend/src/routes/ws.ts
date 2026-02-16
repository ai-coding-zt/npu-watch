import WebSocket from 'ws';
import * as terminal from '../services/terminal.js';
import * as ssh from '../services/ssh.js';
import * as db from '../services/db.js';
import type { TerminalMessage } from '../types.js';
import { ERR_WS_INVALID_PATH, ERR_WS_SERVER_NOT_FOUND, ERR_WS_NOT_CONNECTED, DEFAULT_TERMINAL_COLS, DEFAULT_TERMINAL_ROWS, WS_CLOSE_INVALID_PATH, WS_CLOSE_SERVER_NOT_FOUND, WS_CLOSE_NOT_CONNECTED } from '../constants/index.js';

export function setupWebSocket(wss: WebSocket.Server): void {
  wss.on('connection', async (ws, req) => {
    console.log('[WS] New connection attempt from:', req.socket.remoteAddress);
    
    const url = new URL(req.url || '', `http://localhost`);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    console.log('[WS] URL pathname:', url.pathname, 'Path parts:', pathParts);
    
    if (pathParts.length < 3 || pathParts[1] !== 'terminal') {
      console.log('[WS] Invalid path, closing connection');
      ws.close(WS_CLOSE_INVALID_PATH, ERR_WS_INVALID_PATH);
      return;
    }
    
    const serverId = pathParts[2];
    console.log('[WS] Server ID:', serverId);
    
    const server = db.getServerById(serverId);
    if (!server) {
      console.log('[WS] Server not found');
      ws.close(WS_CLOSE_SERVER_NOT_FOUND, ERR_WS_SERVER_NOT_FOUND);
      return;
    }
    
    const isAlive = await ssh.isConnectionAlive(serverId);
    if (!isAlive) {
      console.log('[WS] SSH not connected for server:', serverId);
      ws.close(WS_CLOSE_NOT_CONNECTED, ERR_WS_NOT_CONNECTED);
      return;
    }
    
    console.log('[WS] Connection accepted, creating session');
    
    const cols = parseInt(url.searchParams.get('cols') || String(DEFAULT_TERMINAL_COLS), 10);
    const rows = parseInt(url.searchParams.get('rows') || String(DEFAULT_TERMINAL_ROWS), 10);
    
    const sessionId = terminal.createSession(serverId, ws, cols, rows);
    
    ws.on('message', async (data: Buffer) => {
      try {
        const message: TerminalMessage = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'input':
            if (message.data) {
              terminal.writeToSession(sessionId, message.data);
            }
            break;
            
          case 'resize':
            if (message.cols && message.rows) {
              terminal.resizeSession(sessionId, message.cols, message.rows);
            }
            break;
            
          case 'create':
            await terminal.startShell(sessionId);
            break;
            
          case 'close':
            terminal.closeSession(sessionId, 'User closed');
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });
    
    ws.on('close', () => {
      terminal.closeSession(sessionId, 'WebSocket closed');
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      terminal.closeSession(sessionId, 'WebSocket error');
    });
    
    terminal.startShell(sessionId).catch((error) => {
      const errorMessage: TerminalMessage = {
        type: 'error',
        sessionId,
        message: error instanceof Error ? error.message : 'Failed to start shell'
      };
      ws.send(JSON.stringify(errorMessage));
      ws.close();
    });
  });
}
