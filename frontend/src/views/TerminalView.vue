<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useServersStore } from '@/stores/servers';
import { useTerminalStore } from '@/stores/terminal';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

const route = useRoute();
const router = useRouter();
const serversStore = useServersStore();
const terminalStore = useTerminalStore();

const serverId = computed(() => route.params.serverId as string);
const server = computed(() => serversStore.servers.find(s => s.id === serverId.value));
const isConnected = computed(() => serversStore.isConnected(serverId.value));

const activeTab = ref<'terminal' | 'files'>('terminal');
const terminalSessions = ref<Array<{ id: string; name: string; terminal: Terminal | null; ws: WebSocket | null; container: HTMLDivElement | null }>>([]);
const activeTerminalId = ref<string | null>(null);
const selectedFile = ref<string | null>(null);
const showMkdirModal = ref(false);
const showRenameModal = ref(false);
const newItemName = ref('');
const renameNewName = ref('');
const pathInput = ref('');
const showPathSuggestions = ref(false);
const pathSuggestions = ref<string[]>([]);

const fitAddons = new Map<string, FitAddon>();

const wsUrl = computed(() => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//localhost:3000/api/terminal/${serverId.value}`;
});

onMounted(async () => {
  if (!serversStore.servers.length) {
    await serversStore.fetchServers();
  }
  await serversStore.checkConnection(serverId.value);
  
  if (isConnected.value) {
    addTerminalSession();
    await terminalStore.fetchFiles(serverId.value, '/');
  } else {
    console.warn('[Terminal] Server not connected');
  }
});

onBeforeUnmount(() => {
  terminalSessions.value.forEach(session => {
    if (session.ws) session.ws.close();
    if (session.terminal) session.terminal.dispose();
  });
  terminalSessions.value = [];
});

watch(isConnected, (connected) => {
  if (connected && terminalSessions.value.length === 0) {
    addTerminalSession();
    terminalStore.fetchFiles(serverId.value, '/');
  }
});

function addTerminalSession() {
  const id = `term-${Date.now()}`;
  const name = `Terminal ${terminalSessions.value.length + 1}`;
  terminalSessions.value.push({ id, name, terminal: null, ws: null, container: null });
  activeTerminalId.value = id;
  nextTick(() => {
    const session = terminalSessions.value.find(s => s.id === id);
    if (session) {
      initTerminal(session);
    }
  });
}

function initTerminal(session: { id: string; name: string; terminal: Terminal | null; ws: WebSocket | null; container: HTMLDivElement | null }) {
  const containerEl = document.getElementById(`terminal-${session.id}`);
  if (!containerEl) return;

  session.container = containerEl as HTMLDivElement;
  
  const terminal = new Terminal({
    theme: {
      background: '#1e1f22',
      foreground: '#dbdee1',
      cursor: '#dbdee1',
      cursorAccent: '#1e1f22',
      selectionBackground: 'rgba(79, 84, 92, 0.4)',
      black: '#1e1f22',
      red: '#f23f43',
      green: '#23a559',
      yellow: '#f0b132',
      blue: '#00a8fc',
      magenta: '#f23f43',
      cyan: '#00a8fc',
      white: '#dbdee1',
      brightBlack: '#949ba4',
      brightRed: '#f23f43',
      brightGreen: '#23a559',
      brightYellow: '#f0b132',
      brightBlue: '#00a8fc',
      brightMagenta: '#f23f43',
      brightCyan: '#00a8fc',
      brightWhite: '#f2f3f5'
    },
    fontFamily: 'Fira Code, Consolas, Monaco, monospace',
    fontSize: 14,
    lineHeight: 1.2,
    cursorBlink: true
  });

  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(containerEl);
  fitAddon.fit();
  fitAddons.set(session.id, fitAddon);

  session.terminal = terminal;

  const ws = new WebSocket(`${wsUrl.value}?cols=${terminal.cols}&rows=${terminal.rows}`);
  session.ws = ws;

  ws.onopen = () => {
    console.log('[Terminal] WebSocket connected');
    ws.send(JSON.stringify({ type: 'create' }));
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'output' && session.terminal) {
      session.terminal.write(msg.data);
    } else if (msg.type === 'created') {
      console.log('[Terminal] Shell created:', msg.sessionId);
    } else if (msg.type === 'error') {
      console.error('[Terminal] Error:', msg.message);
      session.terminal?.write(`\x1b[31mError: ${msg.message}\x1b[0m\r\n`);
    }
  };

  ws.onclose = (event) => {
    console.log('[Terminal] WebSocket closed:', event.code, event.reason);
    if (event.code === 4001) {
      session.terminal?.write('\r\n\x1b[31mSSH connection not available. Please reconnect to the server.\x1b[0m\r\n');
    } else if (event.code === 4004) {
      session.terminal?.write('\r\n\x1b[31mServer not found.\x1b[0m\r\n');
    } else {
      session.terminal?.write('\r\n\x1b[33mConnection closed\x1b[0m\r\n');
    }
  };

  ws.onerror = (error) => {
    console.error('[Terminal] WebSocket error:', error);
    session.terminal?.write('\r\n\x1b[31mConnection error\x1b[0m\r\n');
  };

  terminal.onData((data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'input', data }));
    }
  });

  terminal.onResize(({ cols, rows }) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resize', cols, rows }));
    }
  });

  const resizeObserver = new ResizeObserver(() => {
    fitAddon.fit();
    terminal.resize(terminal.cols, terminal.rows);
  });
  resizeObserver.observe(containerEl);
}

