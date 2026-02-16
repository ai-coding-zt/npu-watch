<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useServersStore } from '@/stores/servers';
import AddServerModal from '@/components/AddServerModal.vue';
import type { ServerConfig } from '@/types';

const router = useRouter();
const serversStore = useServersStore();

const showAddModal = ref(false);
const editingServer = ref<ServerConfig | null>(null);
const connectingId = ref<string | null>(null);
const passwordPrompt = ref<{ id: string; name: string } | null>(null);
const passwordInput = ref('');

const servers = computed(() => serversStore.servers);

onMounted(() => {
  if (!serversStore.hasLoaded) {
    serversStore.fetchServers();
  }
});

async function handleConnect(server: ServerConfig) {
  connectingId.value = server.id;
  try {
    await serversStore.connectServer(server.id);
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Connection failed';
    if (server.authType === 'password' && (errorMsg.includes('Authentication') || errorMsg.includes('password'))) {
      passwordPrompt.value = { id: server.id, name: server.name };
      passwordInput.value = '';
    } else {
      alert(errorMsg);
    }
  } finally {
    connectingId.value = null;
  }
}

async function handleConnectWithPassword() {
  if (!passwordPrompt.value) return;
  connectingId.value = passwordPrompt.value.id;
  try {
    await serversStore.connectServer(passwordPrompt.value.id, passwordInput.value);
    passwordPrompt.value = null;
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Connection failed');
  } finally {
    connectingId.value = null;
  }
}

async function handleDisconnect(serverId: string) {
  await serversStore.disconnectServer(serverId);
}

function handleEdit(server: ServerConfig) {
  editingServer.value = server;
  showAddModal.value = true;
}

async function handleDelete(server: ServerConfig) {
  if (confirm(`Delete server "${server.name}"?`)) {
    await serversStore.deleteServer(server.id);
  }
}

function goToMonitor(serverId: string) {
  router.push(`/monitor/${serverId}`);
}

function goToTerminal(serverId: string) {
  router.push(`/terminal/${serverId}`);
}

function handleModalClose() {
  showAddModal.value = false;
  editingServer.value = null;
}

function handleModalSaved() {
  showAddModal.value = false;
  editingServer.value = null;
  serversStore.fetchServers();
}
</script>

<template>
  <div class="servers-page">
    <header class="page-header">
      <div class="header-content">
        <h1>Servers</h1>
        <p>Manage your NPU server connections</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" @click="serversStore.fetchServers(true)" :disabled="serversStore.loading">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ 'spin': serversStore.loading }">
            <path d="M23 4v6h-6M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          Refresh
        </button>
        <button class="btn btn-primary" @click="showAddModal = true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Add Server
        </button>
      </div>
    </header>

    <div v-if="serversStore.loading" class="loading">Loading...</div>

    <div v-else-if="servers.length === 0" class="empty-state">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
        <line x1="8" y1="21" x2="16" y2="21"></line>
        <line x1="12" y1="17" x2="12" y2="21"></line>
      </svg>
      <h3>No servers configured</h3>
      <p>Add a server to start monitoring your NPU devices</p>
      <button class="btn btn-primary" @click="showAddModal = true">Add Server</button>
    </div>

    <div v-else class="card">
      <table class="table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Name</th>
            <th>Host</th>
            <th>Port</th>
            <th>Username</th>
            <th>Auth Type</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="server in servers" :key="server.id">
            <td>
              <span class="status-dot" :class="serversStore.isConnected(server.id) ? 'online' : 'offline'"></span>
              {{ serversStore.isConnected(server.id) ? 'Connected' : 'Disconnected' }}
            </td>
            <td>
              <a href="#" @click.prevent="goToMonitor(server.id)">{{ server.name }}</a>
            </td>
            <td><code>{{ server.host }}</code></td>
            <td>{{ server.port }}</td>
            <td>{{ server.username }}</td>
            <td>
              <span class="badge badge-info">{{ server.authType }}</span>
            </td>
            <td>
              <div class="action-buttons">
                <template v-if="serversStore.isConnected(server.id)">
                  <button class="btn btn-secondary btn-sm" @click="handleDisconnect(server.id)">Disconnect</button>
                  <button class="btn btn-secondary btn-sm" @click="goToTerminal(server.id)">Terminal</button>
                  <button class="btn btn-primary btn-sm" @click="goToMonitor(server.id)">Monitor</button>
                </template>
                <button v-else class="btn btn-primary btn-sm" @click="handleConnect(server)" :disabled="connectingId === server.id">
                  {{ connectingId === server.id ? 'Connecting...' : 'Connect' }}
                </button>
                <button class="btn btn-secondary btn-sm" @click="handleEdit(server)">Edit</button>
                <button class="btn btn-danger btn-sm" @click="handleDelete(server)">Delete</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="passwordPrompt" class="modal-overlay" @click.self="passwordPrompt = null">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Enter Password</h2>
          <p class="modal-subtitle">Password for {{ passwordPrompt.name }}</p>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Password</label>
            <input
              v-model="passwordInput"
              type="password"
              class="form-input"
              placeholder="Enter password"
              @keyup.enter="handleConnectWithPassword"
              autofocus
            />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="passwordPrompt = null">Cancel</button>
          <button class="btn btn-primary" @click="handleConnectWithPassword" :disabled="!passwordInput">Connect</button>
        </div>
      </div>
    </div>

    <AddServerModal
      v-if="showAddModal"
      :server="editingServer"
      @close="handleModalClose"
      @saved="handleModalSaved"
    />
  </div>
</template>

<style scoped>
.servers-page {
  padding: var(--spacing-lg);
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-xl);
}

.page-header h1 {
  font-size: 28px;
  font-weight: 700;
  color: var(--header-primary);
  margin: 0;
}

.page-header p {
  color: var(--text-muted);
  margin: var(--spacing-xs) 0 0;
}

.header-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.loading {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--text-muted);
}

.empty-state {
  text-align: center;
  padding: var(--spacing-2xl);
}

.empty-state h3 {
  margin: var(--spacing-md) 0 var(--spacing-sm);
  color: var(--header-primary);
}

.empty-state p {
  color: var(--text-muted);
  margin-bottom: var(--spacing-md);
}

.action-buttons {
  display: flex;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
}
</style>
