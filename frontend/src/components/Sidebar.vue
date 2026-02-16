<script setup lang="ts">
import { computed } from 'vue';
import { useServersStore } from '@/stores/servers';
import { useThemeStore } from '@/stores/theme';
import { useRouter } from 'vue-router';

const router = useRouter();
const serversStore = useServersStore();
const themeStore = useThemeStore();

const servers = computed(() => serversStore.servers);
const currentRoute = computed(() => router.currentRoute.value.path);

function navigateTo(path: string) {
  router.push(path);
}

function getServerIcon(serverId: string) {
  return serversStore.isConnected(serverId) ? 'online' : 'offline';
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="logo">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <rect x="9" y="9" width="6" height="6" />
          <line x1="9" y1="1" x2="9" y2="4" />
          <line x1="15" y1="1" x2="15" y2="4" />
          <line x1="9" y1="20" x2="9" y2="23" />
          <line x1="15" y1="20" x2="15" y2="23" />
        </svg>
        <span>NPU Watch</span>
      </div>
    </div>

    <nav class="sidebar-nav">
      <div class="nav-section">
        <h3 class="nav-section-title">Navigation</h3>
        <button
          class="nav-item"
          :class="{ active: currentRoute === '/' || currentRoute === '/dashboard' }"
          @click="navigateTo('/')"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          <span>Dashboard</span>
        </button>
        <button
          class="nav-item"
          :class="{ active: currentRoute === '/servers' }"
          @click="navigateTo('/servers')"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <span>Servers</span>
        </button>
      </div>

      <div class="nav-section">
        <h3 class="nav-section-title">Servers</h3>
        <div v-if="servers.length === 0" class="nav-empty">
          No servers
        </div>
        <button
          v-for="server in servers"
          :key="server.id"
          class="nav-item server-item"
          :class="{ active: currentRoute.includes(`/monitor/${server.id}`) }"
          @click="navigateTo(`/monitor/${server.id}`)"
        >
          <span class="status-dot" :class="getServerIcon(server.id)"></span>
          <span class="server-name">{{ server.name }}</span>
        </button>
      </div>
    </nav>

    <div class="sidebar-footer">
      <button class="add-server-btn" @click="navigateTo('/servers')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add Server
      </button>
      <button class="theme-toggle" @click="themeStore.toggleTheme()">
        <svg v-if="themeStore.theme === 'dark'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
        <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 240px;
  background-color: var(--sidebar-bg);
  border-right: 1px solid var(--sidebar-border);
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: sticky;
  top: 0;
}

.sidebar-header {
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--sidebar-border);
}

.logo {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--header-primary);
  font-weight: 600;
  font-size: 18px;
}

.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
}

.nav-section {
  margin-bottom: var(--spacing-lg);
}

.nav-section-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: var(--spacing-sm);
  padding: 0 var(--spacing-sm);
}

.nav-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  color: var(--text-normal);
  transition: all var(--transition-fast);
  text-align: left;
}

.nav-item:hover {
  background-color: var(--bg-modifier-hover);
}

.nav-item.active {
  background-color: var(--bg-modifier-selected);
  color: var(--header-primary);
}

.server-item {
  font-size: 14px;
}

.server-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-empty {
  font-size: 12px;
  color: var(--text-muted);
  padding: var(--spacing-sm) var(--spacing-md);
}

.sidebar-footer {
  padding: var(--spacing-md);
  border-top: 1px solid var(--sidebar-border);
  display: flex;
  gap: var(--spacing-sm);
}

.add-server-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
  background-color: var(--brand-experiment);
  color: white;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  transition: background-color var(--transition-fast);
}

.add-server-btn:hover {
  background-color: var(--brand-experiment-hover);
}

.theme-toggle {
  padding: var(--spacing-sm);
  background-color: var(--bg-modifier-hover);
  border-radius: var(--radius-sm);
  color: var(--text-normal);
  transition: background-color var(--transition-fast);
}

.theme-toggle:hover {
  background-color: var(--bg-modifier-active);
}
</style>