function closeTerminalSession(sessionId: string) {
  const index = terminalSessions.value.findIndex(s => s.id === sessionId);
  if (index !== -1) {
    const session = terminalSessions.value[index];
    if (session.ws) session.ws.close();
    if (session.terminal) session.terminal.dispose();
    fitAddons.delete(sessionId);
    terminalSessions.value.splice(index, 1);
    
    if (activeTerminalId.value === sessionId) {
      activeTerminalId.value = terminalSessions.value.length > 0 ? terminalSessions.value[0].id : null;
    }
  }
}

function switchTerminal(sessionId: string) {
  activeTerminalId.value = sessionId;
  nextTick(() => {
    const fitAddon = fitAddons.get(sessionId);
    if (fitAddon) {
      fitAddon.fit();
    }
  });
}

async function navigateTo(path: string) {
  await terminalStore.fetchFiles(serverId.value, path);
  selectedFile.value = null;
}

async function refreshFiles() {
  await terminalStore.fetchFiles(serverId.value, terminalStore.fileManagerPath);
}

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
}

function selectFile(path: string) {
  selectedFile.value = selectedFile.value === path ? null : path;
}

function enterDirectory(file: { isDirectory: boolean; path: string }) {
  if (file.isDirectory) {
    navigateTo(file.path);
  }
}

function downloadFile() {
  if (!selectedFile.value) return;
  const url = terminalStore.getDownloadUrl(serverId.value, selectedFile.value);
  const link = document.createElement('a');
  link.href = url;
  link.download = selectedFile.value.split('/').pop() || 'download';
  link.click();
}

async function deleteSelected() {
  if (!selectedFile.value) return;
  if (!confirm(`Delete ${selectedFile.value}?`)) return;
  await terminalStore.deleteFile(serverId.value, selectedFile.value);
  selectedFile.value = null;
}

function openRenameModal() {
  if (!selectedFile.value) return;
  renameNewName.value = selectedFile.value.split('/').pop() || '';
  showRenameModal.value = true;
}

async function doRename() {
  if (!selectedFile.value || !renameNewName.value) return;
  const dir = selectedFile.value.split('/').slice(0, -1).join('/');
  const newPath = `${dir}/${renameNewName.value}`;
  await terminalStore.renameFile(serverId.value, selectedFile.value, newPath);
  showRenameModal.value = false;
  selectedFile.value = null;
}

function openMkdirModal() {
  newItemName.value = '';
  showMkdirModal.value = true;
}

async function doMkdir() {
  if (!newItemName.value) return;
  await terminalStore.createDirectory(serverId.value, terminalStore.fileManagerPath, newItemName.value);
  showMkdirModal.value = false;
}

