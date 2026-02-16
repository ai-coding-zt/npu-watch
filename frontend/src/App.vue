<script setup lang="ts">
import { onMounted } from 'vue';
import Sidebar from '@/components/Sidebar.vue';
import { useServersStore } from '@/stores/servers';

const serversStore = useServersStore();

onMounted(() => {
  serversStore.fetchServers();
});
</script>

<template>
  <div class="app-container">
    <Sidebar />
    <main class="main-content">
      <router-view v-slot="{ Component, route }">
        <keep-alive>
          <component :is="Component" :key="route.path" />
        </keep-alive>
      </router-view>
    </main>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  min-height: 100vh;
}

.main-content {
  flex: 1;
  background-color: var(--bg-primary);
  overflow-y: auto;
}
</style>
