<script setup lang="ts">
import { computed } from 'vue';

interface DataPoint {
  timestamp: number;
  value: number;
}

const props = defineProps<{
  data: DataPoint[];
  label: string;
  unit: string;
  color?: string;
  min?: number;
  max?: number;
}>();

const chartColor = props.color || '#5865F2';
const padding = { top: 20, right: 20, bottom: 30, left: 50 };
const width = 400;
const height = 150;

const chartWidth = computed(() => width - padding.left - padding.right);
const chartHeight = computed(() => height - padding.top - padding.bottom);

const dataMin = computed(() => props.min ?? Math.min(...props.data.map(d => d.value)));
const dataMax = computed(() => props.max ?? Math.max(...props.data.map(d => d.value)));
const valueRange = computed(() => Math.max(dataMax.value - dataMin.value, 1));

const points = computed(() => {
  if (props.data.length === 0) return '';
  
  const xStep = chartWidth.value / Math.max(props.data.length - 1, 1);
  
  return props.data.map((d, i) => {
    const x = padding.left + i * xStep;
    const y = padding.top + chartHeight.value - ((d.value - dataMin.value) / valueRange.value) * chartHeight.value;
    return `${x},${y}`;
  }).join(' ');
});

const areaPath = computed(() => {
  if (props.data.length === 0) return '';
  
  const xStep = chartWidth.value / Math.max(props.data.length - 1, 1);
  const points = props.data.map((d, i) => {
    const x = padding.left + i * xStep;
    const y = padding.top + chartHeight.value - ((d.value - dataMin.value) / valueRange.value) * chartHeight.value;
    return `${x},${y}`;
  });
  
  const firstX = padding.left;
  const lastX = padding.left + (props.data.length - 1) * xStep;
  const bottomY = padding.top + chartHeight.value;
  
  return `M ${firstX},${bottomY} L ${points.join(' L ')} L ${lastX},${bottomY} Z`;
});

const yTicks = computed(() => {
  const ticks = [];
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const value = dataMin.value + (valueRange.value * i) / steps;
    ticks.push({
      value: Math.round(value * 10) / 10,
      y: padding.top + chartHeight.value - (i / steps) * chartHeight.value
    });
  }
  return ticks;
});

const lastValue = computed(() => {
  if (props.data.length === 0) return null;
  return props.data[props.data.length - 1].value;
});

const avgValue = computed(() => {
  if (props.data.length === 0) return null;
  const sum = props.data.reduce((acc, d) => acc + d.value, 0);
  return Math.round((sum / props.data.length) * 10) / 10;
});
</script>

<template>
  <div class="line-chart">
    <div class="chart-header">
      <span class="chart-label">{{ label }}</span>
      <div v-if="lastValue !== null" class="chart-stats">
        <span class="current-value">{{ lastValue }}{{ unit }}</span>
        <span v-if="avgValue !== null" class="avg-value">avg: {{ avgValue }}{{ unit }}</span>
      </div>
    </div>
    <svg :viewBox="`0 0 ${width} ${height}`" class="chart-svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient :id="`gradient-${label}`" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="chartColor" stop-opacity="0.3"/>
          <stop offset="100%" :stop-color="chartColor" stop-opacity="0.05"/>
        </linearGradient>
      </defs>
      
      <g class="y-axis">
        <line 
          v-for="tick in yTicks" 
          :key="tick.value"
          :x1="padding.left"
          :y1="tick.y"
          :x2="width - padding.right"
          :y2="tick.y"
          class="grid-line"
        />
        <text 
          v-for="tick in yTicks" 
          :key="`label-${tick.value}`"
          :x="padding.left - 5"
          :y="tick.y + 4"
          class="tick-label"
        >
          {{ tick.value }}
        </text>
      </g>
      
      <path v-if="areaPath" :d="areaPath" :fill="`url(#gradient-${label})`" />
      <polyline v-if="points" :points="points" class="data-line" :stroke="chartColor" />
    </svg>
    <div v-if="data.length === 0" class="no-data">No history data</div>
  </div>
</template>

<style scoped>
.line-chart {
  background-color: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-sm);
}

.chart-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--header-primary);
}

.chart-stats {
  display: flex;
  gap: var(--spacing-sm);
  font-size: 12px;
}

.current-value {
  font-weight: 600;
  color: var(--text-normal);
}

.avg-value {
  color: var(--text-muted);
}

.chart-svg {
  width: 100%;
  height: auto;
  display: block;
}

.grid-line {
  stroke: var(--card-border);
  stroke-width: 1;
}

.tick-label {
  font-size: 10px;
  fill: var(--text-muted);
  text-anchor: end;
}

.data-line {
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.no-data {
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
  padding: var(--spacing-lg);
}
</style>
