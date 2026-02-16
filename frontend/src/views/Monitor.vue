<script setup lang="ts">
import { onMounted, computed, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useServersStore } from '@/stores/servers';
import { useMonitorStore } from '@/stores/monitor';
import { useTerminalStateStore } from '@/stores/terminalState';
import MetricCard from '@/components/MetricCard.vue';
import ChipTable from '@/components/ChipTable.vue';
import ProcessList from '@/components/ProcessList.vue';
import SystemMonitor from '@/components/SystemMonitor.vue';
import TerminalPanel from '@/components/TerminalPanel.vue';
import FilesPanel from '@/components/FilesPanel.vue';

const route = useRoute();
const router = useRouter();
const serversStore = useServersStore();
const monitorStore = useMonitorStore();
const terminalStateStore = useTerminalStateStore();

const serverId = computed(() => route.params.serverId as string);
const server = computed(() => serversStore.servers.find(s => s.id === serverId.value));
const isConnected = computed(() => serversStore.isConnected(serverId.value));
const summary = computed(() => monitorStore.getSummary(serverId.value));
const loading = computed(() => monitorStore.isLoading(serverId.value));
const error = computed(() => monitorStore.getError(serverId.value));
const systemData = computed(() => monitorStore.getSystemSummary(serverId.value) || null);
const systemLoading = computed(() => monitorStore.isSystemLoading(serverId.value));
const systemError = computed(() => monitorStore.getSystemError(serverId.value));
const autoRefreshEnabled = computed(() => monitorStore.autoRefreshEnabled);
const refreshInterval = computed(() => monitorStore.refreshInterval);

const activeTab = ref<'npu' | 'system' | 'terminal'>('npu');
const terminalSubTab = ref<'shell' | 'files'>('shell');
const selectedChipIndex = ref(0);

watch(serverId, (id) => {
  if (id) {
    terminalStateStore.markVisited(id);
  }
}, { immediate: true });

const selectedChip = computed(() => {
  if (!summary.value?.chips.length) return null;
  return summary.value.chips[selectedChipIndex.value] || summary.value.chips[0];
});

const selectedTemp = computed(() => {
  if (!selectedChip.value || !summary.value) return null;
  return summary.value.temperatures.find(
    t => t.npuId === selectedChip.value!.npuId && t.chipId === selectedChip.value!.chipId
  );
});

const selectedPower = computed(() => {
  if (!selectedChip.value || !summary.value) return null;
  return summary.value.power.find(
    p => p.npuId === selectedChip.value!.npuId && p.chipId === selectedChip.value!.chipId
  );
});

const selectedMemory = computed(() => {
  if (!selectedChip.value || !summary.value) return null;
  return summary.value.memory.find(
    m => m.npuId === selectedChip.value!.npuId && m.chipId === selectedChip.value!.chipId
  );
});

const selectedUsage = computed(() => {
  if (!selectedChip.value || !summary.value) return null;
  return summary.value.usage.find(
    u => u.npuId === selectedChip.value!.npuId && u.chipId === selectedChip.value!.chipId
  );
});

const selectedEcc = computed(() => {
  if (!selectedChip.value || !summary.value) return null;
  return summary.value.ecc.find(
    e => e.npuId === selectedChip.value!.npuId && e.chipId === selectedChip.value!.chipId
  );
});

async function refreshNPU() {
  await monitorStore.fetchSummary(serverId.value);
}

async function refreshSystem() {
  await monitorStore.fetchSystemSummary(serverId.value);
}

async function refresh() {
  await Promise.all([
    refreshNPU(),
    refreshSystem()
  ]);
}

function toggleAutoRefresh() {
  monitorStore.setAutoRefresh(!autoRefreshEnabled.value);
  if (autoRefreshEnabled.value && isConnected.value) {
    monitorStore.startAutoRefresh(serverId.value);
    monitorStore.startSystemAutoRefresh(serverId.value);
  } else {
    monitorStore.stopAutoRefresh(serverId.value);
    monitorStore.stopSystemAutoRefresh(serverId.value);
  }
}

function setRefreshInterval(ms: number) {
  monitorStore.setRefreshInterval(ms);
}

onMounted(async () => {
  await serversStore.fetchServers();
  
  if (!isConnected.value) {
    try {
      await serversStore.connectServer(serverId.value);
    } catch (e) {
      console.error('Failed to connect:', e);
    }
  }
  
  if (isConnected.value) {
    if (!summary.value) {
      await refreshNPU();
    }
    if (!systemData.value) {
      await refreshSystem();
    }
    monitorStore.startAutoRefresh(serverId.value);
    monitorStore.startSystemAutoRefresh(serverId.value);
  }
});

onUnmounted(() => {
  monitorStore.stopAutoRefresh(serverId.value);
  monitorStore.stopSystemAutoRefresh(serverId.value);
});

