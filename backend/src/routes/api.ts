import { Router, Request, Response } from 'express';
import * as db from '../services/db.js';
import * as ssh from '../services/ssh.js';
import * as npu from '../services/npu-parser.js';
import * as cache from '../services/cache.js';
import { scheduler } from '../services/scheduler.js';
import * as sys from '../services/system-parser.js';
import { router as filesRouter } from './files.js';
import { createServerSchema, updateServerSchema } from '../utils/validation.js';
import { sendSuccess, sendSuccessMessage, sendCreated, sendError, sendNotFound, sendBadRequest, sendInternalError, sendNoCache } from '../utils/response.js';
import { ERR_SERVER_NOT_FOUND, ERR_NOT_CONNECTED, ERR_CACHE_UNAVAILABLE, ERR_INVALID_REFRESH_INTERVAL, ERR_INVALID_CONFIG_PARAMS, ERR_NPU_ID_REQUIRED, ERR_SSH_CONNECTED, DEFAULT_REFRESH_INTERVAL_MS, MIN_REFRESH_INTERVAL_MS, MAX_REFRESH_INTERVAL_MS, CACHE_RETENTION_24H_MS } from '../constants/index.js';
import type { ApiResponse, NPUSummary, SystemSummary, NPUCacheData, SystemCacheData, RefreshConfig, CacheStatusOverview, NPUHistoryQueryResult, SystemHistoryQueryResult } from '../types.js';

export const router = Router();

function getServerOr404(res: Response, serverId: string) {
  const server = db.getServerById(serverId);
  if (!server) sendNotFound(res, ERR_SERVER_NOT_FOUND);
  return server;
}

function requireConnection(res: Response, serverId: string) {
  if (!ssh.isConnected(serverId)) {
    sendNoCache(res, ERR_NOT_CONNECTED);
    return false;
  }
  return true;
}

function sanitizeServer(server: ReturnType<typeof db.getServerById>) {
  if (!server) return null;
  const { password, privateKey, passphrase, ...safe } = server;
  return safe;
}

router.get('/servers', (_req: Request, res: Response) => {
  sendSuccess(res, db.getAllServers());
});

router.post('/servers', (req: Request, res: Response) => {
  try {
    const data = createServerSchema.parse(req.body);
    const server = db.createServer(data as Parameters<typeof db.createServer>[0]);
    sendCreated(res, sanitizeServer(server));
  } catch (error) {
    sendBadRequest(res, error);
  }
});

router.get('/servers/:id', (req: Request, res: Response) => {
  const server = getServerOr404(res, req.params.id);
  if (!server) return;
  sendSuccess(res, sanitizeServer(server));
});

router.put('/servers/:id', (req: Request, res: Response) => {
  try {
    const data = updateServerSchema.parse(req.body);
    const server = db.updateServer(req.params.id, data as Parameters<typeof db.updateServer>[1]);
    if (!server) {
      sendNotFound(res, ERR_SERVER_NOT_FOUND);
      return;
    }
    sendSuccess(res, sanitizeServer(server));
  } catch (error) {
    sendBadRequest(res, error);
  }
});

router.delete('/servers/:id', async (req: Request, res: Response) => {
  await ssh.disconnect(req.params.id);
  const deleted = db.deleteServer(req.params.id);
  if (!deleted) {
    sendNotFound(res, ERR_SERVER_NOT_FOUND);
    return;
  }
  sendSuccess(res, null);
});

router.post('/servers/:id/connect', async (req: Request, res: Response) => {
  const server = getServerOr404(res, req.params.id);
  if (!server) return;

  try {
    const rawPassword = req.body?.password;
    await ssh.connect(server, rawPassword);
    sendSuccessMessage(res, ERR_SSH_CONNECTED);
  } catch (error) {
    sendInternalError(res, error, 'Connection failed');
  }
});

router.post('/servers/:id/disconnect', async (req: Request, res: Response) => {
  await ssh.disconnect(req.params.id);
  sendSuccessMessage(res, 'Disconnected');
});

router.get('/servers/:id/status', async (req: Request, res: Response) => {
  const server = getServerOr404(res, req.params.id);
  if (!server) return;
  const connected = await ssh.isConnectionAlive(req.params.id);
  sendSuccess(res, { connected, serverId: req.params.id });
});

router.get('/servers/:id/monitor', async (req: Request, res: Response) => {
  const server = getServerOr404(res, req.params.id);
  if (!server) return;

  const cachedData = cache.getNPUCache(req.params.id);
  if (cachedData) {
    sendSuccess(res, cachedData);
    return;
  }

  if (!requireConnection(res, req.params.id)) return;

  try {
    const summary = await npu.getFullSummary((cmd) => ssh.executeCommand(req.params.id, cmd));
    cache.setNPUCache(req.params.id, summary, true);
    cache.setConnectionStatus(req.params.id, true);
    const cacheData = cache.getNPUCache(req.params.id);
    sendSuccess(res, cacheData!);
  } catch (error) {
    sendInternalError(res, error, 'Failed to get monitoring data');
  }
});

