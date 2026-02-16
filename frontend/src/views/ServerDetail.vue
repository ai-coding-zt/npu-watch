<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useServersStore } from '@/stores/servers';
import { useMonitorStore } from '@/stores/monitor';
import { monitorApi } from '@/api';
import LineChart from '@/components/LineChart.vue';
import type { NPUHistoryRecord, NPUChip } from '@/types';

const route = useRoute();
const router = useRouter();
const serversStore = useServersStore();
const monitorStore = useMonitorStore();

const serverId = computed(() => route.params.id as string);
const server = computed(() => serversStore.servers.find(s => s.id === serverId.value));
const isConnected = computed(() => serversStore.isConnected(serverId.value));
const summary = computed(() => monitorStore.getSummary(serverId.value));

const chips = computed((): NPUChip[] => summary.value?.chips || []);
const selectedChipIndex = ref(0);
const historyLoading = ref(false);
const historyData = ref<NPUHistoryRecord[]>([]);

const selectedChip = computed(() => {
  if (!chips.value.length) return null;
  return chips.value[selectedChipIndex.value] || chips.value[0];
});

const tempChartData = computed(() => 
  historyData.value.map(d => ({ timestamp: d.timestamp, value: d.temperature }))
);

const powerChartData = computed(() => 
  historyData.value.map(d => ({ timestamp: d.timestamp, value: d.powerUsage }))
);

async function fetchHistory() {
  if (!selectedChip.value || !isConnected.value) return;
  
  historyLoading.value = true;
  try {
    const response = await monitorApi.getNpuHistory(
      serverId.value,
      selectedChip.value.npuId,
      selectedChip.value.chipId
    );
    if (response.data.success && response.data.data) {
      historyData.value = response.data.data.records;
    }
  } catch (e) {
    console.error('Failed to fetch history:', e);
  } finally {
    historyLoading.value = false;
  }
}

onMounted(async () => {
  if (!serversStore.servers.length) {
    await serversStore.fetchServers();
  }
});

watch(isConnected, async (connected) => {
  if (connected && !summary.value) {
    await monitorStore.fetchSummary(serverId.value);
  }
  if (connected && selectedChip.value) {
    await fetchHistory();
  }
}, { immediate: true });

watch(selectedChip, () => {
  if (isConnected.value) {
    fetchHistory();
  }
});

async function handleConnect() {
  if (!server.value) return;
  try {
    await serversStore.connectServer(server.value.id);
    await monitorStore.fetchSummary(server.value.id);
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Connection failed');
  }
}

async function handleDisconnect() {
  await serversStore.disconnectServer(serverId.value);
  historyData.value = [];
}

function goToMonitor() {
  router.push(`/monitor/${serverId.value}`);
}

function goToTerminal() {
  router.push(`/terminal/${serverId.value}`);
}
</script>