watch(isConnected, (connected) => {
  if (connected) {
    if (!summary.value) {
      monitorStore.fetchSummary(serverId.value);
    }
    if (!systemData.value) {
      monitorStore.fetchSystemSummary(serverId.value);
    }
    monitorStore.startAutoRefresh(serverId.value);
    monitorStore.startSystemAutoRefresh(serverId.value);
  }
});

watch(serverId, async (newId, oldId) => {
  if (newId !== oldId && oldId) {
    monitorStore.stopAutoRefresh(oldId);
    monitorStore.stopSystemAutoRefresh(oldId);
    selectedChipIndex.value = 0;
    
    if (!serversStore.isConnected(newId)) {
      try {
        await serversStore.connectServer(newId);
      } catch (e) {
        console.error('Failed to connect:', e);
        return;
      }
    }
    
    if (isConnected.value) {
      if (!monitorStore.getSummary(newId)) {
        await monitorStore.fetchSummary(newId);
      }
      if (!monitorStore.getSystemSummary(newId)) {
        await monitorStore.fetchSystemSummary(newId);
      }
      monitorStore.startAutoRefresh(newId);
      monitorStore.startSystemAutoRefresh(newId);
    }
  }
});
</script>

<template>
  <div class="monitor-page">
    <header class="page-header">
      <div class="header-left">
        <button class="btn btn-secondary btn-icon back-btn" @click="router.back()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div class="server-info">
          <h1>{{ server?.name || 'Loading...' }}</h1>
          <p>
            <span class="status-dot" :class="isConnected ? 'online' : 'offline'"></span>
            {{ server?.host }}:{{ server?.port }}
          </p>
        </div>
      </div>
      <div class="header-actions">
        <div class="refresh-controls">
          <label class="toggle-label">
            <input type="checkbox" :checked="autoRefreshEnabled" @change="toggleAutoRefresh" />
            Auto Refresh ({{ refreshInterval / 1000 }}s)
          </label>
          <select 
            :value="refreshInterval" 
            @change="setRefreshInterval(Number(($event.target as HTMLSelectElement).value))"
            class="interval-select"
          >
            <option :value="10000">10s</option>
            <option :value="30000">30s</option>
            <option :value="60000">1m</option>
            <option :value="300000">5m</option>
          </select>
        </div>
        <button class="btn btn-primary" @click="refresh" :disabled="loading || systemLoading">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ 'spin': loading || systemLoading }">
            <path d="M23 4v6h-6M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          {{ (loading || systemLoading) ? 'Refreshing...' : 'Refresh' }}
        </button>
      </div>
    </header>

    <div class="tab-navigation">
      <button 
        class="tab-btn" 
        :class="{ active: activeTab === 'npu' }" 
        @click="activeTab = 'npu'"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
          <rect x="9" y="9" width="6" height="6" />
        </svg>
        NPU Monitor
      </button>
      <button 
        class="tab-btn" 
        :class="{ active: activeTab === 'system' }" 
        @click="activeTab = 'system'"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        System Monitor
      </button>
      <button 
        class="tab-btn" 
        :class="{ active: activeTab === 'terminal' }" 
        @click="activeTab = 'terminal'"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="4 17 10 11 4 5"></polyline>
          <line x1="12" y1="19" x2="20" y2="19"></line>
        </svg>
        Terminal
      </button>
    </div>

    <template v-if="activeTab === 'npu'">
      <div v-if="!isConnected" class="disconnected-state">
        <p>Not connected to server</p>
        <button class="btn btn-primary" @click="serversStore.connectServer(serverId)">Connect</button>
      </div>

      <div v-else-if="loading && !summary" class="loading-state">
        <p>Loading NPU data...</p>
      </div>

      <div v-else-if="error" class="error-state">
        <p>{{ error }}</p>
        <button class="btn btn-primary" @click="refreshNPU">Retry</button>
      </div>

      <div v-else-if="summary" class="npu-content">
        <section class="chips-section">
          <div class="chip-selector">
            <label class="form-label">Select Chip</label>
            <div class="chip-tabs">
              <button
                v-for="(chip, index) in summary.chips"
                :key="`${chip.npuId}-${chip.chipId}`"
                class="chip-tab"
                :class="{ active: selectedChipIndex === index }"
                @click="selectedChipIndex = index"
              >
                NPU {{ chip.npuId }} / Chip {{ chip.chipId }}
                <span class="status-dot" :class="chip.health === 'OK' ? 'online' : 'warning'"></span>
              </button>
            </div>
          </div>
        </section>

        <section class="metrics-grid">
          <MetricCard
            title="Temperature"
            :value="selectedTemp?.npuTemp || 0"
            unit="C"
            :max="100"
            :warning="70"
            :danger="85"
            icon="thermometer"
          />
          <MetricCard
            title="Power Usage"
            :value="selectedPower?.powerUsage || 0"
            unit="W"
            :max="selectedPower?.powerLimit || 400"
            :warning="300"
            :danger="350"
            icon="zap"
          />
          <MetricCard
            title="HBM Usage Rate"
            :value="selectedMemory?.hbmUsageRate || 0"
            unit="%"
            :max="100"
            :warning="70"
            :danger="90"
            icon="memory"
          />
          <MetricCard
            title="AI Core Usage"
            :value="selectedUsage?.aiCoreUsage || 0"
            unit="%"
            :max="100"
            :warning="80"
            :danger="95"
            icon="cpu"
          />
          <MetricCard
            title="ECC Errors"
            :value="selectedEcc?.eccErrorCount || 0"
            unit=""
            :max="10"
            :warning="1"
            :danger="5"
            icon="alert"
          />
          <MetricCard
            title="Bandwidth"
            :value="selectedUsage?.bandwidthUsage || 0"
            unit="%"
            :max="100"
            :warning="70"
            :danger="90"
            icon="activity"
          />
        </section>

        <section class="tables-section">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">All Chips</h3>
            </div>
            <ChipTable :chips="summary.chips" :temperatures="summary.temperatures" :power="summary.power" />
          </div>

          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Running Processes</h3>
            </div>
            <ProcessList :processes="summary.processes" />
          </div>
        </section>

        <footer class="last-updated">
          Last updated: {{ new Date(summary.lastUpdated).toLocaleString() }}
        </footer>
      </div>

      <div v-else class="empty-state">
        <p>No NPU data available</p>
        <button class="btn btn-primary" @click="refreshNPU">Refresh</button>
      </div>
    </template>

    <template v-if="activeTab === 'system'">
      <SystemMonitor 
        :data="systemData" 
        :loading="systemLoading" 
        :error="systemError"
      />
    </template>

    <div v-show="activeTab === 'terminal'" class="terminal-content">
      <div class="terminal-tabs-inner">
        <button 
          class="inner-tab-btn" 
          :class="{ active: terminalSubTab === 'shell' }" 
          @click="terminalSubTab = 'shell'"
        >
          Shell
        </button>
        <button 
          class="inner-tab-btn" 
          :class="{ active: terminalSubTab === 'files' }" 
          @click="terminalSubTab = 'files'"
        >
          Files
        </button>
      </div>
      <div class="terminal-panels">
        <template v-for="visitedId in terminalStateStore.getVisitedServers()" :key="visitedId">
          <TerminalPanel 
            v-show="terminalSubTab === 'shell' && serverId === visitedId"
            :server-id="visitedId" 
            :is-connected="serversStore.isConnected(visitedId)"
            :visible="activeTab === 'terminal' && terminalSubTab === 'shell' && serverId === visitedId"
          />
        </template>
        <FilesPanel 
          v-show="terminalSubTab === 'files'" 
          :server-id="serverId" 
          :is-connected="isConnected"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.monitor-page {
  padding: var(--spacing-lg);
  max-width: 1600px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 120px);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-lg);
  gap: var(--spacing-md);
}

