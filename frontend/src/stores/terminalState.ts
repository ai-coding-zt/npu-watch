import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useTerminalStateStore = defineStore('terminalState', () => {
  const visitedServers = ref<Set<string>>(new Set());

  function markVisited(serverId: string) {
    visitedServers.value.add(serverId);
  }

  function getVisitedServers(): string[] {
    return Array.from(visitedServers.value);
  }

  function clearVisited(serverId: string) {
    visitedServers.value.delete(serverId);
  }

  function clearAll() {
    visitedServers.value.clear();
  }

  return {
    visitedServers,
    markVisited,
    getVisitedServers,
    clearVisited,
    clearAll,
  };
});
