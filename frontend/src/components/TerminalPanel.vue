<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, onActivated, onDeactivated, watch, nextTick } from 'vue';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useServersStore } from '@/stores/servers';

const props = defineProps<{
  serverId: string;
  isConnected: boolean;
  visible?: boolean;
}>();

const serversStore = useServersStore();

interface TerminalSession {
  id: string;
  name: string;
  terminal: Terminal | null;
  ws: WebSocket | null;
  containerId: string;
}

const terminalSessions = ref<TerminalSession[]>([]);
const activeTerminalId = ref<string | null>(null);
const fitAddons = new Map<string, FitAddon>();

const wsUrl = computed(() => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//localhost:3000/api/terminal/${props.serverId}`;
});

function refitTerminal(sessionId: string) {
  const fitAddon = fitAddons.get(sessionId);
  if (fitAddon) {
    try {
      fitAddon.fit();
    } catch (e) {
      // ignore
    }
  }
}

function addTerminalSession() {
  const id = `term-${Date.now()}`;
  const name = `Terminal ${terminalSessions.value.length + 1}`;
  const session: TerminalSession = {
    id,
    name,
    terminal: null,
    ws: null,
    containerId: `terminal-container-${id}`
  };
  
  terminalSessions.value.push(session);
  activeTerminalId.value = id;
  
  nextTick(() => {
    initTerminal(session);
  });
}

function initTerminal(session: TerminalSession) {
  const containerEl = document.getElementById(session.containerId);
  if (!containerEl) return;

  const terminal = new Terminal({
    theme: {
      background: '#1e1f22',
      foreground: '#dbdee1',
      cursor: '#dbdee1',
      cursorAccent: '#1e1f22',
      selectionBackground: 'rgba(79, 84, 92, 0.4)',
      black: '#1e1f22',
      red: '#f23f43',
      green: '#23a559',
      yellow: '#f0b132',
      blue: '#00a8fc',
      magenta: '#f23f43',
      cyan: '#00a8fc',
      white: '#dbdee1',
      brightBlack: '#949ba4',
      brightRed: '#f23f43',
      brightGreen: '#23a559',
      brightYellow: '#f0b132',
      brightBlue: '#00a8fc',
      brightMagenta: '#f23f43',
      brightCyan: '#00a8fc',
      brightWhite: '#f2f3f5'
    },
    fontFamily: 'Fira Code, Consolas, Monaco, monospace',
    fontSize: 14,
    lineHeight: 1.2,
    cursorBlink: true
  });

  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(containerEl);
  fitAddon.fit();
  fitAddons.set(session.id, fitAddon);
  session.terminal = terminal;

  connectWebSocket(session);
}

function connectWebSocket(session: TerminalSession) {
  if (!session.terminal) return;
  
  if (session.ws) {
    session.ws.close();
    session.ws = null;
  }

  const terminal = session.terminal;
  const ws = new WebSocket(`${wsUrl.value}?cols=${terminal.cols}&rows=${terminal.rows}`);
  session.ws = ws;

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'create' }));
    refitTerminal(session.id);
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'output' && session.terminal) {
      session.terminal.write(msg.data);
    } else if (msg.type === 'error') {
      session.terminal?.write(`\x1b[31m${msg.message}\x1b[0m\r\n`);
    }
  };

  ws.onclose = (event) => {
    if (event.code === 4001) {
      session.terminal?.write('\r\n\x1b[33m[SSH connection lost]\x1b[0m\r\n');
    } else if (event.code !== 1000) {
      session.terminal?.write('\r\n\x1b[33m[Disconnected]\x1b[0m\r\n');
    }
  };

  ws.onerror = () => {
    console.error('[Terminal] WebSocket error');
  };

  terminal.onData((data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'input', data }));
    }
  });

  terminal.onResize(({ cols, rows }) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resize', cols, rows }));
    }
  });
}

async function reconnectSession(session: TerminalSession) {
  if (!session.terminal) return;
  
  session.terminal.write('\r\n\x1b[33mReconnecting...\x1b[0m\r\n');
  
  await serversStore.checkConnection(props.serverId);
  
  if (!serversStore.isConnected(props.serverId)) {
    session.terminal.write('\r\n\x1b[33mServer disconnected, reconnecting...\x1b[0m\r\n');
    try {
      await serversStore.connectServer(props.serverId);
    } catch (e) {
      session.terminal.write(`\x1b[31mFailed to connect: ${e instanceof Error ? e.message : 'Unknown error'}\x1b[0m\r\n`);
      return;
    }
  }
  
  connectWebSocket(session);
}

function closeTerminalSession(sessionId: string) {
  const index = terminalSessions.value.findIndex(s => s.id === sessionId);
  if (index === -1) return;

  const session = terminalSessions.value[index];
  
  if (session.ws) session.ws.close(1000, 'Closed');
  if (session.terminal) session.terminal.dispose();
  
  fitAddons.delete(sessionId);
  terminalSessions.value.splice(index, 1);

  if (activeTerminalId.value === sessionId) {
    activeTerminalId.value = terminalSessions.value.length > 0 ? terminalSessions.value[0].id : null;
  }
}

