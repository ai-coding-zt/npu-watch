import axios from 'axios';
import type { 
  ServerConfig, 
  CreateServerRequest, 
  UpdateServerRequest,
  NPUSummary,
  NPUDevice,
  NPUChip,
  ConnectionStatus,
  SystemSummary,
  ApiResponse,
  NPUHistoryQueryResult
} from '@/types';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

export const serversApi = {
  getAll: () => 
    api.get<ApiResponse<ServerConfig[]>>('/servers'),

  getById: (id: string) => 
    api.get<ApiResponse<ServerConfig>>(`/servers/${id}`),

  create: (data: CreateServerRequest) => 
    api.post<ApiResponse<ServerConfig>>('/servers', data),

  update: (id: string, data: UpdateServerRequest) => 
    api.put<ApiResponse<ServerConfig>>(`/servers/${id}`, data),

  delete: (id: string) => 
    api.delete<ApiResponse>(`/servers/${id}`),

  connect: (id: string, password?: string) => 
    api.post<ApiResponse>(`/servers/${id}/connect`, { password }),

  disconnect: (id: string) => 
    api.post<ApiResponse>(`/servers/${id}/disconnect`),

  getStatus: (id: string) => 
    api.get<ApiResponse<ConnectionStatus>>(`/servers/${id}/status`),
};

export const monitorApi = {
  getSummary: (serverId: string) => 
    api.get<ApiResponse<NPUSummary>>(`/servers/${serverId}/monitor`),

  getDevices: (serverId: string) => 
    api.get<ApiResponse<NPUDevice[]>>(`/servers/${serverId}/devices`),

  getChips: (serverId: string) => 
    api.get<ApiResponse<NPUChip[]>>(`/servers/${serverId}/chips`),

  getHealth: (serverId: string, deviceId: string | number) => 
    api.get<ApiResponse<{ raw: string }>>(`/servers/${serverId}/health`, { 
      params: { deviceId } 
    }),

  getSystem: (serverId: string) => 
    api.get<ApiResponse<SystemSummary>>(`/servers/${serverId}/system`),

  getNpuHistory: (serverId: string, npuId: number, chipId: number, startTime?: number, endTime?: number) => 
    api.get<ApiResponse<NPUHistoryQueryResult>>(`/servers/${serverId}/npu-history`, {
      params: { npuId, chipId, startTime, endTime }
    }),
};

export default api;
