import { Router, Request, Response } from 'express';
import * as sftp from '../services/sftp.js';
import * as ssh from '../services/ssh.js';
import * as db from '../services/db.js';
import { sendSuccess, sendSuccessMessage, sendError, sendNotFound, sendBadRequest, sendInternalError, sendNoCache } from '../utils/response.js';
import { ERR_SERVER_NOT_FOUND, ERR_NOT_CONNECTED, ERR_FILE_NOT_FOUND } from '../constants/index.js';
import type { ApiResponse, FileListResult, FileInfo } from '../types.js';

export const router = Router();

async function withServerAndConnection<T>(
  res: Response,
  serverId: string,
  fn: () => Promise<T>
): Promise<T | null> {
  const server = db.getServerById(serverId);
  if (!server) {
    sendNotFound(res, ERR_SERVER_NOT_FOUND);
    return null;
  }

  if (!ssh.isConnected(serverId)) {
    sendNoCache(res, ERR_NOT_CONNECTED);
    return null;
  }

  try {
    return await fn();
  } catch (error) {
    sendInternalError(res, error);
    return null;
  }
}

router.get('/servers/:id/files', async (req: Request, res: Response) => {
  const result = await withServerAndConnection(res, req.params.id, async () => {
    const path = (req.query.path as string) || '/';
    return sftp.listDirectory(req.params.id, path);
  });
  
  if (result) sendSuccess(res, result);
});

router.get('/servers/:id/files/stat', async (req: Request, res: Response) => {
  const path = req.query.path as string;
  if (!path) {
    sendBadRequest(res, new Error('Path is required'));
    return;
  }

  const result = await withServerAndConnection(res, req.params.id, async () => {
    return sftp.getFileStat(req.params.id, path);
  });

  if (result === undefined) return;
  if (!result) {
    sendNotFound(res, ERR_FILE_NOT_FOUND);
    return;
  }
  sendSuccess(res, result);
});

router.get('/servers/:id/files/download', async (req: Request, res: Response) => {
  const filePath = req.query.path as string;
  if (!filePath) {
    sendBadRequest(res, new Error('Path is required'));
    return;
  }

  const result = await withServerAndConnection(res, req.params.id, async () => {
    const stat = await sftp.getFileStat(req.params.id, filePath);
    if (!stat) return null;
    if (stat.isDirectory) return { isDirectory: true };
    
    const content = await sftp.readFileContent(req.params.id, filePath);
    return { stat, content };
  });

  if (!result) return;
  if ('isDirectory' in result) {
    sendBadRequest(res, new Error('Cannot download a directory'));
    return;
  }

  const fileName = filePath.split('/').pop() || 'download';
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', result.content.length);
  res.send(result.content);
});

router.post('/servers/:id/files/upload', async (req: Request, res: Response) => {
  const remotePath = req.query.path as string;
  const fileName = req.query.name as string;
  
  if (!remotePath || !fileName) {
    sendBadRequest(res, new Error('Path and name are required'));
    return;
  }

  const result = await withServerAndConnection(res, req.params.id, async () => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const content = Buffer.concat(chunks);
    await sftp.uploadFile(req.params.id, remotePath, content, fileName);
    return true;
  });

  if (result) sendSuccessMessage(res, 'File uploaded successfully');
});

router.post('/servers/:id/files/mkdir', async (req: Request, res: Response) => {
  const { path, name } = req.body;
  if (!path || !name) {
    sendBadRequest(res, new Error('Path and name are required'));
    return;
  }

  const result = await withServerAndConnection(res, req.params.id, async () => {
    await sftp.createDirectory(req.params.id, path, name);
    return true;
  });

  if (result) sendSuccessMessage(res, 'Directory created successfully');
});

router.delete('/servers/:id/files', async (req: Request, res: Response) => {
  const { path } = req.body;
  if (!path) {
    sendBadRequest(res, new Error('Path is required'));
    return;
  }

  const result = await withServerAndConnection(res, req.params.id, async () => {
    await sftp.deleteFile(req.params.id, path);
    return true;
  });

  if (result) sendSuccessMessage(res, 'Deleted successfully');
});

router.put('/servers/:id/files/rename', async (req: Request, res: Response) => {
  const { oldPath, newPath } = req.body;
  if (!oldPath || !newPath) {
    sendBadRequest(res, new Error('oldPath and newPath are required'));
    return;
  }

  const result = await withServerAndConnection(res, req.params.id, async () => {
    await sftp.renameFile(req.params.id, oldPath, newPath);
    return true;
  });

  if (result) sendSuccessMessage(res, 'Renamed successfully');
});

router.get('/servers/:id/files/autocomplete', async (req: Request, res: Response) => {
  const result = await withServerAndConnection(res, req.params.id, async () => {
    const partialPath = (req.query.path as string) || '/';
    return sftp.autocompletePath(req.params.id, partialPath);
  });

  if (result) sendSuccess(res, result);
});

router.get('/servers/:id/files/view', async (req: Request, res: Response) => {
  const filePath = req.query.path as string;
  if (!filePath) {
    sendBadRequest(res, new Error('Path is required'));
    return;
  }

  const MAX_VIEW_SIZE_BYTES = 1024 * 1024;

  const result = await withServerAndConnection(res, req.params.id, async () => {
    const stat = await sftp.getFileStat(req.params.id, filePath);
    if (!stat) return null;
    if (stat.isDirectory) return { isDirectory: true };
    if (stat.size > MAX_VIEW_SIZE_BYTES) return { tooLarge: true, size: stat.size };
    
    const content = await sftp.readFileContent(req.params.id, filePath);
    const isBinaryFile = content.includes(0x00);
    
    const textContent = isBinaryFile 
      ? '[Binary file - cannot display]'
      : content.toString('utf-8');
    
    return { stat, content: textContent, isBinary: isBinaryFile, size: stat.size };
  });

  if (!result) return;
  if ('isDirectory' in result) {
    sendBadRequest(res, new Error('Cannot view a directory'));
    return;
  }
  if ('tooLarge' in result) {
    sendBadRequest(res, new Error(`File too large to view (${Math.round(result.size / 1024)}KB). Use download instead.`));
    return;
  }

  sendSuccess(res, result);
});