.header-left {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
}

.back-btn {
  padding: var(--spacing-sm);
}

.server-info h1 {
  font-size: 24px;
  font-weight: 700;
  color: var(--header-primary);
  margin: 0;
}

.server-info p {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  color: var(--text-muted);
  margin: var(--spacing-xs) 0 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.refresh-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: 14px;
  color: var(--text-muted);
  cursor: pointer;
}

.interval-select {
  padding: 4px 8px;
  font-size: 12px;
  background-color: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: var(--radius-sm);
  color: var(--text-normal);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.tab-navigation {
  display: flex;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--card-border);
  padding-bottom: var(--spacing-sm);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  margin-bottom: -9px;
}

.tab-btn:hover {
  color: var(--text-normal);
}

.tab-btn.active {
  color: var(--brand-experiment);
  border-bottom-color: var(--brand-experiment);
}

.npu-content {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.chips-section {
  margin-bottom: var(--spacing-lg);
}

.chip-tabs {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.chip-tab {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--bg-secondary);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
  color: var(--text-normal);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.chip-tab:hover {
  background-color: var(--bg-modifier-hover);
}

.chip-tab.active {
  background-color: var(--brand-experiment);
  border-color: var(--brand-experiment);
  color: white;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.tables-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.last-updated {
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
  margin-top: var(--spacing-md);
}

.disconnected-state,
.error-state,
.loading-state,
.empty-state {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--text-muted);
}

.error-state {
  color: var(--red);
}

.error-state button {
  margin-top: var(--spacing-md);
}

.terminal-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 500px;
  background-color: var(--bg-secondary);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.terminal-tabs-inner {
  display: flex;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
  background-color: var(--bg-tertiary);
  border-bottom: 1px solid var(--card-border);
}

.inner-tab-btn {
  padding: var(--spacing-xs) var(--spacing-md);
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.inner-tab-btn:hover {
  color: var(--text-normal);
  background-color: var(--bg-modifier-hover);
}

.inner-tab-btn.active {
  color: white;
  background-color: var(--brand-experiment);
}

.terminal-panels {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.terminal-panels > * {
  flex: 1;
}
</style>
