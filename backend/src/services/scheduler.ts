import * as db from './db.js';
import * as ssh from './ssh.js';
import * as npu from './npu-parser.js';
import * as sys from './system-parser.js';
import * as cache from './cache.js';
import type { ServerConfig } from '../types.js';
import { ERR_SSH_NOT_CONNECTED, DEFAULT_REFRESH_INTERVAL_MS, MAX_RECONNECT_ATTEMPTS, INITIAL_RECONNECT_INTERVAL_1M_MS, MAX_RECONNECT_INTERVAL_10M_MS, CACHE_RETENTION_24H_MS, CLEANUP_INTERVAL_1H_MS } from '../constants/index.js';

interface ServerTask {
  serverId: string;
  intervalId: NodeJS.Timeout | null;
  reconnectIntervalId: NodeJS.Timeout | null;
  refreshing: boolean;
  reconnectAttempts: number;
  lastConnectAttempt: number;
}

class Scheduler {
  private tasks: Map<string, ServerTask> = new Map();
  private cleanupIntervalId: NodeJS.Timeout | null = null;
  private started = false;

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    const serverIds = db.getAllServerIds();
    
    for (const serverId of serverIds) {
      await this.addServer(serverId);
    }

    this.cleanupIntervalId = setInterval(() => {
      cache.cleanupOldHistory(CACHE_RETENTION_24H_MS);
    }, CLEANUP_INTERVAL_1H_MS);

    console.log(`[Scheduler] Started with ${serverIds.length} servers`);
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;

    for (const [serverId, task] of this.tasks) {
      if (task.intervalId) clearInterval(task.intervalId);
      if (task.reconnectIntervalId) clearInterval(task.reconnectIntervalId);
    }
    this.tasks.clear();

    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }

    console.log('[Scheduler] Stopped');
  }

  async addServer(serverId: string): Promise<void> {
    if (this.tasks.has(serverId)) return;

    const task: ServerTask = {
      serverId,
      intervalId: null,
      reconnectIntervalId: null,
      refreshing: false,
      reconnectAttempts: 0,
      lastConnectAttempt: 0
    };
    this.tasks.set(serverId, task);

    await this.connectAndStartRefresh(serverId);
  }

  removeServer(serverId: string): void {
    const task = this.tasks.get(serverId);
    if (!task) return;

    if (task.intervalId) clearInterval(task.intervalId);
    if (task.reconnectIntervalId) clearInterval(task.reconnectIntervalId);
    this.tasks.delete(serverId);

    console.log(`[Scheduler] Removed server ${serverId}`);
  }

  async refreshServer(serverId: string): Promise<void> {
    const task = this.tasks.get(serverId);
    if (!task || task.refreshing) return;

    await this.doRefresh(serverId);
  }

  async refreshAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    
    for (const serverId of this.tasks.keys()) {
      promises.push(this.refreshServer(serverId));
    }
    
    await Promise.allSettled(promises);
  }

  updateInterval(serverId: string, interval: number): void {
    const task = this.tasks.get(serverId);
    if (!task) return;

    const config = cache.getRefreshConfig(serverId);
    if (config) {
      cache.updateRefreshConfig(serverId, { ...config, refreshInterval: interval });
    }

    if (task.intervalId) {
      clearInterval(task.intervalId);
      task.intervalId = setInterval(() => this.doRefresh(serverId), interval);
    }
  }

  private getReconnectInterval(attempts: number): number {
    const exponentialBackoff = Math.min(
      INITIAL_RECONNECT_INTERVAL_1M_MS * Math.pow(2, attempts),
      MAX_RECONNECT_INTERVAL_10M_MS
    );
    return exponentialBackoff;
  }

  private async connectAndStartRefresh(serverId: string): Promise<void> {
    const task = this.tasks.get(serverId);
    if (!task) return;

    const server = db.getServerById(serverId);
    if (!server) {
      console.warn(`[Scheduler] Server ${serverId} not found in database`);
      return;
    }

    task.lastConnectAttempt = Date.now();

    try {
      await ssh.connect(server);
      cache.setConnectionStatus(serverId, true);
      console.log(`[Scheduler] Connected to ${server.name} (${serverId})`);

      if (task.reconnectIntervalId) {
        clearInterval(task.reconnectIntervalId);
        task.reconnectIntervalId = null;
      }
      task.reconnectAttempts = 0;

      await this.doRefresh(serverId);

      const config = cache.getRefreshConfig(serverId);
      const interval = config?.refreshInterval ?? DEFAULT_REFRESH_INTERVAL_MS;
      
      task.intervalId = setInterval(() => this.doRefresh(serverId), interval);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Connection failed';
      cache.setConnectionStatus(serverId, false, errorMsg);
      
      task.reconnectAttempts++;
      
      if (task.reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
        const reconnectInterval = this.getReconnectInterval(task.reconnectAttempts);
        console.error(`[Scheduler] Failed to connect to ${server.name}: ${errorMsg} (attempt ${task.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}, next retry in ${reconnectInterval/1000}s)`);

        if (task.reconnectIntervalId) {
          clearInterval(task.reconnectIntervalId);
        }

        task.reconnectIntervalId = setTimeout(async () => {
          task.reconnectIntervalId = null;
          await this.connectAndStartRefresh(serverId);
        }, reconnectInterval);
      } else {
        console.error(`[Scheduler] Max reconnection attempts reached for ${server.name}. Giving up.`);
      }
    }
  }

  private async doRefresh(serverId: string): Promise<void> {
    const task = this.tasks.get(serverId);
    if (!task || task.refreshing) return;

    const config = cache.getRefreshConfig(serverId);
    if (config && !config.autoRefresh) return;

    task.refreshing = true;

    try {
      if (!ssh.isConnected(serverId)) {
        throw new Error(ERR_SSH_NOT_CONNECTED);
      }

      const [npuSummary, sysSummary] = await Promise.all([
        npu.getFullSummary((cmd) => ssh.executeCommand(serverId, cmd)),
        sys.getSystemSummary((cmd) => ssh.executeCommand(serverId, cmd))
      ]);

      cache.setNPUCache(serverId, npuSummary, true);
      cache.setSystemCache(serverId, sysSummary, true);
      cache.setConnectionStatus(serverId, true);

      cache.addNPUHistory(serverId, npuSummary);
      cache.addSystemHistory(serverId, sysSummary);

      console.log(`[Scheduler] Refreshed data for ${serverId}`);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Refresh failed';
      console.error(`[Scheduler] Failed to refresh ${serverId}: ${errorMsg}`);

      const emptyNpuSummary = {
        devices: [],
        chips: [],
        boardInfo: [],
        temperatures: [],
        power: [],
        memory: [],
        usage: [],
        processes: [],
        ecc: [],
        lastUpdated: Date.now()
      };
      const emptySysSummary = {
        memory: { total: 0, used: 0, free: 0, available: 0, buffers: 0, cached: 0, usagePercent: 0 },
        storage: [],
        ports: [],
        containers: [],
        lastUpdated: Date.now()
      };

      cache.setNPUCache(serverId, emptyNpuSummary, false, errorMsg);
      cache.setSystemCache(serverId, emptySysSummary, false, errorMsg);
      cache.setConnectionStatus(serverId, false, errorMsg);

    } finally {
      task.refreshing = false;
    }
  }

  getTaskStatus(serverId: string): { refreshing: boolean; hasInterval: boolean } | null {
    const task = this.tasks.get(serverId);
    if (!task) return null;
    
    return {
      refreshing: task.refreshing,
      hasInterval: task.intervalId !== null
    };
  }
}

export const scheduler = new Scheduler();