function switchTerminalTab(sessionId: string) {
  activeTerminalId.value = sessionId;
  nextTick(() => refitTerminal(sessionId));
}

function cleanup() {
  terminalSessions.value.forEach(session => {
    if (session.ws) session.ws.close(1000, 'Cleanup');
    if (session.terminal) session.terminal.dispose();
  });
  terminalSessions.value = [];
  fitAddons.clear();
  activeTerminalId.value = null;
}

function isSessionConnected(session: TerminalSession): boolean {
  return session.ws !== null && session.ws.readyState === WebSocket.OPEN;
}

function getActiveSession(): TerminalSession | undefined {
  return terminalSessions.value.find(s => s.id === activeTerminalId.value);
}

onMounted(() => {
  if (props.isConnected && props.visible) {
    addTerminalSession();
  }
});

onBeforeUnmount(() => {
  cleanup();
});

onActivated(() => {
  if (terminalSessions.value.length > 0) {
    setTimeout(() => {
      terminalSessions.value.forEach(session => {
        refitTerminal(session.id);
      });
    }, 50);
  }
});

onDeactivated(() => {
});

// Server change - must cleanup and recreate (xterm limitation)
watch(() => props.serverId, (newId, oldId) => {
  if (newId !== oldId) {
    cleanup();
    if (props.isConnected && props.visible) {
      nextTick(() => addTerminalSession());
    }
  }
});

// Visibility change - refit only, don't auto-reconnect
watch(() => props.visible, (visible) => {
  if (visible && props.isConnected) {
    nextTick(() => {
      if (terminalSessions.value.length === 0) {
        addTerminalSession();
      } else {
        setTimeout(() => {
          terminalSessions.value.forEach(session => {
            refitTerminal(session.id);
          });
        }, 50);
      }
    });
  }
});

// Connection change
watch(() => props.isConnected, (connected) => {
  if (connected && props.visible && terminalSessions.value.length === 0) {
    addTerminalSession();
  }
});
</script>

<template>
  <div class="terminal-panel">
    <div v-if="!isConnected" class="disconnected-state">
      <p>Not connected to server</p>
    </div>
    
    <template v-else>
      <div class="terminal-tabs">
        <div class="terminal-tab-list">
          <button
            v-for="session in terminalSessions"
            :key="session.id"
            class="terminal-tab"
            :class="{ active: activeTerminalId === session.id }"
            @click="switchTerminalTab(session.id)"
          >
            <span>{{ session.name }}</span>
            <span v-if="!isSessionConnected(session)" class="tab-status">●</span>
            <span class="tab-close" @click.stop="closeTerminalSession(session.id)">×</span>
          </button>
          <button class="tab-add" @click="addTerminalSession">+</button>
        </div>
        <div class="terminal-actions">
          <button 
            v-if="getActiveSession() && !isSessionConnected(getActiveSession()!)"
            class="btn-reconnect"
            @click="reconnectSession(getActiveSession()!)"
          >
            Reconnect
          </button>
        </div>
      </div>
      <div class="terminal-windows">
        <div
          v-for="session in terminalSessions"
          :key="session.id"
          :id="session.containerId"
          class="terminal-window"
          :class="{ active: activeTerminalId === session.id }"
        ></div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.terminal-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-tertiary);
  border-radius: var(--radius-md);
  overflow: hidden;
  min-height: 400px;
}

.disconnected-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--text-muted);
}

.terminal-tabs {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--card-border);
  padding-right: 8px;
}

.terminal-tab-list {
  display: flex;
  align-items: center;
}

.terminal-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: none;
  border: none;
  border-right: 1px solid var(--card-border);
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
}

.terminal-tab:hover {
  background-color: var(--bg-modifier-hover);
}

.terminal-tab.active {
  background-color: var(--bg-tertiary);
  color: var(--text-normal);
}

.tab-status {
  color: var(--yellow);
  font-size: 10px;
}

.tab-close {
  font-size: 16px;
  opacity: 0;
}

.terminal-tab:hover .tab-close {
  opacity: 1;
}

.tab-close:hover {
  color: var(--red);
}

.tab-add {
  padding: 8px 12px;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 16px;
  cursor: pointer;
}

.tab-add:hover {
  color: var(--text-normal);
  background-color: var(--bg-modifier-hover);
}

.btn-reconnect {
  padding: 4px 12px;
  font-size: 12px;
  background-color: var(--brand-experiment);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.terminal-windows {
  flex: 1;
  position: relative;
}

.terminal-window {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: var(--spacing-sm);
  display: none;
}

.terminal-window.active {
  display: block;
}
</style>