function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;
  
  Array.from(input.files).forEach(file => {
    const reader = new FileReader();
    reader.onload = async () => {
      const url = terminalStore.getUploadUrl(serverId.value, terminalStore.fileManagerPath, file.name);
      try {
        await fetch(url, {
          method: 'POST',
          body: reader.result
        });
        await refreshFiles();
      } catch (e) {
        console.error('Upload failed:', e);
      }
    };
    reader.readAsArrayBuffer(file);
  });
  
  input.value = '';
}

function onPathInputFocus() {
  pathInput.value = terminalStore.fileManagerPath;
  showPathSuggestions.value = true;
  updatePathSuggestions();
}

function onPathInputBlur() {
  setTimeout(() => {
    showPathSuggestions.value = false;
  }, 200);
}

function updatePathSuggestions() {
  const currentPath = pathInput.value;
  const lastSlash = currentPath.lastIndexOf('/');
  const dirPath = lastSlash === 0 ? '/' : currentPath.substring(0, lastSlash) || '/';
  const prefix = currentPath.substring(lastSlash + 1).toLowerCase();
  
  if (terminalStore.fileList && terminalStore.fileList.path === dirPath) {
    pathSuggestions.value = terminalStore.fileList.files
      .filter(f => f.name.toLowerCase().startsWith(prefix))
      .map(f => f.isDirectory ? currentPath.substring(0, lastSlash + 1) + f.name + '/' : currentPath.substring(0, lastSlash + 1) + f.name);
  } else {
    pathSuggestions.value = [];
  }
}

async function onPathInputChange() {
  updatePathSuggestions();
}

function selectPathSuggestion(suggestion: string) {
  pathInput.value = suggestion;
  showPathSuggestions.value = false;
}

async function submitPath() {
  showPathSuggestions.value = false;
  let targetPath = pathInput.value.trim();
  
  if (!targetPath.startsWith('/')) {
    targetPath = '/' + targetPath;
  }
  
  if (targetPath.endsWith('/') && targetPath !== '/') {
    targetPath = targetPath.slice(0, -1);
  }
  
  await terminalStore.fetchFiles(serverId.value, targetPath);
  selectedFile.value = null;
}
</script>

