<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useServersStore } from '@/stores/servers';
import { useMonitorStore } from '@/stores/monitor';
import ServerCard from '@/components/ServerCard.vue';
import AddServerModal from '@/components/AddServerModal.vue';

const router = useRouter();
const serversStore = useServersStore();
const monitorStore = useMonitorStore();
const showAddModal = ref(false);
const connectingAll = ref(false);

const connectedServers = computed(() => serversStore.connectedServers);
const servers = computed(() => serversStore.servers);

function getNpuUsage(serverId: string): { used: number; total: number } | null {
  const summary = monitorStore.getSummary(serverId);
  if (!summary || !summary.chips.length) return null;
  
  const total = summary.chips.length;
  const usedNpuIds = new Set(
    summary.processes
      .filter(p => p.npuId >= 0)
      .map(p => p.npuId)
  );
  
  return { used: usedNpuIds.size, total };
}

function goToMonitor(serverId: string) {
  router.push(`/monitor/${serverId}`);
}

function handleServerAdded() {
  showAddModal.value = false;
  serversStore.fetchServers();
}

async function connectAndRefreshAll() {
  if (connectingAll.value) return;
  connectingAll.value = true;
  
  for (const server of servers.value) {
    if (!serversStore.isConnected(server.id)) {
      try {
        await serversStore.connectServer(server.id);
      } catch (e) {
        console.error(`Failed to connect to ${server.name}:`, e);
      }
    }
  }
  
  const connectedIds = servers.value
    .filter(s => serversStore.isConnected(s.id))
    .map(s => s.id);
  
  if (connectedIds.length > 0 && monitorStore.autoRefreshEnabled) {
    await monitorStore.startBackgroundRefreshForServers(connectedIds);
  }
  
  connectingAll.value = false;
}

onMounted(async () => {
  await serversStore.fetchServers();
  
  if (servers.value.length > 0 && !connectingAll.value) {
    await connectAndRefreshAll();
  }
});

onUnmounted(() => {
  monitorStore.stopAllAutoRefresh();
});

watch(() => servers.value.length, async (newLength, oldLength) => {
  if (newLength > oldLength && newLength > 0) {
    await connectAndRefreshAll();
  }
});
</script>

<template>
  <div class="dashboard">
    <header class="dashboard-header">
      <div class="header-content">
        <h1>NPU Watch</h1>
        <p>Ascend NPU Monitoring System</p>
      </div>
      <div class="header-actions">
        <button v-if="connectingAll" class="btn btn-secondary" disabled>
          Connecting...
        </button>
        <button v-else-if="monitorStore.autoRefreshEnabled" class="btn btn-secondary" @click="monitorStore.setAutoRefresh(false)">
          Pause Auto-Refresh
        </button>
        <button v-else class="btn btn-primary" @click="monitorStore.setAutoRefresh(true); connectAndRefreshAll()">
          Resume Auto-Refresh
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

    <section class="stats-section">
      <div class="stat-card">
        <div class="stat-value">{{ servers.length }}</div>
        <div class="stat-label">Total Servers</div>
      </div>
      <div class="stat-card">
        <div class="stat-value stat-value--green">{{ connectedServers.length }}</div>
        <div class="stat-label">Connected</div>
      </div>
      <div class="stat-card">
        <div class="stat-value stat-value--red">{{ servers.length - connectedServers.length }}</div>
        <div class="stat-label">Disconnected</div>
      </div>
    </section>

    <section class="refresh-status" v-if="connectedServers.length > 0">
      <div class="status-badge" :class="{ active: monitorStore.autoRefreshEnabled }">
        <span class="status-dot" :class="monitorStore.autoRefreshEnabled ? 'online' : 'offline'"></span>
        {{ monitorStore.autoRefreshEnabled ? `Auto-refreshing every ${monitorStore.refreshInterval / 1000}s` : 'Auto-refresh paused' }}
      </div>
    </section>

    <section class="servers-section">
      <h2>Servers</h2>
      <div v-if="serversStore.loading" class="loading">Loading servers...</div>
      <div v-else-if="servers.length === 0" class="empty-state">
        <p>No servers configured</p>
        <button class="btn btn-primary" @click="showAddModal = true">Add Your First Server</button>
      </div>
      <div v-else class="servers-grid">
        <ServerCard
          v-for="server in servers"
          :key="server.id"
          :server="server"
          :connected="serversStore.isConnected(server.id)"
          :npu-usage="getNpuUsage(server.id)"
          @click="goToMonitor(server.id)"
        />
      </div>
    </section>

    <AddServerModal
      v-if="showAddModal"
      @close="showAddModal = false"
      @saved="handleServerAdded"
    />
  </div>
</template>

<style scoped>
.dashboard {
  padding: var(--spacing-lg);
  max-width: 1400px;
  margin: 0 auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-xl);
}

.dashboard-header h1 {
  font-size: 28px;
  font-weight: 700;
  color: var(--header-primary);
  margin: 0;
}

.dashboard-header p {
  color: var(--text-muted);
  margin: var(--spacing-xs) 0 0;
}

.header-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.stats-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.stat-card {
  background-color: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
  text-align: center;
}

.stat-value {
  font-size: 36px;
  font-weight: 700;
  color: var(--header-primary);
}

.stat-value--green {
  color: var(--green);
}

.stat-value--red {
  color: var(--red);
}

.stat-label {
  font-size: 14px;
  color: var(--text-muted);
  margin-top: var(--spacing-xs);
}

.refresh-status {
  margin-bottom: var(--spacing-lg);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--bg-secondary);
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--text-muted);
}

.status-badge.active {
  background-color: rgba(35, 165, 89, 0.15);
  color: var(--green);
}

.servers-section h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--header-primary);
  margin-bottom: var(--spacing-md);
}

.loading,
.empty-state {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--text-muted);
}

.empty-state button {
  margin-top: var(--spacing-md);
}

.servers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-md);
}
</style>
