<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  title: string;
  value: number;
  unit: string;
  max: number;
  warning: number;
  danger: number;
  icon?: string;
}>();

const percentage = computed(() => {
  if (props.max === 0) return 0;
  return Math.min(100, (props.value / props.max) * 100);
});

const statusColor = computed(() => {
  if (props.value >= props.danger) return 'red';
  if (props.value >= props.warning) return 'yellow';
  return 'green';
});

const displayValue = computed(() => {
  return props.unit === '%' ? Math.round(props.value) : props.value;
});
</script>

<template>
  <div class="metric-card">
    <div class="metric-header">
      <div class="metric-icon">
        <svg v-if="icon === 'thermometer'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
        </svg>
        <svg v-else-if="icon === 'zap'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
        <svg v-else-if="icon === 'memory'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <line x1="6" y1="6" x2="6" y2="2" />
          <line x1="12" y1="6" x2="12" y2="2" />
          <line x1="18" y1="6" x2="18" y2="2" />
        </svg>
        <svg v-else-if="icon === 'cpu'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
          <rect x="9" y="9" width="6" height="6" />
          <line x1="9" y1="1" x2="9" y2="4" />
          <line x1="15" y1="1" x2="15" y2="4" />
          <line x1="9" y1="20" x2="9" y2="23" />
          <line x1="15" y1="20" x2="15" y2="23" />
          <line x1="20" y1="9" x2="23" y2="9" />
          <line x1="20" y1="14" x2="23" y2="14" />
          <line x1="1" y1="9" x2="4" y2="9" />
          <line x1="1" y1="14" x2="4" y2="14" />
        </svg>
        <svg v-else-if="icon === 'alert'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <svg v-else-if="icon === 'activity'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <span class="metric-title">{{ title }}</span>
    </div>
    <div class="metric-value">
      <span class="value">{{ displayValue }}</span>
      <span class="unit">{{ unit }}</span>
    </div>
    <div class="progress-bar">
      <div
        class="progress-bar-fill"
        :class="statusColor"
        :style="{ width: `${percentage}%` }"
      ></div>
    </div>
  </div>
</template>

<style scoped>
.metric-card {
  background-color: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
}

.metric-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.metric-icon {
  color: var(--text-muted);
}

.metric-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-muted);
}

.metric-value {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-sm);
}

.value {
  font-size: 28px;
  font-weight: 700;
  color: var(--header-primary);
}

.unit {
  font-size: 14px;
  color: var(--text-muted);
}
</style>
