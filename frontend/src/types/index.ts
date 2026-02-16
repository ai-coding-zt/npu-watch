export interface ServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  createdAt: number;
  updatedAt: number;
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

export interface ConnectionStatus {
  connected: boolean;
  serverId: string;
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
