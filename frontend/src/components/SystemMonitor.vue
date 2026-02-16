<script setup lang="ts">
import { computed, ref } from 'vue';
import type { SystemSummary } from '@/types';

const props = defineProps<{
  data: SystemSummary | null;
  loading?: boolean;
  error?: string | null;
}>();

const lastUpdatedDisplay = computed(() => {
  if (!props.data?.lastUpdated) return null;
  return new Date(props.data.lastUpdated).toLocaleString();
});

const memoryPercent = computed(() => props.data?.memory?.usagePercent ?? 0);
const memoryTotal = computed(() => {
  const mb = props.data?.memory?.total ?? 0;
  return mb > 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
});
const memoryUsed = computed(() => {
  const mb = props.data?.memory?.used ?? 0;
  return mb > 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
});

const expandedPorts = ref(false);
const portFilter = ref('');
const portProcessFilter = ref('');

const filteredPorts = computed(() => {
  if (!props.data?.ports) return [];
  let ports = props.data.ports;
  
  if (portFilter.value) {
    ports = ports.filter(p => p.port.toString().includes(portFilter.value));
  }
  if (portProcessFilter.value) {
    ports = ports.filter(p => 
      p.process.toLowerCase().includes(portProcessFilter.value.toLowerCase())
    );
  }
  
  return expandedPorts.value ? ports : ports.slice(0, 10);
});

const totalPortsCount = computed(() => props.data?.ports?.length ?? 0);

const expandedContainers = ref(false);
const containerStateFilter = ref<'all' | 'running' | 'stopped'>('all');
const containerNameFilter = ref('');
const containerTimeFilter = ref<'all' | 'today' | 'week' | 'month'>('all');

const filteredContainers = computed(() => {
  if (!props.data?.containers) return [];
  let containers = [...props.data.containers];
  
  if (containerStateFilter.value !== 'all') {
    containers = containers.filter(c => c.state === containerStateFilter.value);
  }
  
  if (containerNameFilter.value) {
    containers = containers.filter(c => 
      c.name.toLowerCase().includes(containerNameFilter.value.toLowerCase())
    );
  }
  
  if (containerTimeFilter.value !== 'all') {
    const day = 24 * 60 * 60 * 1000;
    const thresholds: Record<string, number> = {
      today: day,
      week: 7 * day,
      month: 30 * day
    };
    containers = containers.filter(c => {
      if (c.state === 'running') return true;
      const match = c.status.match(/(\d+)\s+(second|minute|hour|day|week|month)s?\s+ago/);
      if (!match) return false;
      const num = parseInt(match[1]);
      const unit = match[2];
      const mult: Record<string, number> = { second: 1, minute: 60, hour: 3600, day: 86400, week: 604800, month: 2592000 };
      const multiplier = mult[unit] || 86400;
      return num * multiplier * 1000 <= thresholds[containerTimeFilter.value];
    });
  }
  
  return expandedContainers.value ? containers : containers.slice(0, 5);
});

const totalContainersCount = computed(() => {
  if (!props.data?.containers) return 0;
  let count = props.data.containers.length;
  if (containerStateFilter.value !== 'all') {
    count = props.data.containers.filter(c => c.state === containerStateFilter.value).length;
  }
  if (containerNameFilter.value) {
    count = props.data.containers.filter(c => 
      c.name.toLowerCase().includes(containerNameFilter.value.toLowerCase())
    ).length;
  }
  return count;
});

function getProgressColor(percent: number): string {
  if (percent >= 90) return 'red';
  if (percent >= 70) return 'yellow';
  return 'green';
}

function clearPortFilters() {
  portFilter.value = '';
  portProcessFilter.value = '';
}

function clearContainerFilters() {
  containerStateFilter.value = 'all';
  containerNameFilter.value = '';
  containerTimeFilter.value = 'all';
}
</script>

