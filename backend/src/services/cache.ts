import * as db from './db.js';
import type { 
  NPUSummary, 
  SystemSummary, 
  NPUCacheData, 
  SystemCacheData,
  NPUHistoryRecord,
  SystemHistoryRecord,
  NPUHistoryQueryResult,
  SystemHistoryQueryResult,
  CacheStatusOverview,
  RefreshConfig
} from '../types.js';

export function getNPUCache(serverId: string): NPUCacheData | null {
  const cache = db.getNPUCache(serverId);
  if (!cache) return null;
  
  const connection = db.getConnectionStatus(serverId);
  let parsedData: NPUSummary;
  
  try {
    parsedData = JSON.parse(cache.data);
  } catch {
    return null;
  }
  
  return {
    ...parsedData,
    connected: connection?.connected ?? false,
    lastSuccess: cache.lastSuccess,
    lastUpdated: cache.lastUpdated,
    error: cache.error
  };
}

export function setNPUCache(
  serverId: string, 
  data: NPUSummary, 
  success: boolean, 
  error?: string
): void {
  db.setNPUCache(serverId, JSON.stringify(data), success, error);
}

export function getSystemCache(serverId: string): SystemCacheData | null {
  const cache = db.getSystemCache(serverId);
  if (!cache) return null;
  
  const connection = db.getConnectionStatus(serverId);
  let parsedData: SystemSummary;
  
  try {
    parsedData = JSON.parse(cache.data);
  } catch {
    return null;
  }
  
  return {
    ...parsedData,
    connected: connection?.connected ?? false,
    lastSuccess: cache.lastSuccess,
    lastUpdated: cache.lastUpdated,
    error: cache.error
  };
}

export function setSystemCache(
  serverId: string, 
  data: SystemSummary, 
  success: boolean, 
  error?: string
): void {
  db.setSystemCache(serverId, JSON.stringify(data), success, error);
}

export function setConnectionStatus(
  serverId: string, 
  connected: boolean, 
  error?: string
): void {
  db.initServerConnection(serverId);
  db.setConnectionStatus(serverId, connected, error);
}

export function getConnectionStatus(serverId: string) {
  return db.getConnectionStatus(serverId);
}

export function updateRefreshConfig(serverId: string, config: RefreshConfig): void {
  db.updateRefreshConfig(serverId, config);
}

export function getRefreshConfig(serverId: string): RefreshConfig | null {
  return db.getRefreshConfig(serverId);
}

export function addNPUHistory(
  serverId: string, 
  summary: NPUSummary
): void {
  const timestamp = Date.now();
  const records: Omit<NPUHistoryRecord, 'id'>[] = [];
  
  for (const temp of summary.temperatures) {
    const power = summary.power.find(p => p.npuId === temp.npuId && p.chipId === temp.chipId);
    const mem = summary.memory.find(m => m.npuId === temp.npuId && m.chipId === temp.chipId);
    const usage = summary.usage.find(u => u.npuId === temp.npuId && u.chipId === temp.chipId);
    const ecc = summary.ecc.find(e => e.npuId === temp.npuId && e.chipId === temp.chipId);
    
    records.push({
      serverId,
      npuId: temp.npuId,
      chipId: temp.chipId,
      temperature: temp.npuTemp,
      powerUsage: power?.powerUsage ?? 0,
      memoryUsageRate: mem?.memoryUsageRate ?? 0,
      aiCoreUsage: usage?.aiCoreUsage ?? 0,
      eccErrorCount: ecc?.eccErrorCount ?? 0,
      timestamp
    });
  }
  
  if (records.length > 0) {
    db.addNPUHistory(records);
  }
}

export function addSystemHistory(
  serverId: string, 
  summary: SystemSummary
): void {
  const maxStorageUsage = summary.storage.reduce((max, s) => Math.max(max, s.usagePercent), 0);
  const runningContainers = summary.containers.filter(c => c.state === 'running').length;
  
  db.addSystemHistory({
    serverId,
    memoryUsagePercent: summary.memory.usagePercent,
    storageUsagePercent: maxStorageUsage,
    containerCount: summary.containers.length,
    runningContainers,
    timestamp: Date.now()
  });
}

export function getNPUHistory(
  serverId: string,
  npuId: number,
  chipId: number,
  startTime: number,
  endTime: number
): NPUHistoryQueryResult {
  const records = db.getNPUHistory(serverId, npuId, chipId, startTime, endTime);
  
  if (records.length === 0) {
    return {
      records: [],
      summary: {
        avgTemperature: 0,
        maxTemperature: 0,
        avgPowerUsage: 0,
        avgMemoryUsage: 0,
        avgAiCoreUsage: 0
      }
    };
  }
  
  const sumTemp = records.reduce((sum, r) => sum + r.temperature, 0);
  const sumPower = records.reduce((sum, r) => sum + r.powerUsage, 0);
  const sumMem = records.reduce((sum, r) => sum + r.memoryUsageRate, 0);
  const sumUsage = records.reduce((sum, r) => sum + r.aiCoreUsage, 0);
  const maxTemp = Math.max(...records.map(r => r.temperature));
  
  return {
    records,
    summary: {
      avgTemperature: Math.round(sumTemp / records.length),
      maxTemperature: maxTemp,
      avgPowerUsage: Math.round(sumPower / records.length),
      avgMemoryUsage: Math.round(sumMem / records.length),
      avgAiCoreUsage: Math.round(sumUsage / records.length)
    }
  };
}

export function getSystemHistory(
  serverId: string,
  startTime: number,
  endTime: number
): SystemHistoryQueryResult {
  const records = db.getSystemHistory(serverId, startTime, endTime);
  
  if (records.length === 0) {
    return {
      records: [],
      summary: {
        avgMemoryUsage: 0,
        maxMemoryUsage: 0,
        avgStorageUsage: 0,
        avgContainerCount: 0
      }
    };
  }
  
  const sumMem = records.reduce((sum, r) => sum + r.memoryUsagePercent, 0);
  const sumStorage = records.reduce((sum, r) => sum + r.storageUsagePercent, 0);
  const sumContainers = records.reduce((sum, r) => sum + r.containerCount, 0);
  const maxMem = Math.max(...records.map(r => r.memoryUsagePercent));
  
  return {
    records,
    summary: {
      avgMemoryUsage: Math.round(sumMem / records.length),
      maxMemoryUsage: maxMem,
      avgStorageUsage: Math.round(sumStorage / records.length),
      avgContainerCount: Math.round(sumContainers / records.length)
    }
  };
}

export function getCacheStatusOverview(): CacheStatusOverview[] {
  return db.getCacheStatusOverview();
}

export function cleanupOldHistory(retentionMs: number = 24 * 60 * 60 * 1000): void {
  const beforeTimestamp = Date.now() - retentionMs;
  db.cleanupOldHistory(beforeTimestamp);
}
