import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { NPUSummary, SystemSummary } from '@/types';
import { monitorApi } from '@/api';
import { DEFAULT_REFRESH_INTERVAL_MS } from '@/constants';

function formatErrorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

export const useMonitorStore = defineStore('monitor', () => {
  const summaries = ref<Map<string, NPUSummary>>(new Map());
  const loading = ref<Map<string, boolean>>(new Map());
  const errors = ref<Map<string, string>>(new Map());
  
  const systemSummaries = ref<Map<string, SystemSummary>>(new Map());
  const systemLoading = ref<Map<string, boolean>>(new Map());
  const systemErrors = ref<Map<string, string>>(new Map());
  
  const autoRefreshEnabled = ref(true);
  const refreshInterval = ref(DEFAULT_REFRESH_INTERVAL_MS);
  const refreshTimers = ref<Map<string, number>>(new Map());
  const systemRefreshTimers = ref<Map<string, number>>(new Map());

  async function fetchSummary(serverId: string) {
    loading.value.set(serverId, true);
    errors.value.delete(serverId);
    
    try {
      const response = await monitorApi.getSummary(serverId);
      if (response.data.success && response.data.data) {
        summaries.value.set(serverId, response.data.data);
      } else {
        errors.value.set(serverId, response.data.error || 'Failed to fetch data');
      }
    } catch (e) {
      errors.value.set(serverId, formatErrorMessage(e, 'Unknown error'));
    } finally {
      loading.value.set(serverId, false);
    }
  }

  async function fetchSystemSummary(serverId: string) {
    systemLoading.value.set(serverId, true);
    systemErrors.value.delete(serverId);
    
    try {
      const response = await monitorApi.getSystem(serverId);
      if (response.data.success && response.data.data) {
        systemSummaries.value.set(serverId, response.data.data);
      } else {
        systemErrors.value.set(serverId, response.data.error || 'Failed to fetch system data');
      }
    } catch (e) {
      systemErrors.value.set(serverId, formatErrorMessage(e, 'Unknown error'));
    } finally {
      systemLoading.value.set(serverId, false);
    }
  }

  async function fetchAndSchedule(serverId: string) {
    if (!autoRefreshEnabled.value) return;
    
    await fetchSummary(serverId);
    
    if (autoRefreshEnabled.value) {
      const timer = window.setTimeout(() => {
        fetchAndSchedule(serverId);
      }, refreshInterval.value);
      refreshTimers.value.set(serverId, timer);
    }
  }

  async function fetchSystemAndSchedule(serverId: string) {
    if (!autoRefreshEnabled.value) return;
    
    await fetchSystemSummary(serverId);
    
    if (autoRefreshEnabled.value) {
      const timer = window.setTimeout(() => {
        fetchSystemAndSchedule(serverId);
      }, refreshInterval.value);
      systemRefreshTimers.value.set(serverId, timer);
    }
  }

  function startAutoRefresh(serverId: string) {
    stopAutoRefresh(serverId);
    if (autoRefreshEnabled.value) {
      fetchAndSchedule(serverId);
    }
  }

  function startSystemAutoRefresh(serverId: string) {
    stopSystemAutoRefresh(serverId);
    if (autoRefreshEnabled.value) {
      fetchSystemAndSchedule(serverId);
    }
  }

  function stopAutoRefresh(serverId: string) {
    const timer = refreshTimers.value.get(serverId);
    if (timer) {
      clearTimeout(timer);
      refreshTimers.value.delete(serverId);
    }
  }

  function stopSystemAutoRefresh(serverId: string) {
    const timer = systemRefreshTimers.value.get(serverId);
    if (timer) {
      clearTimeout(timer);
      systemRefreshTimers.value.delete(serverId);
    }
  }

  function stopAllAutoRefresh() {
    refreshTimers.value.forEach((timer) => clearTimeout(timer));
    refreshTimers.value.clear();
    systemRefreshTimers.value.forEach((timer) => clearTimeout(timer));
    systemRefreshTimers.value.clear();
  }

  async function startBackgroundRefreshForServers(serverIds: string[]) {
    for (const serverId of serverIds) {
      if (!summaries.value.has(serverId)) {
        await fetchSummary(serverId);
      }
      if (!systemSummaries.value.has(serverId)) {
        await fetchSystemSummary(serverId);
      }
      startAutoRefresh(serverId);
      startSystemAutoRefresh(serverId);
    }
  }

  function setAutoRefresh(enabled: boolean) {
    autoRefreshEnabled.value = enabled;
    if (!enabled) {
      stopAllAutoRefresh();
    }
  }

  function setRefreshInterval(ms: number) {
    refreshInterval.value = ms;
  }

  function getSummary(serverId: string): NPUSummary | undefined {
    return summaries.value.get(serverId);
  }

  function getSystemSummary(serverId: string): SystemSummary | undefined {
    return systemSummaries.value.get(serverId);
  }

  function isLoading(serverId: string): boolean {
    return loading.value.get(serverId) ?? false;
  }

  function isSystemLoading(serverId: string): boolean {
    return systemLoading.value.get(serverId) ?? false;
  }

  function getError(serverId: string): string | undefined {
    return errors.value.get(serverId);
  }

  function getSystemError(serverId: string): string | undefined {
    return systemErrors.value.get(serverId);
  }

  function clearSummary(serverId: string) {
    summaries.value.delete(serverId);
    systemSummaries.value.delete(serverId);
    stopAutoRefresh(serverId);
    stopSystemAutoRefresh(serverId);
  }

  return {
    summaries,
    systemSummaries,
    loading,
    systemLoading,
    errors,
    systemErrors,
    autoRefreshEnabled,
    refreshInterval,
    fetchSummary,
    fetchSystemSummary,
    startAutoRefresh,
    startSystemAutoRefresh,
    stopAutoRefresh,
    stopSystemAutoRefresh,
    stopAllAutoRefresh,
    startBackgroundRefreshForServers,
    setAutoRefresh,
    setRefreshInterval,
    getSummary,
    getSystemSummary,
    isLoading,
    isSystemLoading,
    getError,
    getSystemError,
    clearSummary,
  };
});