<template>
  <div class="terminal-page">
    <header class="page-header">
      <div class="header-left">
        <button class="btn btn-secondary btn-icon" @click="router.back()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div class="server-title">
          <h1>{{ server?.name || 'Server' }}</h1>
          <p>
            <span class="status-dot" :class="isConnected ? 'online' : 'offline'"></span>
            {{ isConnected ? 'Connected' : 'Disconnected' }}
          </p>
        </div>
      </div>
    </header>

    <div class="tab-bar">
      <button class="tab-btn" :class="{ active: activeTab === 'terminal' }" @click="activeTab = 'terminal'">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="4 17 10 11 4 5"></polyline>
          <line x1="12" y1="19" x2="20" y2="19"></line>
        </svg>
        Terminal
      </button>
      <button class="tab-btn" :class="{ active: activeTab === 'files' }" @click="activeTab = 'files'">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
        Files
      </button>
    </div>

    <div class="tab-content">
      <div v-if="activeTab === 'terminal'" class="terminal-container">
        <div class="terminal-tabs">
          <div class="terminal-tab-list">
            <button
              v-for="session in terminalSessions"
              :key="session.id"
              class="terminal-tab"
              :class="{ active: activeTerminalId === session.id }"
              @click="switchTerminal(session.id)"
            >
              {{ session.name }}
              <span class="close-btn" @click.stop="closeTerminalSession(session.id)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </span>
            </button>
            <button class="terminal-tab add-tab" @click="addTerminalSession">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
        </div>
        <div class="terminal-windows">
          <div
            v-for="session in terminalSessions"
            :key="session.id"
            :id="`terminal-${session.id}`"
            class="terminal-window"
            :class="{ active: activeTerminalId === session.id }"
          ></div>
        </div>
      </div>

      <div v-else-if="activeTab === 'files'" class="files-container">
        <div class="files-toolbar">
          <div class="path-nav">
            <button class="breadcrumb-item home-btn" @click="navigateTo('/')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              </svg>
            </button>
            <div class="path-input-wrapper">
              <input
                v-model="pathInput"
                type="text"
                class="path-input"
                placeholder="Enter path..."
                @focus="onPathInputFocus"
                @blur="onPathInputBlur"
                @input="onPathInputChange"
                @keyup.enter="submitPath"
              />
              <div v-if="showPathSuggestions && pathSuggestions.length > 0" class="path-suggestions">
                <button
                  v-for="(suggestion, idx) in pathSuggestions.slice(0, 10)"
                  :key="idx"
                  class="suggestion-item"
                  @mousedown="selectPathSuggestion(suggestion)"
                >
                  {{ suggestion }}
                </button>
              </div>
            </div>
          </div>
          <div class="toolbar-actions">
            <button class="btn btn-secondary btn-sm" @click="refreshFiles">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
              Refresh
            </button>
            <button class="btn btn-secondary btn-sm" @click="openMkdirModal">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                <line x1="12" y1="11" x2="12" y2="17"></line>
                <line x1="9" y1="14" x2="15" y2="14"></line>
              </svg>
              New Folder
            </button>
            <label class="btn btn-primary btn-sm upload-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              Upload
              <input type="file" multiple @change="handleFileUpload" hidden>
            </label>
          </div>
        </div>

        <div class="file-list">
          <div class="file-header">
            <span class="file-name">Name</span>
            <span class="file-size">Size</span>
            <span class="file-date">Modified</span>
            <span class="file-perms">Permissions</span>
          </div>
          
          <div v-if="terminalStore.loading" class="file-loading">Loading...</div>
          
          <template v-else-if="terminalStore.fileList">
            <div
              v-if="terminalStore.fileList.parentPath"
              class="file-row parent-dir"
              @click="navigateTo(terminalStore.fileList!.parentPath!)"
            >
              <span class="file-name">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                ..
              </span>
            </div>
            
            <div
              v-for="file in terminalStore.fileList.files"
              :key="file.path"
              class="file-row"
              :class="{ selected: selectedFile === file.path }"
              @click="selectFile(file.path)"
              @dblclick="enterDirectory(file)"
            >
              <span class="file-name">
                <svg v-if="file.isDirectory" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" stroke-width="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                  <polyline points="13 2 13 9 20 9"></polyline>
                </svg>
                {{ file.name }}
              </span>
              <span class="file-size">{{ file.isDirectory ? '-' : formatSize(file.size) }}</span>
              <span class="file-date">{{ formatDate(file.modifiedTime) }}</span>
              <span class="file-perms">{{ file.permissions }}</span>
            </div>
          </template>
        </div>

        <div v-if="selectedFile" class="file-actions">
          <span class="selected-info">{{ selectedFile.split('/').pop() }}</span>
          <div class="action-buttons">
            <button v-if="!terminalStore.fileList?.files.find(f => f.path === selectedFile)?.isDirectory" class="btn btn-secondary btn-sm" @click="downloadFile">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Download
            </button>
            <button class="btn btn-secondary btn-sm" @click="openRenameModal">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              Rename
            </button>
            <button class="btn btn-danger btn-sm" @click="deleteSelected">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showMkdirModal" class="modal-overlay" @click.self="showMkdirModal = false">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">New Folder</h2>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Folder Name</label>
            <input v-model="newItemName" class="form-input" type="text" @keyup.enter="doMkdir">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showMkdirModal = false">Cancel</button>
          <button class="btn btn-primary" @click="doMkdir">Create</button>
        </div>
      </div>
    </div>

    <div v-if="showRenameModal" class="modal-overlay" @click.self="showRenameModal = false">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Rename</h2>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">New Name</label>
            <input v-model="renameNewName" class="form-input" type="text" @keyup.enter="doRename">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showRenameModal = false">Cancel</button>
          <button class="btn btn-primary" @click="doRename">Rename</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.terminal-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-primary);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--card-border);
}

.header-left {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
}

.server-title h1 {
  font-size: 20px;
  font-weight: 600;
  color: var(--header-primary);
  margin: 0;
}

.server-title p {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  color: var(--text-muted);
  font-size: 14px;
  margin: var(--spacing-xs) 0 0;
}

.tab-bar {
  display: flex;
  padding: 0 var(--spacing-lg);
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--card-border);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all var(--transition-fast);
}

.tab-btn:hover {
  color: var(--text-normal);
}

