import * as ssh from './ssh.js';
import type { FileInfo, FileListResult } from '../types.js';
import path from 'path';
import { ERR_NOT_CONNECTED, ERR_DIR_NOT_ACCESSIBLE, ERR_MKDIR_FAILED, ERR_DELETE_FAILED, ERR_RENAME_FAILED, ERR_READ_FAILED, ERR_UPLOAD_FAILED } from '../constants/index.js';

function requireConnection(serverId: string): void {
  if (!ssh.isConnected(serverId)) {
    throw new Error(ERR_NOT_CONNECTED);
  }
}

export async function listDirectory(serverId: string, dirPath: string): Promise<FileListResult> {
  requireConnection(serverId);

  const normalizedPath = path.posix.normalize(dirPath);
  
  const result = await ssh.executeCommand(serverId, `ls -la "${normalizedPath}" 2>/dev/null || echo "ERROR"`);
  
  if (result.stdout.includes('ERROR') || result.code !== 0) {
    throw new Error(`${ERR_DIR_NOT_ACCESSIBLE}: ${result.stderr || 'Directory not accessible'}`);
  }

  const lines = result.stdout.trim().split('\n');
  const files: FileInfo[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const parts = line.split(/\s+/);
    if (parts.length < 9) continue;
    
    const permissions = parts[0];
    const isDirectory = permissions.startsWith('d');
    const isFile = permissions.startsWith('-');
    
    const name = parts.slice(8).join(' ');
    if (name === '.' || name === '..') continue;
    
    const size = parseInt(parts[4], 10) || 0;
    const owner = parts[2];
    const group = parts[3];
    
    const month = parts[5];
    const day = parseInt(parts[6], 10);
    const timeOrYear = parts[7];
    
    let modifiedTime = 0;
    try {
      const dateStr = `${month} ${day} ${timeOrYear}`;
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        modifiedTime = parsed.getTime();
      }
    } catch {
      modifiedTime = Date.now();
    }
    
    files.push({
      name,
      path: path.posix.join(normalizedPath, name),
      isDirectory,
      isFile,
      size,
      modifiedTime,
      permissions,
      owner,
      group
    });
  }

  files.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });

  const parentPath = normalizedPath !== '/' ? path.posix.dirname(normalizedPath) : undefined;

  return {
    path: normalizedPath,
    files,
    parentPath: parentPath !== normalizedPath ? parentPath : undefined
  };
}

export async function getFileStat(serverId: string, filePath: string): Promise<FileInfo | null> {
  requireConnection(serverId);

  const normalizedPath = path.posix.normalize(filePath);
  const fileName = path.posix.basename(normalizedPath);
  
  const result = await ssh.executeCommand(serverId, `ls -la "${normalizedPath}" 2>/dev/null`);
  
  if (result.code !== 0 || !result.stdout.trim()) {
    return null;
  }

  const line = result.stdout.trim().split('\n')[1];
  if (!line) return null;
  
  const parts = line.split(/\s+/);
  if (parts.length < 9) return null;

  const permissions = parts[0];
  const size = parseInt(parts[4], 10) || 0;
  const owner = parts[2];
  const group = parts[3];

  return {
    name: fileName,
    path: normalizedPath,
    isDirectory: permissions.startsWith('d'),
    isFile: permissions.startsWith('-'),
    size,
    modifiedTime: Date.now(),
    permissions,
    owner,
    group
  };
}

export async function createDirectory(serverId: string, dirPath: string, name: string): Promise<void> {
  requireConnection(serverId);

  const newPath = path.posix.join(dirPath, name);
  const result = await ssh.executeCommand(serverId, `mkdir -p "${newPath}"`);
  
  if (result.code !== 0) {
    throw new Error(`${ERR_MKDIR_FAILED}: ${result.stderr}`);
  }
}

export async function deleteFile(serverId: string, filePath: string): Promise<void> {
  requireConnection(serverId);

  const normalizedPath = path.posix.normalize(filePath);
  const result = await ssh.executeCommand(serverId, `rm -rf "${normalizedPath}"`);
  
  if (result.code !== 0) {
    throw new Error(`${ERR_DELETE_FAILED}: ${result.stderr}`);
  }
}

export async function renameFile(serverId: string, oldPath: string, newPath: string): Promise<void> {
  requireConnection(serverId);

  const normalizedOld = path.posix.normalize(oldPath);
  const normalizedNew = path.posix.normalize(newPath);
  
  const result = await ssh.executeCommand(serverId, `mv "${normalizedOld}" "${normalizedNew}"`);
  
  if (result.code !== 0) {
    throw new Error(`${ERR_RENAME_FAILED}: ${result.stderr}`);
  }
}

export async function readFileContent(serverId: string, filePath: string): Promise<Buffer> {
  requireConnection(serverId);

  const result = await ssh.executeCommand(serverId, `base64 "${filePath}"`);
  
  if (result.code !== 0) {
    throw new Error(`${ERR_READ_FAILED}: ${result.stderr}`);
  }

  return Buffer.from(result.stdout.trim(), 'base64');
}

export async function uploadFile(
  serverId: string, 
  remotePath: string, 
  content: Buffer,
  fileName: string
): Promise<void> {
  requireConnection(serverId);

  const fullPath = path.posix.join(remotePath, fileName);
  const UPLOAD_CHUNK_SIZE = 50000;
  
  const base64Content = content.toString('base64');
  
  await ssh.executeCommand(serverId, `rm -f /tmp/npu-upload-${fileName}.b64`);
  
  for (let i = 0; i < base64Content.length; i += UPLOAD_CHUNK_SIZE) {
    const chunk = base64Content.slice(i, i + UPLOAD_CHUNK_SIZE);
    await ssh.executeCommand(serverId, `echo "${chunk}" >> /tmp/npu-upload-${fileName}.b64`);
  }
  
  const result = await ssh.executeCommand(
    serverId, 
    `base64 -d /tmp/npu-upload-${fileName}.b64 > "${fullPath}" && rm -f /tmp/npu-upload-${fileName}.b64`
  );
  
  if (result.code !== 0) {
    throw new Error(`${ERR_UPLOAD_FAILED}: ${result.stderr}`);
  }
}

export async function autocompletePath(serverId: string, partialPath: string): Promise<string[]> {
  if (!ssh.isConnected(serverId)) {
    return [];
  }

  const normalizedPath = path.posix.normalize(partialPath || '/');
  const lastSlash = normalizedPath.lastIndexOf('/');
  const dirPath = lastSlash === 0 ? '/' : normalizedPath.substring(0, lastSlash) || '/';
  const prefix = normalizedPath.substring(lastSlash + 1).toLowerCase();
  const AUTOCOMPLETE_MAX_RESULTS = 20;
  
  try {
    const result = await listDirectory(serverId, dirPath);
    return result.files
      .filter(f => f.name.toLowerCase().startsWith(prefix))
      .map(f => {
        const sep = dirPath.endsWith('/') ? '' : '/';
        return dirPath + sep + f.name + (f.isDirectory ? '/' : '');
      })
      .slice(0, AUTOCOMPLETE_MAX_RESULTS);
  } catch {
    return [];
  }
}
