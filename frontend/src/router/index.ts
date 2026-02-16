import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/views/Dashboard.vue'),
    },
    {
      path: '/servers',
      name: 'servers',
      component: () => import('@/views/Servers.vue'),
    },
    {
      path: '/server/:id',
      name: 'server-detail',
      component: () => import('@/views/ServerDetail.vue'),
    },
    {
      path: '/monitor/:serverId',
      name: 'monitor',
      component: () => import('@/views/Monitor.vue'),
    },
    {
      path: '/terminal/:serverId',
      name: 'terminal',
      component: () => import('@/views/TerminalView.vue'),
    },
  ],
});

export default router;
