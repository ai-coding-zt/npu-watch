import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { API_BASE_FULL, DEFAULT_FILE_PATH } from '@/constants';

export interface TerminalSession {
  id: string;
  serverId: string;
  name: string;
  connected: boolean;
}

export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  size: number;
  modifiedTime: number;
  permissions: string;
  owner: string;
  group: string;
}

export interface FileListResult {
  path: string;
  files: FileInfo[];
  parentPath?: string;
}

export interface FileViewResult {
  stat: FileInfo;
  content: string;
  isBinary: boolean;
  size: number;
}

function formatErrorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

export const useTerminalStore = defineStore('terminal', () => {
  const sessions = ref<TerminalSession[]>([]);
  const activeSessionId = ref<string | null>(null);
  const fileManagerPath = ref<string>(DEFAULT_FILE_PATH);
  const fileList = ref<FileListResult | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const activeSession = computed(() => 
    sessions.value.find(s => s.id === activeSessionId.value)
  );

  const sessionsForServer = computed(() => (serverId: string) =>
    sessions.value.filter(s => s.serverId === serverId)
  );

  function createSession(serverId: string, name?: string): string {
    const id = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const session: TerminalSession = {
      id,
      serverId,
      name: name || `Terminal ${sessions.value.length + 1}`,
      connected: false
    };
    sessions.value.push(session);
    activeSessionId.value = id;
    return id;
  }

  function removeSession(sessionId: string): void {
    const index = sessions.value.findIndex(s => s.id === sessionId);
    if (index !== -1) {
      sessions.value.splice(index, 1);
      if (activeSessionId.value === sessionId) {
        activeSessionId.value = sessions.value.length > 0 ? sessions.value[0].id : null;
      }
    }
  }

  function setActiveSession(sessionId: string): void {
    activeSessionId.value = sessionId;
  }

  function setSessionConnected(sessionId: string, connected: boolean): void {
    const session = sessions.value.find(s => s.id === sessionId);
    if (session) {
      session.connected = connected;
    }
  }

  function updateSessionName(sessionId: string, name: string): void {
    const session = sessions.value.find(s => s.id === sessionId);
    if (session) {
      session.name = name;
    }
  }

  async function fetchFiles(serverId: string, path: string): Promise<void> {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await fetch(`${API_BASE_FULL}/servers/${serverId}/files?path=${encodeURIComponent(path)}`);
      const data = await response.json();
      
      if (data.success) {
        fileList.value = data.data;
        fileManagerPath.value = path;
      } else {
        error.value = data.error || 'Failed to fetch files';
      }
    } catch (e) {
      error.value = formatErrorMessage(e, 'Failed to fetch files');
    } finally {
      loading.value = false;
    }
  }

  async function createDirectory(serverId: string, path: string, name: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_FULL}/servers/${serverId}/files/mkdir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, name })
      });
      const data = await response.json();
      
      if (data.success) {
        await fetchFiles(serverId, fileManagerPath.value);
        return true;
      } else {
        error.value = data.error || 'Failed to create directory';
        return false;
      }
    } catch (e) {
      error.value = formatErrorMessage(e, 'Failed to create directory');
      return false;
    }
  }

  async function deleteFile(serverId: string, path: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_FULL}/servers/${serverId}/files`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });
      const data = await response.json();
      
      if (data.success) {
        await fetchFiles(serverId, fileManagerPath.value);
        return true;
      } else {
        error.value = data.error || 'Failed to delete';
        return false;
      }
    } catch (e) {
      error.value = formatErrorMessage(e, 'Failed to delete');
      return false;
    }
  }

  async function renameFile(serverId: string, oldPath: string, newPath: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_FULL}/servers/${serverId}/files/rename`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPath, newPath })
      });
      const data = await response.json();
      
      if (data.success) {
        await fetchFiles(serverId, fileManagerPath.value);
        return true;
      } else {
        error.value = data.error || 'Failed to rename';
        return false;
      }
    } catch (e) {
      error.value = formatErrorMessage(e, 'Failed to rename');
      return false;
    }
  }

  function getDownloadUrl(serverId: string, path: string): string {
    return `${API_BASE_FULL}/servers/${serverId}/files/download?path=${encodeURIComponent(path)}`;
  }

  function getUploadUrl(serverId: string, path: string, name: string): string {
    return `${API_BASE_FULL}/servers/${serverId}/files/upload?path=${encodeURIComponent(path)}&name=${encodeURIComponent(name)}`;
  }

  async function viewFile(serverId: string, path: string): Promise<FileViewResult | null> {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await fetch(`${API_BASE_FULL}/servers/${serverId}/files/view?path=${encodeURIComponent(path)}`);
      const data = await response.json();
      
      if (data.success) {
        return data.data;
      } else {
        error.value = data.error || 'Failed to view file';
        return null;
      }
    } catch (e) {
      error.value = formatErrorMessage(e, 'Failed to view file');
      return null;
    } finally {
      loading.value = false;
    }
  }

  return {
    sessions,
    activeSessionId,
    activeSession,
    fileManagerPath,
    fileList,
    loading,
    error,
    sessionsForServer,
    createSession,
    removeSession,
    setActiveSession,
    setSessionConnected,
    updateSessionName,
    fetchFiles,
    createDirectory,
    deleteFile,
    renameFile,
    getDownloadUrl,
    getUploadUrl,
    viewFile
  };
});
