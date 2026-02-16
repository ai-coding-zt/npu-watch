# Backend - NPU Watch API

Express + TypeScript API server for NPU device monitoring.

## STRUCTURE

```
src/
├── index.ts          # Entry point (Express + WebSocket)
├── types.ts          # All TypeScript interfaces
├── constants/
│   ├── index.ts      # Barrel export
│   ├── errors.ts     # Centralized error messages
│   └── config.ts     # Configuration constants
├── utils/
│   ├── index.ts      # Barrel export
│   ├── response.ts   # API response helpers
│   └── validation.ts # Zod schemas
├── routes/
│   ├── api.ts        # REST endpoints (servers, monitoring, history)
│   ├── ws.ts         # WebSocket terminal handler
│   └── files.ts      # SFTP file operations
├── services/
│   ├── ssh.ts        # Connection pooling (Map-based)
│   ├── db.ts         # SQLite operations
│   ├── npu-parser.ts # npu-smi output parsing
│   ├── system-parser.ts # System metrics parsing
│   ├── cache.ts      # In-memory caching
│   ├── scheduler.ts  # Auto-refresh scheduling
│   ├── terminal.ts   # Terminal session management
│   └── sftp.ts       # SFTP operations
├── middleware/       # (reserved - unused)
└── models/           # (reserved - unused)
```

## WHERE TO LOOK

| Task | File |
|------|------|
| Add API endpoint | `routes/api.ts` |
| Add WebSocket handler | `routes/ws.ts` |
| Add file operation | `routes/files.ts` |
| Parse new npu-smi output | `services/npu-parser.ts` |
| Parse system metrics | `services/system-parser.ts` |
| Database schema/queries | `services/db.ts` |
| SSH connection logic | `services/ssh.ts` |
| Terminal session logic | `services/terminal.ts` |
| SFTP operations | `services/sftp.ts` |
| Caching logic | `services/cache.ts` |
| Auto-refresh scheduling | `services/scheduler.ts` |
| Add new type | `types.ts` |
| Add error message | `constants/errors.ts` |
| Add config constant | `constants/config.ts` |
| Add response helper | `utils/response.ts` |
| Add validation schema | `utils/validation.ts` |

## CONVENTIONS

- **ES modules**: Always use `.js` extension in imports
  ```typescript
  import { x } from './file.js'  // ✓
  import { x } from './file'     // ✗
  ```
- **Validation**: Zod schemas in `utils/validation.ts`
- **Error handling**: Use `sendError`, `sendNotFound`, `sendBadRequest`, `sendInternalError` from `utils/response.ts`
- **Services**: Stateless functions, connection state in `ssh.ts` Map
- **Database**: Synchronous better-sqlite3, no ORM
- **Constants**: All magic numbers in `constants/config.ts`, all error strings in `constants/errors.ts`

## COMMANDS

```bash
npm run dev      # tsx watch src/index.ts (:3000)
npm run build    # tsc → dist/
npm start        # node dist/index.js
```

## NOTES

- SQLite DB auto-creates on first run
- SSH connections pooled indefinitely (manual disconnect required)
- WebSocket terminals use xterm.js protocol
- Use `sendSuccess`, `sendCreated`, `sendNotFound`, `sendBadRequest`, `sendInternalError` helpers for consistent API responses