router.get('/servers/:id/devices', async (req: Request, res: Response) => {
  const server = getServerOr404(res, req.params.id);
  if (!server) return;
  if (!requireConnection(res, req.params.id)) return;

  try {
    const result = await ssh.executeCommand(req.params.id, 'npu-smi info -l');
    const devices = await npu.parseDeviceList(result);
    sendSuccess(res, devices);
  } catch (error) {
    sendInternalError(res, error, 'Failed to get devices');
  }
});

router.get('/servers/:id/chips', async (req: Request, res: Response) => {
  const server = getServerOr404(res, req.params.id);
  if (!server) return;
  if (!requireConnection(res, req.params.id)) return;

  try {
    const result = await ssh.executeCommand(req.params.id, 'npu-smi info -m');
    const chips = await npu.parseChipList(result);
    sendSuccess(res, chips);
  } catch (error) {
    sendInternalError(res, error, 'Failed to get chips');
  }
});

router.get('/servers/:id/health', async (req: Request, res: Response) => {
  const server = getServerOr404(res, req.params.id);
  if (!server) return;
  if (!requireConnection(res, req.params.id)) return;

  try {
    const deviceId = req.query.deviceId || '0';
    const result = await ssh.executeCommand(req.params.id, `npu-smi info -t health -i ${deviceId}`);
    sendSuccess(res, { raw: result.stdout });
  } catch (error) {
    sendInternalError(res, error, 'Failed to get health');
  }
});

router.get('/servers/:id/system', async (req: Request, res: Response) => {
  const server = getServerOr404(res, req.params.id);
  if (!server) return;

  const cachedData = cache.getSystemCache(req.params.id);
  if (cachedData) {
    sendSuccess(res, cachedData);
    return;
  }

  if (!requireConnection(res, req.params.id)) return;

  try {
    const summary = await sys.getSystemSummary((cmd) => ssh.executeCommand(req.params.id, cmd));
    cache.setSystemCache(req.params.id, summary, true);
    const cacheData = cache.getSystemCache(req.params.id);
    sendSuccess(res, cacheData!);
  } catch (error) {
    sendInternalError(res, error, 'Failed to get system data');
  }
});

router.post('/servers/:id/refresh', async (req: Request, res: Response) => {
  const server = getServerOr404(res, req.params.id);
  if (!server) return;

  try {
    await scheduler.refreshServer(req.params.id);
    sendSuccessMessage(res, 'Refresh triggered');
  } catch (error) {
    sendInternalError(res, error, 'Refresh failed');
  }
});

router.get('/servers/:id/refresh-status', (req: Request, res: Response) => {
  const server = getServerOr404(res, req.params.id);
  if (!server) return;

  const taskStatus = scheduler.getTaskStatus(req.params.id);
  const config = cache.getRefreshConfig(req.params.id);
  
  sendSuccess(res, {
    isRefreshing: taskStatus?.refreshing ?? false,
    autoRefresh: config?.autoRefresh ?? true,
    refreshInterval: config?.refreshInterval ?? DEFAULT_REFRESH_INTERVAL_MS
  });
});

router.put('/servers/:id/refresh-config', (req: Request, res: Response) => {
  const server = getServerOr404(res, req.params.id);
  if (!server) return;

  const { autoRefresh, refreshInterval } = req.body;
  
  if (typeof autoRefresh !== 'boolean' || typeof refreshInterval !== 'number') {
    sendBadRequest(res, new Error(ERR_INVALID_CONFIG_PARAMS));
    return;
  }

  if (refreshInterval < MIN_REFRESH_INTERVAL_MS || refreshInterval > MAX_REFRESH_INTERVAL_MS) {
    sendBadRequest(res, new Error(ERR_INVALID_REFRESH_INTERVAL));
    return;
  }

  const config: RefreshConfig = { autoRefresh, refreshInterval };
  cache.updateRefreshConfig(req.params.id, config);
  scheduler.updateInterval(req.params.id, refreshInterval);
  
  sendSuccess(res, config);
});

router.get('/servers/:id/npu-history', (req: Request, res: Response) => {
  const server = getServerOr404(res, req.params.id);
  if (!server) return;

  const npuId = parseInt(req.query.npuId as string, 10);
  const chipId = parseInt(req.query.chipId as string, 10);
  const startTime = parseInt(req.query.startTime as string, 10) || Date.now() - CACHE_RETENTION_24H_MS;
  const endTime = parseInt(req.query.endTime as string, 10) || Date.now();

  if (isNaN(npuId) || isNaN(chipId)) {
    sendBadRequest(res, new Error(ERR_NPU_ID_REQUIRED));
    return;
  }

  const result = cache.getNPUHistory(req.params.id, npuId, chipId, startTime, endTime);
  sendSuccess(res, result);
});

router.get('/servers/:id/system-history', (req: Request, res: Response) => {
  const server = getServerOr404(res, req.params.id);
  if (!server) return;

  const startTime = parseInt(req.query.startTime as string, 10) || Date.now() - CACHE_RETENTION_24H_MS;
  const endTime = parseInt(req.query.endTime as string, 10) || Date.now();

  const result = cache.getSystemHistory(req.params.id, startTime, endTime);
  sendSuccess(res, result);
});

router.get('/cache/status', (_req: Request, res: Response) => {
  sendSuccess(res, cache.getCacheStatusOverview());
});

router.use(filesRouter);
