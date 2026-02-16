export const ERR_NOT_CONNECTED = 'Not connected to server';
export const ERR_SSH_NOT_CONNECTED = 'SSH not connected';
export const ERR_SSH_CONNECTION_FAILED = 'Connection failed';
export const ERR_SSH_CONNECTED = 'Connected successfully';

export const ERR_SERVER_NOT_FOUND = 'Server not found';
export const ERR_SERVER_CREATE_FAILED = 'Failed to create server';
export const ERR_SERVER_UPDATE_FAILED = 'Failed to update server';
export const ERR_SERVER_DELETE_FAILED = 'Failed to delete server';

export const ERR_FILE_NOT_FOUND = 'File not found';
export const ERR_DIR_NOT_ACCESSIBLE = 'Directory not accessible';
export const ERR_MKDIR_FAILED = 'Failed to create directory';
export const ERR_DELETE_FAILED = 'Failed to delete';
export const ERR_RENAME_FAILED = 'Failed to rename';
export const ERR_READ_FAILED = 'Failed to read file';
export const ERR_UPLOAD_FAILED = 'Failed to upload file';

export const ERR_TERMINAL_NOT_FOUND = 'Terminal session not found';
export const ERR_TERMINAL_INVALID_PATH = 'Invalid terminal path';
export const ERR_TERMINAL_ALREADY_EXISTS = 'Terminal session already exists';

export const ERR_WS_INVALID_PATH = 'Invalid terminal path';
export const ERR_WS_SERVER_NOT_FOUND = 'Server not found';
export const ERR_WS_NOT_CONNECTED = 'Not connected to server';

export const ERR_CACHE_UNAVAILABLE = 'No cached data available';

export const ERR_VALIDATION_FAILED = 'Validation failed';
export const ERR_INVALID_REFRESH_INTERVAL = 'refreshInterval must be between 10000 and 300000 ms';
export const ERR_INVALID_CONFIG_PARAMS = 'Invalid config parameters';
export const ERR_NPU_ID_REQUIRED = 'npuId and chipId are required';

export const ERR_UNKNOWN = 'Unknown error';
export const ERR_OPERATION_FAILED = 'Operation failed';

export function formatError(error: unknown, fallback: string = ERR_UNKNOWN): string {
  return error instanceof Error ? error.message : fallback;
}
