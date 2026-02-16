import { NodeSSH } from 'node-ssh';
import type { ServerConfig } from '../types.js';
import { ERR_NOT_CONNECTED, DEFAULT_SSH_TIMEOUT_MS } from '../constants/index.js';

const connections = new Map<string, NodeSSH>();

export async function connect(server: ServerConfig, rawPassword?: string): Promise<NodeSSH> {
  const existing = connections.get(server.id);
  if (existing) {
    try {
      await existing.execCommand('echo alive');
      return existing;
    } catch {
      connections.delete(server.id);
    }
  }

  const ssh = new NodeSSH();
  
  const config: {
    host: string;
    port: number;
    username: string;
    password?: string;
    privateKey?: string;
    passphrase?: string;
  } = {
    host: server.host,
    port: server.port,
    username: server.username
  };

  if (server.authType === 'password') {
    config.password = rawPassword || server.password;
  } else {
    config.privateKey = server.privateKey;
    if (server.passphrase) {
      config.passphrase = server.passphrase;
    }
  }

  await ssh.connect(config);
  connections.set(server.id, ssh);
  
  return ssh;
}

export async function disconnect(serverId: string): Promise<void> {
  const ssh = connections.get(serverId);
  if (ssh) {
    ssh.dispose();
    connections.delete(serverId);
  }
}

export async function executeCommand(serverId: string, command: string, timeoutMs: number = DEFAULT_SSH_TIMEOUT_MS): Promise<{ stdout: string; stderr: string; code: number }> {
  const ssh = connections.get(serverId);
  if (!ssh) {
    throw new Error(ERR_NOT_CONNECTED);
  }

  const result = await ssh.execCommand(command, { execOptions: { timeout: timeoutMs } });
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    code: result.code ?? 0
  };
}

export function isConnected(serverId: string): boolean {
  return connections.has(serverId);
}

export async function isConnectionAlive(serverId: string): Promise<boolean> {
  const ssh = connections.get(serverId);
  if (!ssh) return false;
  
  try {
    await ssh.execCommand('echo alive', { execOptions: { timeout: 5000 } });
    return true;
  } catch {
    connections.delete(serverId);
    return false;
  }
}

export function getConnection(serverId: string): NodeSSH | null {
  return connections.get(serverId) || null;
}
