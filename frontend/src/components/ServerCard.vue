<script setup lang="ts">
import type { ServerConfig } from '@/types';

defineProps<{
  server: ServerConfig;
  connected: boolean;
  npuUsage?: { used: number; total: number } | null;
}>();

defineEmits<{
  (e: 'click'): void;
}>();
</script>

<template>
  <div class="server-card" @click="$emit('click')">
    <div class="card-header">
      <div class="server-status">
        <span class="status-dot" :class="connected ? 'online' : 'offline'"></span>
      </div>
      <h3 class="server-name">{{ server.name }}</h3>
      <span class="badge" :class="connected ? 'badge-success' : 'badge-danger'">
        {{ connected ? 'Connected' : 'Disconnected' }}
      </span>
    </div>
    <div class="card-body">
      <div class="info-row">
        <span class="info-label">Host</span>
        <span class="info-value"><code>{{ server.host }}</code></span>
      </div>
      <div class="info-row">
        <span class="info-label">Port</span>
        <span class="info-value">{{ server.port }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Username</span>
        <span class="info-value">{{ server.username }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Auth</span>
        <span class="info-value">
          <span class="badge badge-info">{{ server.authType }}</span>
        </span>
      </div>
      <div v-if="connected && npuUsage" class="info-row npu-usage-row">
        <span class="info-label">NPU Usage</span>
        <span class="info-value npu-usage">
          <span class="npu-usage-value">{{ npuUsage.used }}/{{ npuUsage.total }}</span>
          <span class="npu-usage-bar">
            <span class="npu-usage-fill" :style="{ width: `${(npuUsage.used / npuUsage.total) * 100}%` }"></span>
          </span>
        </span>
      </div>
    </div>
    <div class="card-footer">
      <button class="btn btn-primary btn-sm" @click.stop="$emit('click')">
        {{ connected ? 'View Monitor' : 'Connect & Monitor' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.server-card {
  background-color: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.server-card:hover {
  border-color: var(--brand-experiment);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.card-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--card-border);
}

.server-status {
  flex-shrink: 0;
}

.server-name {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  color: var(--header-primary);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-body {
  padding: var(--spacing-md);
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-xs) 0;
}

.info-label {
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
}

.info-value {
  font-size: 14px;
  color: var(--text-normal);
}

.info-value code {
  font-size: 13px;
}

.card-footer {
  padding: var(--spacing-md);
  border-top: 1px solid var(--card-border);
}

.btn-sm {
  width: 100%;
  padding: var(--spacing-sm);
}

.npu-usage-row {
  margin-top: var(--spacing-sm);
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--card-border);
}

.npu-usage {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.npu-usage-value {
  font-weight: 600;
  color: var(--brand-experiment);
}

.npu-usage-bar {
  flex: 1;
  height: 6px;
  background-color: var(--bg-tertiary);
  border-radius: 3px;
  overflow: hidden;
  min-width: 60px;
}

.npu-usage-fill {
  display: block;
  height: 100%;
  background-color: var(--brand-experiment);
  border-radius: 3px;
  transition: width 0.3s ease;
}
</style>
