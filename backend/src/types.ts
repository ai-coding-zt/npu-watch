export interface ServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  password?: string;
  privateKey?: string;
  passphrase?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ServerConnection {
  id: string;
  serverId: string;
  connected: boolean;
  lastConnected?: number;
  error?: string;
}

export interface NPUDevice {
  id: number;
  name: string;
}

export interface NPUChip {
  npuId: number;
  chipId: number;
  name: string;
  health: string;
}

export interface NPUBordInfo {
  npuId: number;
  name: string;
  health: string;
  firmwareVersion: string;
  softwareVersion: string;
}

export interface NPUTemperature {
  npuId: number;
  chipId: number;
  npuTemp: number;
  aiCoreTemp: number;
}

export interface NPUPower {
  npuId: number;
  chipId: number;
  powerUsage: number;
  powerLimit: number;
}

export interface NPUMemory {
  npuId: number;
  chipId: number;
  memoryUsage: number;
  memoryTotal: number;
  memoryUsageRate: number;
  hbmUsageRate: number;
}

export interface NPUUsage {
  npuId: number;
  chipId: number;
  aiCoreUsage: number;
  memoryUsage: number;
  bandwidthUsage: number;
}

export interface NPUProcess {
  pid: number;
  processName: string;
  memoryUsage: number;
  aiCoreUsage: number;
  npuId: number;
}

export interface NPUECC {
  npuId: number;
  chipId: number;
  eccErrorCount: number;
  eccMode: string;
}

export interface NPUSummary {
  devices: NPUDevice[];
  chips: NPUChip[];
  boardInfo: NPUBordInfo[];
  temperatures: NPUTemperature[];
  power: NPUPower[];
  memory: NPUMemory[];
  usage: NPUUsage[];
  processes: NPUProcess[];
  ecc: NPUECC[];
  lastUpdated: number;
}

export interface SystemMemory {
  total: number;
  used: number;
  free: number;
  available: number;
  buffers: number;
  cached: number;
  usagePercent: number;
}

export interface StorageDevice {
  filesystem: string;
  size: string;
  used: string;
  available: string;
  usagePercent: number;
  mountPoint: string;
}

export interface NetworkPort {
  protocol: string;
  localAddress: string;
  port: number;
  state: string;
  process: string;
  pid: number | null;
}

export interface Container {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  ports: string;
  createdAt: string;
}

export interface SystemSummary {
  memory: SystemMemory;
  storage: StorageDevice[];
  ports: NetworkPort[];
  containers: Container[];
  lastUpdated: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CreateServerRequest {
  name: string;
  host: string;
  port?: number;
  username: string;
  authType: 'password' | 'key';
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface UpdateServerRequest extends Partial<CreateServerRequest> {}

export interface ConnectionStatus {
  serverId: string;
  connected: boolean;
  lastConnected?: number;
  lastError?: string;
  autoRefresh: boolean;
  refreshInterval: number;
}

export interface NPUCacheData extends NPUSummary {
  connected: boolean;
  lastSuccess?: number;
  error?: string;
}

export interface SystemCacheData extends SystemSummary {
  connected: boolean;
  lastSuccess?: number;
  error?: string;
}

export interface NPUHistoryRecord {
  id: number;
  serverId: string;
  npuId: number;
  chipId: number;
  temperature: number;
  powerUsage: number;
  memoryUsageRate: number;
  aiCoreUsage: number;
  eccErrorCount: number;
  timestamp: number;
}

export interface SystemHistoryRecord {
  id: number;
  serverId: string;
  memoryUsagePercent: number;
  storageUsagePercent: number;
  containerCount: number;
  runningContainers: number;
  timestamp: number;
}

export interface RefreshConfig {
  autoRefresh: boolean;
  refreshInterval: number;
}

export interface CacheStatusOverview {
  serverId: string;
  serverName: string;
  connected: boolean;
  autoRefresh: boolean;
  refreshInterval: number;
  npuLastUpdated?: number;
  systemLastUpdated?: number;
  lastError?: string;
}

export interface NPUHistoryQueryResult {
  records: NPUHistoryRecord[];
  summary: {
    avgTemperature: number;
    maxTemperature: number;
    avgPowerUsage: number;
    avgMemoryUsage: number;
    avgAiCoreUsage: number;
  };
}

export interface SystemHistoryQueryResult {
  records: SystemHistoryRecord[];
  summary: {
    avgMemoryUsage: number;
    maxMemoryUsage: number;
    avgStorageUsage: number;
    avgContainerCount: number;
  };
}

export interface TerminalSession {
  id: string;
  serverId: string;
  cols: number;
  rows: number;
  createdAt: number;
}

export interface TerminalMessage {
  type: 'input' | 'output' | 'resize' | 'create' | 'close' | 'error' | 'created';
  sessionId?: string;
  data?: string;
  cols?: number;
  rows?: number;
  message?: string;
}

export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  size: number;
  modifiedTime: number;
  permissions: string;
  owner: string;
  group: string;
}

export interface FileListResult {
  path: string;
  files: FileInfo[];
  parentPath?: string;
}

export interface MkdirRequest {
  path: string;
  name: string;
}

export interface RenameRequest {
  oldPath: string;
  newPath: string;
}

export interface DeleteRequest {
  path: string;
}
