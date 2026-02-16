<script setup lang="ts">
import { computed } from 'vue';
import type { NPUProcess } from '@/types';

const props = defineProps<{
  processes: NPUProcess[];
}>();

const groupedProcesses = computed(() => {
  const groups = new Map<number, NPUProcess[]>();
  
  for (const proc of props.processes) {
    const npuId = proc.npuId >= 0 ? proc.npuId : -1;
    if (!groups.has(npuId)) {
      groups.set(npuId, []);
    }
    groups.get(npuId)!.push(proc);
  }
  
  return Array.from(groups.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([npuId, procs]) => ({
      npuId,
      processes: procs
    }));
});
</script>

<template>
  <div class="process-list-wrapper">
    <div v-if="processes.length > 0" class="process-groups">
      <div v-for="group in groupedProcesses" :key="group.npuId" class="process-group">
        <div class="group-header">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
            <rect x="9" y="9" width="6" height="6" />
          </svg>
          <span>NPU {{ group.npuId >= 0 ? group.npuId : 'Unknown' }}</span>
          <span class="process-count">{{ group.processes.length }} process(es)</span>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>PID</th>
              <th>Process Name</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="proc in group.processes" :key="proc.pid">
              <td><code>{{ proc.pid }}</code></td>
              <td>{{ proc.processName }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div v-else class="empty-message">
      No running processes or feature not supported on this platform
    </div>
  </div>
</template>

<style scoped>
.process-list-wrapper {
  overflow-x: auto;
}

.process-groups {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.process-group {
  background-color: var(--bg-secondary);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.group-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--bg-tertiary);
  border-bottom: 1px solid var(--card-border);
  font-weight: 600;
  color: var(--header-primary);
}

.process-count {
  margin-left: auto;
  font-size: 12px;
  font-weight: 400;
  color: var(--text-muted);
}

.empty-message {
  text-align: center;
  padding: var(--spacing-lg);
  color: var(--text-muted);
}
</style>