<template>
  <div class="system-monitor">
    <div v-if="!data && loading" class="loading">Loading system data...</div>
    <div v-else-if="!data" class="empty">No system data available. Data is being refreshed in the background...</div>
    <template v-else>
      <div v-if="error" class="stale-warning">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span>
          <template v-if="loading">Refreshing data... (last updated: {{ lastUpdatedDisplay }})</template>
          <template v-else>Failed to refresh: {{ error }}. Showing last known data.</template>
        </span>
      </div>
      
      <div v-if="lastUpdatedDisplay" class="last-updated-header">
        Last updated: {{ lastUpdatedDisplay }}
        <span v-if="loading" class="refreshing-indicator">(refreshing...)</span>
      </div>
      
      <section class="section">
        <h3 class="section-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <line x1="6" y1="6" x2="6" y2="2" />
            <line x1="12" y1="6" x2="12" y2="2" />
            <line x1="18" y1="6" x2="18" y2="2" />
          </svg>
          Memory Usage
        </h3>
        <div class="memory-info">
          <div class="memory-bar">
            <div 
              class="memory-fill" 
              :class="getProgressColor(memoryPercent)"
              :style="{ width: `${memoryPercent}%` }"
            ></div>
          </div>
          <div class="memory-stats">
            <span class="stat">
              <span class="label">Used:</span>
              <span class="value">{{ memoryUsed }}</span>
            </span>
            <span class="stat">
              <span class="label">Total:</span>
              <span class="value">{{ memoryTotal }}</span>
            </span>
            <span class="stat">
              <span class="label">Usage:</span>
              <span class="value" :class="{ 'text-warning': memoryPercent >= 70, 'text-danger': memoryPercent >= 90 }">
                {{ memoryPercent }}%
              </span>
            </span>
          </div>
        </div>
      </section>

      <section class="section">
        <h3 class="section-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </svg>
          Storage
        </h3>
        <div class="storage-list">
          <div v-for="disk in data.storage" :key="disk.mountPoint" class="storage-item">
            <div class="storage-header">
              <span class="mount-point">{{ disk.mountPoint }}</span>
              <span class="usage" :class="{ 'text-warning': disk.usagePercent >= 70, 'text-danger': disk.usagePercent >= 90 }">
                {{ disk.usagePercent }}%
              </span>
            </div>
            <div class="storage-bar">
              <div 
                class="storage-fill" 
                :class="getProgressColor(disk.usagePercent)"
                :style="{ width: `${disk.usagePercent}%` }"
              ></div>
            </div>
            <div class="storage-details">
              <span>{{ disk.used }} / {{ disk.size }}</span>
              <span class="available">Available: {{ disk.available }}</span>
            </div>
          </div>
          <div v-if="data.storage.length === 0" class="empty-message">No storage data</div>
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <h3 class="section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            Network Ports ({{ totalPortsCount }})
          </h3>
          <button v-if="totalPortsCount > 10" class="expand-btn" @click="expandedPorts = !expandedPorts">
            {{ expandedPorts ? 'Show Less' : `Show All (${totalPortsCount})` }}
          </button>
        </div>
        <div class="filter-row">
          <input 
            v-model="portFilter" 
            type="text" 
            class="filter-input" 
            placeholder="Filter by port..."
          />
          <input 
            v-model="portProcessFilter" 
            type="text" 
            class="filter-input" 
            placeholder="Filter by process..."
          />
          <button v-if="portFilter || portProcessFilter" class="btn-clear" @click="clearPortFilters">Clear</button>
        </div>
        <div class="ports-table-wrapper">
          <table v-if="filteredPorts.length > 0" class="table compact">
            <thead>
              <tr>
                <th>Proto</th>
                <th>Address</th>
                <th>Port</th>
                <th>Process</th>
                <th>PID</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(port, index) in filteredPorts" :key="index">
                <td><span class="badge badge-info">{{ port.protocol }}</span></td>
                <td><code>{{ port.localAddress }}</code></td>
                <td>{{ port.port }}</td>
                <td>{{ port.process }}</td>
                <td>{{ port.pid || '-' }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="empty-message">No ports match filters</div>
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <h3 class="section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 12H2" />
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
              <line x1="6" y1="16" x2="6.01" y2="16" />
              <line x1="10" y1="16" x2="10.01" y2="16" />
            </svg>
            Containers ({{ totalContainersCount }})
          </h3>
          <button v-if="totalContainersCount > 5" class="expand-btn" @click="expandedContainers = !expandedContainers">
            {{ expandedContainers ? 'Show Less' : `Show All (${totalContainersCount})` }}
          </button>
        </div>
        <div class="filter-row">
          <select v-model="containerStateFilter" class="filter-select">
            <option value="all">All States</option>
            <option value="running">Running</option>
            <option value="stopped">Stopped</option>
          </select>
          <select v-model="containerTimeFilter" class="filter-select">
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
          <input 
            v-model="containerNameFilter" 
            type="text" 
            class="filter-input" 
            placeholder="Filter by name..."
          />
          <button v-if="containerStateFilter !== 'all' || containerNameFilter || containerTimeFilter !== 'all'" 
                  class="btn-clear" @click="clearContainerFilters">Clear</button>
        </div>
        <div class="containers-list">
          <div v-if="filteredContainers.length > 0">
            <div v-for="container in filteredContainers" :key="container.id" class="container-item">
              <div class="container-header">
                <span class="container-name">{{ container.name }}</span>
                <span class="badge" :class="container.state === 'running' ? 'badge-success' : 'badge-danger'">
                  {{ container.state }}
                </span>
              </div>
              <div class="container-details">
                <span class="detail"><strong>Image:</strong> {{ container.image }}</span>
                <span class="detail"><strong>Status:</strong> {{ container.status }}</span>
                <span v-if="container.ports" class="detail"><strong>Ports:</strong> {{ container.ports }}</span>
              </div>
            </div>
          </div>
          <div v-else class="empty-message">No containers match filters</div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.system-monitor {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.loading,
.empty,
.empty-message {
  text-align: center;
  padding: var(--spacing-lg);
  color: var(--text-muted);
}

.stale-warning {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: rgba(240, 177, 50, 0.15);
  border: 1px solid var(--yellow);
  border-radius: var(--radius-md);
  color: var(--yellow);
  font-size: 13px;
  margin-bottom: var(--spacing-md);
}

.stale-warning svg {
  flex-shrink: 0;
}

.last-updated-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  background-color: var(--bg-secondary);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: var(--spacing-md);
}

.refreshing-indicator {
  color: var(--info);
}

.section {
  background-color: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: 14px;
  font-weight: 600;
  color: var(--header-primary);
  margin: 0 0 var(--spacing-md);
  text-transform: uppercase;
}

.section-header .section-title {
  margin-bottom: 0;
}

.expand-btn {
  padding: 4px 8px;
  font-size: 12px;
  background-color: var(--bg-modifier-hover);
  border-radius: var(--radius-sm);
  color: var(--text-link);
  cursor: pointer;
}

.expand-btn:hover {
  background-color: var(--bg-modifier-active);
}

.filter-row {
  display: flex;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
  flex-wrap: wrap;
}

.filter-input {
  flex: 1;
  min-width: 120px;
  padding: 4px 8px;
  font-size: 12px;
  background-color: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: var(--radius-sm);
  color: var(--text-normal);
}

.filter-select {
  padding: 4px 8px;
  font-size: 12px;
  background-color: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: var(--radius-sm);
  color: var(--text-normal);
}

.btn-clear {
  padding: 4px 8px;
  font-size: 12px;
  background-color: var(--bg-modifier-hover);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
}

.btn-clear:hover {
  background-color: var(--bg-modifier-active);
}

.memory-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.memory-bar,
.storage-bar {
  height: 8px;
  background-color: var(--bg-modifier-hover);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.memory-fill,
.storage-fill {
  height: 100%;
  transition: width var(--transition-normal);
}

.memory-fill.green,
.storage-fill.green {
  background-color: var(--green);
}

.memory-fill.yellow,
.storage-fill.yellow {
  background-color: var(--yellow);
}

.memory-fill.red,
.storage-fill.red {
  background-color: var(--red);
}

.memory-stats {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.stat .label {
  color: var(--text-muted);
  margin-right: var(--spacing-xs);
}

.stat .value {
  color: var(--text-normal);
  font-weight: 500;
}

.text-warning {
  color: var(--yellow);
}

.text-danger {
  color: var(--red);
}

.storage-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.storage-item {
  padding: var(--spacing-sm);
  background-color: var(--bg-secondary);
  border-radius: var(--radius-sm);
}

.storage-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--spacing-xs);
}

.mount-point {
  font-weight: 500;
  color: var(--header-primary);
}

.storage-details {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-muted);
  margin-top: var(--spacing-xs);
}

.ports-table-wrapper {
  overflow-x: auto;
}

.table.compact th,
.table.compact td {
  padding: 4px 8px;
  font-size: 12px;
}

.containers-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.container-item {
  padding: var(--spacing-sm);
  background-color: var(--bg-secondary);
  border-radius: var(--radius-sm);
}

.container-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-xs);
}

.container-name {
  font-weight: 500;
  color: var(--header-primary);
}

.container-details {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  font-size: 12px;
  color: var(--text-muted);
}

.container-details .detail strong {
  color: var(--text-normal);
}
</style>