<template>
  <div class="server-detail-page">
    <div v-if="!server" class="not-found">
      <h2>Server not found</h2>
      <button class="btn btn-primary" @click="router.push('/servers')">Back to Servers</button>
    </div>

    <template v-else>
      <header class="page-header">
        <div class="header-left">
          <button class="btn btn-secondary btn-icon" @click="router.back()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <div class="server-title">
            <h1>{{ server.name }}</h1>
            <p>
              <span class="status-dot" :class="isConnected ? 'online' : 'offline'"></span>
              {{ isConnected ? 'Connected' : 'Disconnected' }}
            </p>
          </div>
        </div>
        <div class="header-actions">
          <button v-if="isConnected" class="btn btn-secondary" @click="handleDisconnect">Disconnect</button>
          <button v-else class="btn btn-primary" @click="handleConnect">Connect</button>
          <button v-if="isConnected" class="btn btn-secondary" @click="goToTerminal">Terminal</button>
          <button v-if="isConnected" class="btn btn-primary" @click="goToMonitor">Open Monitor</button>
        </div>
      </header>

      <div class="detail-grid">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Connection Details</h3>
          </div>
          <div class="detail-list">
            <div class="detail-item">
              <span class="detail-label">Host</span>
              <span class="detail-value"><code>{{ server.host }}</code></span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Port</span>
              <span class="detail-value">{{ server.port }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Username</span>
              <span class="detail-value">{{ server.username }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Authentication</span>
              <span class="detail-value">
                <span class="badge badge-info">{{ server.authType }}</span>
              </span>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Timestamps</h3>
          </div>
          <div class="detail-list">
            <div class="detail-item">
              <span class="detail-label">Created</span>
              <span class="detail-value">{{ new Date(server.createdAt).toLocaleString() }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Last Updated</span>
              <span class="detail-value">{{ new Date(server.updatedAt).toLocaleString() }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="isConnected && chips.length > 0" class="history-section">
        <div class="section-header">
          <h3>NPU History</h3>
          <div class="chip-selector">
            <label class="form-label">Select Chip:</label>
            <select v-model="selectedChipIndex" class="chip-select">
              <option v-for="(chip, index) in chips" :key="index" :value="index">
                NPU {{ chip.npuId }} / Chip {{ chip.chipId }}
              </option>
            </select>
          </div>
        </div>
        
        <div v-if="historyLoading" class="loading-state">Loading history data...</div>
        
        <div v-else class="charts-grid">
          <LineChart
            :data="tempChartData"
            label="Temperature"
            unit="C"
            color="#ed4245"
            :min="0"
            :max="100"
          />
          <LineChart
            :data="powerChartData"
            label="Power Usage"
            unit="W"
            color="#faa61a"
            :min="0"
            :max="400"
          />
        </div>
      </div>

      <div v-else-if="isConnected && chips.length === 0" class="no-chips">
        <p>No NPU chips detected. Connect to retrieve chip information.</p>
      </div>

      <div class="quick-actions">
        <h3>Quick Actions</h3>
        <div class="action-grid">
          <button class="action-card" @click="router.push('/servers')">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <span>Edit Server</span>
          </button>
          <button v-if="isConnected" class="action-card" @click="goToMonitor">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
              <rect x="9" y="9" width="6" height="6" />
            </svg>
            <span>Monitor NPU</span>
          </button>
          <button v-if="isConnected" class="action-card" @click="goToTerminal">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="4 17 10 11 4 5"></polyline>
              <line x1="12" y1="19" x2="20" y2="19"></line>
            </svg>
            <span>Terminal</span>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.server-detail-page {
  padding: var(--spacing-lg);
  max-width: 1200px;
  margin: 0 auto;
}

.not-found {
  text-align: center;
  padding: var(--spacing-2xl);
}

.not-found h2 {
  margin-bottom: var(--spacing-md);
  color: var(--header-primary);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-xl);
}

.header-left {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
}

.server-title h1 {
  font-size: 24px;
  font-weight: 700;
  color: var(--header-primary);
  margin: 0;
}

.server-title p {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  color: var(--text-muted);
  margin: var(--spacing-xs) 0 0;
}

.header-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);
}

.detail-list {
  display: flex;
  flex-direction: column;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) 0;
  border-bottom: 1px solid var(--card-border);
}

.detail-item:last-child {
  border-bottom: none;
}

.detail-label {
  font-size: 14px;
  color: var(--text-muted);
}

.detail-value {
  font-size: 14px;
  color: var(--text-normal);
}

.history-section {
  margin-bottom: var(--spacing-xl);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.section-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--header-primary);
  margin: 0;
}

.chip-selector {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.form-label {
  font-size: 14px;
  color: var(--text-muted);
}

.chip-select {
  padding: var(--spacing-xs) var(--spacing-sm);
  background-color: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: var(--radius-sm);
  color: var(--text-normal);
  font-size: 14px;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: var(--spacing-md);
}

.loading-state {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--text-muted);
}

.no-chips {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--text-muted);
  background-color: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-xl);
}

.quick-actions h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--header-primary);
  margin-bottom: var(--spacing-md);
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--spacing-md);
}

.action-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-lg);
  background-color: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-md);
  color: var(--text-normal);
  transition: all var(--transition-fast);
}

.action-card:hover {
  border-color: var(--brand-experiment);
  background-color: var(--bg-modifier-hover);
}
</style>
