# Frontend - NPU Watch UI

Vue 3 + TypeScript + Vite SPA with Discord-style dark/light themes.

## STRUCTURE

```
src/
├── main.ts           # Vue app entry (Pinia + Router)
├── App.vue           # Root component
├── constants/
│   └── index.ts      # Configuration constants
├── views/            # Page components
│   ├── Dashboard.vue
│   ├── Servers.vue
│   ├── ServerDetail.vue
│   ├── Monitor.vue
│   └── TerminalView.vue
├── components/       # Reusable components (9 files)
│   ├── Sidebar.vue
│   ├── ServerCard.vue
│   ├── AddServerModal.vue
│   ├── MetricCard.vue
│   ├── ChipTable.vue
│   ├── ProcessList.vue
│   ├── SystemMonitor.vue
│   ├── TerminalPanel.vue
│   └── FilesPanel.vue
├── stores/           # Pinia stores (5 files)
│   ├── servers.ts    # Server CRUD + connection state
│   ├── monitor.ts    # NPU metrics state
│   ├── terminal.ts   # Terminal sessions + file manager
│   ├── terminalState.ts # Terminal UI state
│   └── theme.ts      # Dark/light theme
├── api/              # Axios client
│   └── index.ts      # serversApi, monitorApi
├── types/            # TypeScript interfaces
├── styles/           # Discord-style CSS
├── router/           # Vue Router config
└── assets/           # Static assets
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add page | `views/` + router config |
| Add component | `components/` |
| Add API call | `api/index.ts` + store |
| Add server state | `stores/servers.ts` |
| Add monitor state | `stores/monitor.ts` |
| Add terminal state | `stores/terminal.ts`, `stores/terminalState.ts` |
| Add theme state | `stores/theme.ts` |
| Add type | `types/` |
| Add constant | `constants/index.ts` |
| Modify styles | `styles/` |

## CONVENTIONS

- **Composition API**: `<script setup lang="ts">`
- **Pinia stores**: `defineStore('name', () => {...})`
- **Path alias**: `@/` maps to `src/`
- **API calls**: Via store actions, not directly in components
- **Constants**: All magic values in `constants/index.ts`

## COMMANDS

```bash
npm run dev      # Vite on :5173
npm run build    # vue-tsc && vite build
npm run preview  # Preview production build
```

## NOTES

- Dev proxy: `/api` → `http://localhost:3000`
- xterm.js for SSH terminal
- Theme persisted in localStorage
- No component library (custom Discord-style CSS)
