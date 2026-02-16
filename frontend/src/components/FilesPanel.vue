<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useTerminalStore } from '@/stores/terminal';
import { API_BASE_FULL } from '@/constants';

const props = defineProps<{
  serverId: string;
  isConnected: boolean;
}>();

const terminalStore = useTerminalStore();

const selectedFile = ref<string | null>(null);
const showMkdirModal = ref(false);
const showRenameModal = ref(false);
const showViewModal = ref(false);
const newItemName = ref('');
const renameNewName = ref('');
const pathInput = ref('');
const showPathSuggestions = ref(false);
const pathSuggestions = ref<string[]>([]);
const suggestionsLoading = ref(false);
const viewingFile = ref<{ path: string; content: string; isBinary: boolean; size: number } | null>(null);
const viewLoading = ref(false);

const currentPath = computed(() => terminalStore.fileManagerPath);

async function navigateTo(path: string) {
  await terminalStore.fetchFiles(props.serverId, path);
  selectedFile.value = null;
}

async function refreshFiles() {
  await terminalStore.fetchFiles(props.serverId, terminalStore.fileManagerPath);
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
  const url = terminalStore.getDownloadUrl(props.serverId, selectedFile.value);
  const link = document.createElement('a');
  link.href = url;
  link.download = selectedFile.value.split('/').pop() || 'download';
  link.click();
}

async function deleteSelected() {
  if (!selectedFile.value) return;
  if (!confirm(`Delete ${selectedFile.value}?`)) return;
  await terminalStore.deleteFile(props.serverId, selectedFile.value);
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
  await terminalStore.renameFile(props.serverId, selectedFile.value, newPath);
  showRenameModal.value = false;
  selectedFile.value = null;
}

function openMkdirModal() {
  newItemName.value = '';
  showMkdirModal.value = true;
}

async function doMkdir() {
  if (!newItemName.value) return;
  await terminalStore.createDirectory(props.serverId, terminalStore.fileManagerPath, newItemName.value);
  showMkdirModal.value = false;
}

function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;
  
  Array.from(input.files).forEach(file => {
    const reader = new FileReader();
    reader.onload = async () => {
      const url = terminalStore.getUploadUrl(props.serverId, terminalStore.fileManagerPath, file.name);
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
  if (!pathInput.value) {
    pathInput.value = terminalStore.fileManagerPath;
  }
  showPathSuggestions.value = true;
  fetchPathSuggestions(pathInput.value);
}

function onPathInputBlur() {
  setTimeout(() => {
    showPathSuggestions.value = false;
  }, 200);
}

async function fetchPathSuggestions(partialPath: string) {
  if (!props.isConnected) {
    pathSuggestions.value = [];
    return;
  }
  
  suggestionsLoading.value = true;
  
  try {
    const response = await fetch(
      `${API_BASE_FULL}/servers/${props.serverId}/files/autocomplete?path=${encodeURIComponent(partialPath)}`
    );
    const data = await response.json();
    
    if (data.success && data.data) {
      pathSuggestions.value = data.data;
    } else {
      pathSuggestions.value = [];
    }
  } catch (e) {
    console.error('Autocomplete error:', e);
    pathSuggestions.value = [];
  } finally {
    suggestionsLoading.value = false;
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function onPathInputChange() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    fetchPathSuggestions(pathInput.value);
  }, 50);
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
  
  await terminalStore.fetchFiles(props.serverId, targetPath);
  selectedFile.value = null;
}

async function openViewModal() {
  if (!selectedFile.value) return;
  
  viewLoading.value = true;
  showViewModal.value = true;
  
  const result = await terminalStore.viewFile(props.serverId, selectedFile.value);
  
  if (result) {
    viewingFile.value = {
      path: selectedFile.value,
      content: result.content,
      isBinary: result.isBinary,
      size: result.size
    };
  } else {
    showViewModal.value = false;
  }
  
  viewLoading.value = false;
}

onMounted(() => {
  if (props.isConnected) {
    terminalStore.fetchFiles(props.serverId, '/');
  }
});

watch(() => props.isConnected, (connected, wasConnected) => {
  if (connected && !wasConnected) {
    terminalStore.fetchFiles(props.serverId, '/');
  }
});

watch(() => props.serverId, (newId, oldId) => {
  if (newId !== oldId) {
    selectedFile.value = null;
    pathInput.value = '';
    if (props.isConnected) {
      terminalStore.fetchFiles(newId, '/');
    }
  }
});
</script>

<template>
  <div class="files-panel">
    <div v-if="!isConnected" class="disconnected-state">
      <p>Not connected to server</p>
    </div>
    
    <template v-else>
      <div class="current-path">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
        <span class="path-text">{{ currentPath }}</span>
      </div>
      
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
                v-for="(suggestion, idx) in pathSuggestions.slice(0, 15)"
                :key="idx"
                type="button"
                class="suggestion-item"
                @mousedown.prevent
                @click="selectPathSuggestion(suggestion)"
              >
                {{ suggestion }}
              </button>
            </div>
            <div v-else-if="showPathSuggestions && suggestionsLoading" class="path-suggestions">
              <span class="suggestion-loading">Loading...</span>
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
          <button v-if="!terminalStore.fileList?.files.find(f => f.path === selectedFile)?.isDirectory" class="btn btn-secondary btn-sm" @click="openViewModal">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            View
          </button>
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
    </template>

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

    <div v-if="showViewModal" class="modal-overlay" @click.self="showViewModal = false">
      <div class="modal modal-large">
        <div class="modal-header">
          <h2 class="modal-title">{{ viewingFile?.path?.split('/').pop() || 'View File' }}</h2>
          <button class="modal-close" @click="showViewModal = false">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div v-if="viewLoading" class="view-loading">Loading...</div>
          <div v-else-if="viewingFile" class="view-content">
            <div class="view-info">
              <span>{{ viewingFile.path }}</span>
              <span v-if="viewingFile.isBinary" class="binary-badge">Binary</span>
              <span class="size-info">{{ formatSize(viewingFile.size) }}</span>
            </div>
            <pre class="file-content" :class="{ 'binary-content': viewingFile.isBinary }">{{ viewingFile.content }}</pre>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showViewModal = false">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.files-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--bg-primary);
  border-radius: var(--radius-md);
}

.disconnected-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--text-muted);
}

.current-path {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--card-border);
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-normal);
}

.path-text {
  flex: 1;
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

.suggestion-loading {
  display: block;
  padding: 6px 10px;
  color: var(--text-muted);
  font-size: 13px;
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

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background-color: var(--bg-primary);
  border-radius: var(--radius-md);
  width: 90%;
  max-width: 440px;
  box-shadow: 0 0 0 1px var(--card-border), 0 2px 10px rgba(0, 0, 0, 0.2);
}

.modal-large {
  max-width: 900px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--card-border);
}

.modal-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-normal);
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-sm);
}

.modal-close:hover {
  color: var(--text-normal);
  background-color: var(--bg-modifier-hover);
}

.modal-body {
  padding: var(--spacing-md);
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border-top: 1px solid var(--card-border);
}

.view-loading {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--text-muted);
}

.view-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.view-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: 12px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.binary-badge {
  background-color: var(--brand-experiment);
  color: white;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-size: 10px;
  text-transform: uppercase;
}

.size-info {
  margin-left: auto;
}

.file-content {
  background-color: var(--bg-secondary);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
  padding: var(--spacing-md);
  margin: 0;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-normal);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 500px;
  overflow-y: auto;
}

.binary-content {
  color: var(--text-muted);
  font-style: italic;
}
</style>