.tab-btn.active {
  color: var(--brand-experiment);
  border-bottom-color: var(--brand-experiment);
}

.tab-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.terminal-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-tertiary);
}

.terminal-tabs {
  display: flex;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--card-border);
}

.terminal-tab-list {
  display: flex;
  align-items: center;
}

.terminal-tab {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  border-right: 1px solid var(--card-border);
}

.terminal-tab:hover {
  background-color: var(--bg-modifier-hover);
}

.terminal-tab.active {
  background-color: var(--bg-tertiary);
  color: var(--text-normal);
}

.terminal-tab .close-btn {
  display: flex;
  padding: 2px;
  border-radius: 2px;
  opacity: 0;
}

.terminal-tab:hover .close-btn {
  opacity: 1;
}

.terminal-tab .close-btn:hover {
  background-color: var(--bg-modifier-active);
}

.terminal-tab.add-tab {
  padding: var(--spacing-xs) var(--spacing-sm);
  opacity: 0.6;
}

.terminal-tab.add-tab:hover {
  opacity: 1;
}

.terminal-windows {
  flex: 1;
  position: relative;
}

.terminal-window {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: none;
  padding: var(--spacing-sm);
}

.terminal-window.active {
  display: block;
}

.files-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.files-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--card-border);
}

.path-nav {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex: 1;
  max-width: 500px;
}

.home-btn {
  flex-shrink: 0;
}

.path-input-wrapper {
  position: relative;
  flex: 1;
}

.path-input {
  width: 100%;
  padding: 6px 10px;
  background-color: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: var(--radius-sm);
  color: var(--text-normal);
  font-size: 13px;
  font-family: var(--font-mono);
}

.path-input:focus {
  outline: none;
  border-color: var(--brand-experiment);
}

.path-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background-color: var(--bg-primary);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
  max-height: 200px;
  overflow-y: auto;
  z-index: 100;
  margin-top: 2px;
}

.suggestion-item {
  display: block;
  width: 100%;
  padding: 6px 10px;
  background: none;
  border: none;
  color: var(--text-normal);
  font-size: 13px;
  font-family: var(--font-mono);
  text-align: left;
  cursor: pointer;
}

.suggestion-item:hover {
  background-color: var(--bg-modifier-hover);
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: 13px;
}

.breadcrumb-item {
  background: none;
  border: none;
  color: var(--text-link);
  cursor: pointer;
  font-size: 13px;
  padding: 2px 4px;
  border-radius: var(--radius-sm);
}

.breadcrumb-item:hover {
  background-color: var(--bg-modifier-hover);
}

.breadcrumb-sep {
  color: var(--text-muted);
}

.toolbar-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
}

.upload-btn {
  cursor: pointer;
}

.file-list {
  flex: 1;
  overflow-y: auto;
}

.file-header {
  display: flex;
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--bg-secondary);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  border-bottom: 1px solid var(--card-border);
}

.file-row {
  display: flex;
  padding: var(--spacing-sm) var(--spacing-md);
  border-bottom: 1px solid var(--card-border);
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.file-row:hover {
  background-color: var(--bg-modifier-hover);
}

.file-row.selected {
  background-color: var(--bg-modifier-selected);
}

.file-row.parent-dir {
  color: var(--text-muted);
}

.file-name {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  width: 80px;
  text-align: right;
  color: var(--text-muted);
  font-size: 13px;
}

.file-date {
  width: 100px;
  color: var(--text-muted);
  font-size: 13px;
}

.file-perms {
  width: 100px;
  color: var(--text-muted);
  font-size: 12px;
  font-family: var(--font-mono);
}

.file-loading {
  padding: var(--spacing-xl);
  text-align: center;
  color: var(--text-muted);
}

.file-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--bg-secondary);
  border-top: 1px solid var(--card-border);
}

.selected-info {
  font-size: 13px;
  color: var(--text-normal);
}

.action-buttons {
  display: flex;
  gap: var(--spacing-sm);
}

.form-input {
  width: 100%;
  padding: var(--spacing-sm);
  background-color: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: var(--radius-sm);
  color: var(--text-normal);
  font-size: 14px;
}

.form-input:focus {
  outline: none;
  border-color: var(--brand-experiment);
}
</style>
