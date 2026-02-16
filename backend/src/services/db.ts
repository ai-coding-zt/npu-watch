import Database from 'better-sqlite3';
import crypto from 'crypto';
import { ServerConfig, ConnectionStatus, NPUHistoryRecord, SystemHistoryRecord, RefreshConfig, CacheStatusOverview } from '../types.js';
import { v4 as uuidv4 } from 'uuid';

const db = new Database('npu-watch.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS servers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER DEFAULT 22,
    username TEXT NOT NULL,
    auth_type TEXT NOT NULL,
    password TEXT,
    private_key TEXT,
    passphrase TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS server_connections (
    server_id TEXT PRIMARY KEY,
    connected INTEGER DEFAULT 0,
    last_connected INTEGER,
    last_error TEXT,
    auto_refresh INTEGER DEFAULT 1,
    refresh_interval INTEGER DEFAULT 30000,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS npu_cache (
    server_id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    last_updated INTEGER NOT NULL,
    last_success INTEGER,
    error TEXT,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS system_cache (
    server_id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    last_updated INTEGER NOT NULL,
    last_success INTEGER,
    error TEXT,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS npu_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id TEXT NOT NULL,
    npu_id INTEGER NOT NULL,
    chip_id INTEGER NOT NULL,
    temperature INTEGER,
    power_usage INTEGER,
    memory_usage_rate INTEGER,
    ai_core_usage INTEGER,
    ecc_error_count INTEGER,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS system_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id TEXT NOT NULL,
    memory_usage_percent INTEGER,
    storage_usage_percent INTEGER,
    container_count INTEGER,
    running_containers INTEGER,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_npu_history_server_time ON npu_history(server_id, timestamp);
  CREATE INDEX IF NOT EXISTS idx_system_history_server_time ON system_history(server_id, timestamp);
`);

const ENCRYPTION_KEY = crypto.scryptSync('npu-watch-secret-key', 'salt', 32);
const IV_LENGTH = 16;

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedData: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 2) return encryptedData;
  
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function createServer(data: Omit<ServerConfig, 'id' | 'createdAt' | 'updatedAt'>): ServerConfig {
  const id = uuidv4();
  const now = Date.now();
  
  const server: ServerConfig = {
    id,
    ...data,
    createdAt: now,
    updatedAt: now
  };

  const stmt = db.prepare(`
    INSERT INTO servers (id, name, host, port, username, auth_type, password, private_key, passphrase, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    server.id,
    server.name,
    server.host,
    server.port,
    server.username,
    server.authType,
    server.password ? encrypt(server.password) : null,
    server.privateKey || null,
    server.passphrase ? encrypt(server.passphrase) : null,
    server.createdAt,
    server.updatedAt
  );

  return server;
}

export function getAllServers(): Omit<ServerConfig, 'password' | 'privateKey' | 'passphrase'>[] {
  const stmt = db.prepare('SELECT id, name, host, port, username, auth_type, created_at, updated_at FROM servers');
  const rows = stmt.all() as Record<string, unknown>[];
  
  return rows.map(row => ({
    id: row.id as string,
    name: row.name as string,
    host: row.host as string,
    port: row.port as number,
    username: row.username as string,
    authType: row.auth_type as 'password' | 'key',
    hasPassword: true,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number
  }));
}

export function getServerById(id: string): ServerConfig | null {
  const stmt = db.prepare('SELECT * FROM servers WHERE id = ?');
  const row = stmt.get(id) as Record<string, unknown> | undefined;
  
  if (!row) return null;
  
  return {
    id: row.id as string,
    name: row.name as string,
    host: row.host as string,
    port: row.port as number,
    username: row.username as string,
    authType: row.auth_type as 'password' | 'key',
    password: row.password ? decrypt(row.password as string) : undefined,
    privateKey: row.private_key as string | undefined,
    passphrase: row.passphrase ? decrypt(row.passphrase as string) : undefined,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number
  };
}

export function updateServer(id: string, data: Partial<Omit<ServerConfig, 'id' | 'createdAt' | 'updatedAt'>>): ServerConfig | null {
  const existing = getServerById(id);
  if (!existing) return null;

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    values.push(data.name);
  }
  if (data.host !== undefined) {
    updates.push('host = ?');
    values.push(data.host);
  }
  if (data.port !== undefined) {
    updates.push('port = ?');
    values.push(data.port);
  }
  if (data.username !== undefined) {
    updates.push('username = ?');
    values.push(data.username);
  }
  if (data.authType !== undefined) {
    updates.push('auth_type = ?');
    values.push(data.authType);
  }
  if (data.password !== undefined) {
    updates.push('password = ?');
    values.push(data.password ? encrypt(data.password) : null);
  }
  if (data.privateKey !== undefined) {
    updates.push('private_key = ?');
    values.push(data.privateKey || null);
  }
  if (data.passphrase !== undefined) {
    updates.push('passphrase = ?');
    values.push(data.passphrase ? encrypt(data.passphrase) : null);
  }

  updates.push('updated_at = ?');
  values.push(Date.now());
  values.push(id);

  const stmt = db.prepare(`UPDATE servers SET ${updates.join(', ')} WHERE id = ?`);
  stmt.run(...values);

  return getServerById(id);
}

export function deleteServer(id: string): boolean {
  const stmt = db.prepare('DELETE FROM servers WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function initServerConnection(serverId: string): void {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO server_connections (server_id, connected, auto_refresh, refresh_interval)
    VALUES (?, 0, 1, 30000)
  `);
  stmt.run(serverId);
}

export function getConnectionStatus(serverId: string): ConnectionStatus | null {
  const stmt = db.prepare('SELECT * FROM server_connections WHERE server_id = ?');
  const row = stmt.get(serverId) as Record<string, unknown> | undefined;
  
  if (!row) return null;
  
  return {
    serverId: row.server_id as string,
    connected: row.connected === 1,
    lastConnected: row.last_connected as number | undefined,
    lastError: row.last_error as string | undefined,
    autoRefresh: row.auto_refresh === 1,
    refreshInterval: row.refresh_interval as number
  };
}

export function setConnectionStatus(
  serverId: string, 
  connected: boolean, 
  error?: string
): void {
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO server_connections (server_id, connected, last_connected, last_error, auto_refresh, refresh_interval)
    VALUES (?, ?, ?, ?, 1, 30000)
    ON CONFLICT(server_id) DO UPDATE SET
      connected = excluded.connected,
      last_connected = CASE WHEN excluded.connected = 1 THEN ? ELSE last_connected END,
      last_error = excluded.last_error
  `);
  stmt.run(serverId, connected ? 1 : 0, connected ? now : null, error || null, connected ? now : null);
}

export function updateRefreshConfig(serverId: string, config: RefreshConfig): void {
  const stmt = db.prepare(`
    UPDATE server_connections 
    SET auto_refresh = ?, refresh_interval = ?
    WHERE server_id = ?
  `);
  stmt.run(config.autoRefresh ? 1 : 0, config.refreshInterval, serverId);
}

export function getRefreshConfig(serverId: string): RefreshConfig | null {
  const stmt = db.prepare('SELECT auto_refresh, refresh_interval FROM server_connections WHERE server_id = ?');
  const row = stmt.get(serverId) as Record<string, unknown> | undefined;
  
  if (!row) return null;
  
  return {
    autoRefresh: row.auto_refresh === 1,
    refreshInterval: row.refresh_interval as number
  };
}

export function getNPUCache(serverId: string): { data: string; lastUpdated: number; lastSuccess?: number; error?: string } | null {
  const stmt = db.prepare('SELECT data, last_updated, last_success, error FROM npu_cache WHERE server_id = ?');
  const row = stmt.get(serverId) as Record<string, unknown> | undefined;
  
  if (!row) return null;
  
  return {
    data: row.data as string,
    lastUpdated: row.last_updated as number,
    lastSuccess: row.last_success as number | undefined,
    error: row.error as string | undefined
  };
}

export function setNPUCache(
  serverId: string, 
  data: string, 
  success: boolean, 
  error?: string
): void {
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO npu_cache (server_id, data, last_updated, last_success, error)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(server_id) DO UPDATE SET
      data = excluded.data,
      last_updated = excluded.last_updated,
      last_success = CASE WHEN ? = 1 THEN excluded.last_success ELSE last_success END,
      error = excluded.error
  `);
  stmt.run(serverId, data, now, success ? now : null, error || null, success ? 1 : 0);
}

export function getSystemCache(serverId: string): { data: string; lastUpdated: number; lastSuccess?: number; error?: string } | null {
  const stmt = db.prepare('SELECT data, last_updated, last_success, error FROM system_cache WHERE server_id = ?');
  const row = stmt.get(serverId) as Record<string, unknown> | undefined;
  
  if (!row) return null;
  
  return {
    data: row.data as string,
    lastUpdated: row.last_updated as number,
    lastSuccess: row.last_success as number | undefined,
    error: row.error as string | undefined
  };
}

export function setSystemCache(
  serverId: string, 
  data: string, 
  success: boolean, 
  error?: string
): void {
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO system_cache (server_id, data, last_updated, last_success, error)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(server_id) DO UPDATE SET
      data = excluded.data,
      last_updated = excluded.last_updated,
      last_success = CASE WHEN ? = 1 THEN excluded.last_success ELSE last_success END,
      error = excluded.error
  `);
  stmt.run(serverId, data, now, success ? now : null, error || null, success ? 1 : 0);
}

export function addNPUHistory(records: Omit<NPUHistoryRecord, 'id'>[]): void {
  const stmt = db.prepare(`
    INSERT INTO npu_history (server_id, npu_id, chip_id, temperature, power_usage, memory_usage_rate, ai_core_usage, ecc_error_count, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insert = db.transaction((items: Omit<NPUHistoryRecord, 'id'>[]) => {
    for (const item of items) {
      stmt.run(
        item.serverId, item.npuId, item.chipId, item.temperature, 
        item.powerUsage, item.memoryUsageRate, item.aiCoreUsage, 
        item.eccErrorCount, item.timestamp
      );
    }
  });
  
  insert(records);
}

export function getNPUHistory(
  serverId: string, 
  npuId: number, 
  chipId: number,
  startTime: number, 
  endTime: number
): NPUHistoryRecord[] {
  const stmt = db.prepare(`
    SELECT * FROM npu_history 
    WHERE server_id = ? AND npu_id = ? AND chip_id = ? AND timestamp BETWEEN ? AND ?
    ORDER BY timestamp ASC
  `);
  const rows = stmt.all(serverId, npuId, chipId, startTime, endTime) as Record<string, unknown>[];
  
  return rows.map(row => ({
    id: row.id as number,
    serverId: row.server_id as string,
    npuId: row.npu_id as number,
    chipId: row.chip_id as number,
    temperature: row.temperature as number,
    powerUsage: row.power_usage as number,
    memoryUsageRate: row.memory_usage_rate as number,
    aiCoreUsage: row.ai_core_usage as number,
    eccErrorCount: row.ecc_error_count as number,
    timestamp: row.timestamp as number
  }));
}

export function addSystemHistory(record: Omit<SystemHistoryRecord, 'id'>): void {
  const stmt = db.prepare(`
    INSERT INTO system_history (server_id, memory_usage_percent, storage_usage_percent, container_count, running_containers, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    record.serverId, record.memoryUsagePercent, record.storageUsagePercent, 
    record.containerCount, record.runningContainers, record.timestamp
  );
}

export function getSystemHistory(
  serverId: string, 
  startTime: number, 
  endTime: number
): SystemHistoryRecord[] {
  const stmt = db.prepare(`
    SELECT * FROM system_history 
    WHERE server_id = ? AND timestamp BETWEEN ? AND ?
    ORDER BY timestamp ASC
  `);
  const rows = stmt.all(serverId, startTime, endTime) as Record<string, unknown>[];
  
  return rows.map(row => ({
    id: row.id as number,
    serverId: row.server_id as string,
    memoryUsagePercent: row.memory_usage_percent as number,
    storageUsagePercent: row.storage_usage_percent as number,
    containerCount: row.container_count as number,
    runningContainers: row.running_containers as number,
    timestamp: row.timestamp as number
  }));
}

export function getCacheStatusOverview(): CacheStatusOverview[] {
  const stmt = db.prepare(`
    SELECT 
      s.id as server_id, 
      s.name as server_name,
      sc.connected,
      sc.auto_refresh,
      sc.refresh_interval,
      sc.last_error,
      nc.last_updated as npu_last_updated,
      syc.last_updated as system_last_updated
    FROM servers s
    LEFT JOIN server_connections sc ON s.id = sc.server_id
    LEFT JOIN npu_cache nc ON s.id = nc.server_id
    LEFT JOIN system_cache syc ON s.id = syc.server_id
  `);
  const rows = stmt.all() as Record<string, unknown>[];
  
  return rows.map(row => ({
    serverId: row.server_id as string,
    serverName: row.server_name as string,
    connected: row.connected === 1,
    autoRefresh: row.auto_refresh === 1,
    refreshInterval: row.refresh_interval as number,
    npuLastUpdated: row.npu_last_updated as number | undefined,
    systemLastUpdated: row.system_last_updated as number | undefined,
    lastError: row.last_error as string | undefined
  }));
}

export function cleanupOldHistory(beforeTimestamp: number): void {
  const npuStmt = db.prepare('DELETE FROM npu_history WHERE timestamp < ?');
  const sysStmt = db.prepare('DELETE FROM system_history WHERE timestamp < ?');
  npuStmt.run(beforeTimestamp);
  sysStmt.run(beforeTimestamp);
}

export function getAllServerIds(): string[] {
  const stmt = db.prepare('SELECT id FROM servers');
  const rows = stmt.all() as Record<string, unknown>[];
  return rows.map(row => row.id as string);
}
