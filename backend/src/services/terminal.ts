import { NodeSSH } from 'node-ssh';
import * as ssh from './ssh.js';
import { v4 as uuidv4 } from 'uuid';
import type { TerminalSession, TerminalMessage } from '../types.js';
import WebSocket from 'ws';
import { ERR_TERMINAL_NOT_FOUND, ERR_SSH_NOT_CONNECTED, DEFAULT_TERMINAL_COLS, DEFAULT_TERMINAL_ROWS } from '../constants/index.js';

interface ActiveTerminal {
  id: string;
  serverId: string;
  ws: WebSocket;
  stream: NodeJS.WritableStream | null;
  cols: number;
  rows: number;
  createdAt: number;
}

const activeTerminals = new Map<string, ActiveTerminal>();
const serverTerminals = new Map<string, Set<string>>();

function getSSHClient(serverId: string): NodeSSH | null {
  return (ssh as unknown as { getConnection: (id: string) => NodeSSH | null }).getConnection?.(serverId) || null;
}

export function createSession(serverId: string, ws: WebSocket, cols: number = DEFAULT_TERMINAL_COLS, rows: number = DEFAULT_TERMINAL_ROWS): string {
  const sessionId = uuidv4();
  
  const terminal: ActiveTerminal = {
    id: sessionId,
    serverId,
    ws,
    stream: null,
    cols,
    rows,
    createdAt: Date.now()
  };
  
  activeTerminals.set(sessionId, terminal);
  
  if (!serverTerminals.has(serverId)) {
    serverTerminals.set(serverId, new Set());
  }
  serverTerminals.get(serverId)!.add(sessionId);
  
  return sessionId;
}

export async function startShell(sessionId: string): Promise<void> {
  const terminal = activeTerminals.get(sessionId);
  if (!terminal) {
    throw new Error(ERR_TERMINAL_NOT_FOUND);
  }
  
  const client = getSSHClient(terminal.serverId);
  if (!client) {
    throw new Error(ERR_SSH_NOT_CONNECTED);
  }
  
  try {
    const shell = await client.requestShell({
      cols: terminal.cols,
      rows: terminal.rows,
      term: 'xterm-256color'
    });
    
    terminal.stream = shell;
    
    shell.on('data', (data: Buffer) => {
      if (terminal.ws.readyState === WebSocket.OPEN) {
        const message: TerminalMessage = {
          type: 'output',
          sessionId,
          data: data.toString('utf-8')
        };
        terminal.ws.send(JSON.stringify(message));
      }
    });
    
    shell.on('close', () => {
      closeSession(sessionId, 'Shell closed');
    });
    
    shell.stderr?.on('data', (data: Buffer) => {
      if (terminal.ws.readyState === WebSocket.OPEN) {
        const message: TerminalMessage = {
          type: 'output',
          sessionId,
          data: data.toString('utf-8')
        };
        terminal.ws.send(JSON.stringify(message));
      }
    });
    
    const createdMessage: TerminalMessage = {
      type: 'created',
      sessionId
    };
    terminal.ws.send(JSON.stringify(createdMessage));
    
  } catch (error) {
    closeSession(sessionId, error instanceof Error ? error.message : 'Failed to start shell');
    throw error;
  }
}

export function writeToSession(sessionId: string, data: string): void {
  const terminal = activeTerminals.get(sessionId);
  if (!terminal || !terminal.stream) {
    return;
  }
  
  (terminal.stream as NodeJS.WritableStream).write(data);
}

export function resizeSession(sessionId: string, cols: number, rows: number): void {
  const terminal = activeTerminals.get(sessionId);
  if (!terminal) {
    return;
  }
  
  terminal.cols = cols;
  terminal.rows = rows;
  
  if (terminal.stream && 'setWindow' in terminal.stream) {
    (terminal.stream as { setWindow: (rows: number, cols: number) => void }).setWindow(rows, cols);
  }
}

export function closeSession(sessionId: string, reason?: string): void {
  const terminal = activeTerminals.get(sessionId);
  if (!terminal) return;
  
  if (terminal.stream) {
    try {
      (terminal.stream as NodeJS.WritableStream).end();
    } catch {
      // ignore
    }
  }
  
  if (terminal.ws.readyState === WebSocket.OPEN) {
    const message: TerminalMessage = {
      type: 'close',
      sessionId,
      message: reason || 'Session closed'
    };
    terminal.ws.send(JSON.stringify(message));
  }
  
  activeTerminals.delete(sessionId);
  
  const serverSessions = serverTerminals.get(terminal.serverId);
  if (serverSessions) {
    serverSessions.delete(sessionId);
    if (serverSessions.size === 0) {
      serverTerminals.delete(terminal.serverId);
    }
  }
}

export function closeAllSessionsForServer(serverId: string): void {
  const sessionIds = serverTerminals.get(serverId);
  if (!sessionIds) return;
  
  for (const sessionId of sessionIds) {
    closeSession(sessionId, 'Server disconnected');
  }
}

export function getSessionsForServer(serverId: string): TerminalSession[] {
  const sessionIds = serverTerminals.get(serverId);
  if (!sessionIds) return [];
  
  return Array.from(sessionIds)
    .map(id => activeTerminals.get(id))
    .filter((t): t is ActiveTerminal => t !== undefined)
    .map(t => ({
      id: t.id,
      serverId: t.serverId,
      cols: t.cols,
      rows: t.rows,
      createdAt: t.createdAt
    }));
}

export function getSession(sessionId: string): TerminalSession | null {
  const terminal = activeTerminals.get(sessionId);
  if (!terminal) return null;
  
  return {
    id: terminal.id,
    serverId: terminal.serverId,
    cols: terminal.cols,
    rows: terminal.rows,
    createdAt: terminal.createdAt
  };
}

export function updateSessionWebSocket(sessionId: string, ws: WebSocket): boolean {
  const terminal = activeTerminals.get(sessionId);
  if (!terminal) return false;
  
  terminal.ws = ws;
  return true;
}
