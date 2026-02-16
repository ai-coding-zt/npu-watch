import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ServerConfig, CreateServerRequest, UpdateServerRequest, ConnectionStatus } from '@/types';
import { serversApi } from '@/api';

export const useServersStore = defineStore('servers', () => {
  const servers = ref<ServerConfig[]>([]);
  const connectionStatuses = ref<Map<string, ConnectionStatus>>(new Map());
  const loading = ref(false);
  const error = ref<string | null>(null);
  const hasLoaded = ref(false);

  const connectedServers = computed(() => 
    servers.value.filter(s => connectionStatuses.value.get(s.id)?.connected)
  );

  async function fetchServers(forceRefresh = false) {
    if (hasLoaded.value && !forceRefresh) {
      return;
    }
    
    loading.value = true;
    error.value = null;
    try {
      const response = await serversApi.getAll();
      if (response.data.success && response.data.data) {
        servers.value = response.data.data;
        await Promise.all(servers.value.map(s => checkConnection(s.id)));
        hasLoaded.value = true;
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch servers';
    } finally {
      loading.value = false;
    }
  }

  async function checkConnection(serverId: string) {
    try {
      const response = await serversApi.getStatus(serverId);
      if (response.data.success && response.data.data) {
        connectionStatuses.value.set(serverId, response.data.data);
      }
    } catch {
      connectionStatuses.value.set(serverId, { connected: false, serverId });
    }
  }

  async function createServer(data: CreateServerRequest) {
    const response = await serversApi.create(data);
    if (response.data.success && response.data.data) {
      servers.value.push(response.data.data);
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to create server');
  }

  async function updateServer(id: string, data: UpdateServerRequest) {
    const response = await serversApi.update(id, data);
    if (response.data.success && response.data.data) {
      const index = servers.value.findIndex(s => s.id === id);
      if (index !== -1) {
        servers.value[index] = response.data.data;
      }
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to update server');
  }

  async function deleteServer(id: string) {
    await serversApi.disconnect(id);
    const response = await serversApi.delete(id);
    if (response.data.success) {
      servers.value = servers.value.filter(s => s.id !== id);
      connectionStatuses.value.delete(id);
    }
  }

  async function connectServer(id: string, password?: string) {
    const response = await serversApi.connect(id, password);
    if (response.data.success) {
      await checkConnection(id);
    } else {
      throw new Error(response.data.error || 'Connection failed');
    }
  }

  async function disconnectServer(id: string) {
    await serversApi.disconnect(id);
    connectionStatuses.value.set(id, { connected: false, serverId: id });
  }

  function isConnected(serverId: string): boolean {
    return connectionStatuses.value.get(serverId)?.connected ?? false;
  }

  return {
    servers,
    connectionStatuses,
    loading,
    error,
    hasLoaded,
    connectedServers,
    fetchServers,
    checkConnection,
    createServer,
    updateServer,
    deleteServer,
    connectServer,
    disconnectServer,
    isConnected,
  };
});
