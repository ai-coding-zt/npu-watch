# NPU Watch - Project Knowledge Base

**Generated:** 2026-02-17
**Stack:** TypeScript monorepo (Vue 3 + Express)
**Stats:** 171 files, ~13k lines, 2 packages

## OVERVIEW

Web-based monitoring system for Huawei Ascend NPU devices. Discord-style UI with real-time metrics, SSH terminal, and file management.

## STRUCTURE

```
npu-watch/
├── backend/          # Express API + WebSocket server
│   └── src/
│       ├── constants/  # Error messages, config values
│       ├── utils/      # Response helpers, validation
│       ├── routes/     # API endpoints
│       └── services/   # Business logic
├── frontend/         # Vue 3 SPA (Vite)
│   └── src/
│       ├── constants/  # Frontend constants
│       ├── stores/     # Pinia state management
│       ├── views/      # Page components
│       └── api/        # Axios client
├── skills/           # AI skill docs (npu-smi, clean-code) - NO CODE
└── README.md
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add API endpoint | `backend/src/routes/api.ts` |
| Add WebSocket handler | `backend/src/routes/ws.ts` |
| Add error message | `backend/src/constants/errors.ts` |
| Add config constant | `backend/src/constants/config.ts` |
| Add response helper | `backend/src/utils/response.ts` |
| SSH operations | `backend/src/services/ssh.ts` |
| NPU command parsing | `backend/src/services/npu-parser.ts` |
| Database operations | `backend/src/services/db.ts` |
| Vue page | `frontend/src/views/` |
| Vue component | `frontend/src/components/` |
| Pinia store | `frontend/src/stores/` |
| Frontend constants | `frontend/src/constants/index.ts` |
| API client | `frontend/src/api/index.ts` |
| TypeScript types | `backend/src/types.ts`, `frontend/src/types/` |
| NPU command reference | `skills/npu-smi/SKILL.md` |

## CONVENTIONS

**Backend (Express + TypeScript):**
- ES modules with `.js` extension in imports: `import { x } from './file.js'`
- Zod for request validation in `utils/validation.ts`
- Service layer pattern: routes → services
- Response helpers: `sendSuccess`, `sendNotFound`, `sendBadRequest`, `sendInternalError`
- SQLite via better-sqlite3 (synchronous)
- Connection pooling in `ssh.ts` (Map-based)
- All constants in `constants/` directory

**Frontend (Vue 3):**
- Composition API with `<script setup>`
- Pinia stores use `defineStore` with setup function
- Path alias: `@/` → `src/`
- Axios instance at `@/api`
- Constants in `constants/index.ts`

**Monorepo:**
- Separate `package.json` per package
- No workspace config (manual `cd` required)
- Shared types duplicated (not extracted)

## ANTI-PATTERNS

- No testing infrastructure (no test files, no test commands)
- No CI/CD (no .github/workflows, no Dockerfile)
- No linting (no eslint, prettier)

## COMMANDS

```bash
# Backend
cd backend && npm install
cd backend && npm run dev      # tsx watch on :3000
cd backend && npm run build    # tsc → dist/
cd backend && npm start        # node dist/index.js

# Frontend  
cd frontend && npm install
cd frontend && npm run dev     # Vite on :5173
cd frontend && npm run build   # vue-tsc && vite build
```

## KEY DEPENDENCIES

**Backend:** express, ws, node-ssh, better-sqlite3, zod, bcryptjs, uuid
**Frontend:** vue, vue-router, pinia, axios, @xterm/xterm

## API ENDPOINTS

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| CRUD | /api/servers | Server management |
| POST | /api/servers/:id/connect | SSH connect |
| POST | /api/servers/:id/disconnect | SSH disconnect |
| GET | /api/servers/:id/status | Connection status |
| GET | /api/servers/:id/monitor | NPU metrics |
| GET | /api/servers/:id/devices | NPU devices |
| GET | /api/servers/:id/chips | NPU chips |
| GET | /api/servers/:id/health | Device health |
| GET | /api/servers/:id/system | System metrics |
| POST | /api/servers/:id/refresh | Trigger refresh |
| GET | /api/servers/:id/refresh-status | Refresh status |
| PUT | /api/servers/:id/refresh-config | Configure auto-refresh |
| GET | /api/servers/:id/npu-history | NPU history query |
| GET | /api/servers/:id/system-history | System history query |
| WS | /api/terminal/:serverId | Terminal session |
| GET | /api/files/:serverId/list | SFTP file list |
| POST | /api/files/:serverId/mkdir | Create directory |
| POST | /api/files/:serverId/rename | Rename file/dir |
| DELETE | /api/files/:serverId | Delete file/dir |
| GET | /api/files/:serverId/download | Download file |
| POST | /api/files/:serverId/upload | Upload file |

## SKILLS DIRECTORY

Contains AI-readable documentation, not code:
- `npu-smi/` - Complete npu-smi command reference
- `clean-*` - Clean code principles (Python-focused)

## DATABASE SCHEMA

SQLite tables (auto-created on first run):
- `servers` - Server configurations (encrypted credentials)
- `server_connections` - Connection status + refresh config
- `npu_cache` - Cached NPU metrics
- `system_cache` - Cached system metrics
- `npu_history` - Historical NPU data (24h retention)
- `system_history` - Historical system data (24h retention)

## NOTES

- Requires `npu-smi` tool on target NPU servers
- SSH auth: password or SSH key
- Auto-refresh intervals: 10s-300s (configurable per server)
- History stored in SQLite (24h default retention)
