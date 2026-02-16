<script setup lang="ts">
import type { NPUChip, NPUTemperature, NPUPower } from '@/types';

defineProps<{
  chips: NPUChip[];
  temperatures: NPUTemperature[];
  power: NPUPower[];
}>();

function getTemp(temps: NPUTemperature[], npuId: number, chipId: number): number | string {
  const temp = temps.find(t => t.npuId === npuId && t.chipId === chipId);
  return temp?.npuTemp ?? '-';
}

function getPower(powers: NPUPower[], npuId: number, chipId: number): number | string {
  const pwr = powers.find(p => p.npuId === npuId && p.chipId === chipId);
  return pwr?.powerUsage ?? '-';
}

function getHealthClass(health: string): string {
  switch (health.toLowerCase()) {
    case 'ok': return 'badge-success';
    case 'warning': return 'badge-warning';
    case 'error': return 'badge-danger';
    default: return 'badge-info';
  }
}
</script>

<template>
  <div class="chip-table-wrapper">
    <table v-if="chips.length > 0" class="table">
      <thead>
        <tr>
          <th>NPU ID</th>
          <th>Chip ID</th>
          <th>Name</th>
          <th>Health</th>
          <th>Temp</th>
          <th>Power</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="chip in chips" :key="`${chip.npuId}-${chip.chipId}`">
          <td>{{ chip.npuId }}</td>
          <td>{{ chip.chipId }}</td>
          <td>{{ chip.name }}</td>
          <td>
            <span class="badge" :class="getHealthClass(chip.health)">
              {{ chip.health }}
            </span>
          </td>
          <td>{{ getTemp(temperatures, chip.npuId, chip.chipId) }}°C</td>
          <td>{{ getPower(power, chip.npuId, chip.chipId) }}W</td>
        </tr>
      </tbody>
    </table>
    <div v-else class="empty-message">No chip data available</div>
  </div>
</template>

<style scoped>
.chip-table-wrapper {
  overflow-x: auto;
}

.empty-message {
  text-align: center;
  padding: var(--spacing-lg);
  color: var(--text-muted);
}
</style>
