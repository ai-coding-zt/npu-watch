import type { SystemMemory, StorageDevice, NetworkPort, Container, SystemSummary } from '../types.js';

interface CommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

export function parseMemory(result: CommandResult): SystemMemory | null {
  if (!result.stdout) return null;

  try {
    const lines = result.stdout.trim().split('\n');
    const memLine = lines.find(l => l.startsWith('Mem:'));
    
    if (!memLine) return null;

    const parts = memLine.split(/\s+/);
    if (parts.length < 7) return null;

    const total = parseInt(parts[1], 10) || 0;
    const used = parseInt(parts[2], 10) || 0;
    const free = parseInt(parts[3], 10) || 0;
    const buffers = parseInt(parts[5], 10) || 0;
    const cached = parseInt(parts[6], 10) || 0;
    const available = free + buffers + cached;
    const usagePercent = total > 0 ? Math.round((used / total) * 100) : 0;

    return { total, used, free, available, buffers, cached, usagePercent };
  } catch {
    return null;
  }
}

export function parseStorage(result: CommandResult): StorageDevice[] {
  if (!result.stdout) return [];

  try {
    const lines = result.stdout.trim().split('\n');
    const devices: StorageDevice[] = [];
    const seenMounts = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(/\s+/);
      if (parts.length >= 6) {
        const mountPoint = parts[5];
        
        if (mountPoint.includes('/docker/') || 
            mountPoint.includes('/overlay2/') ||
            seenMounts.has(mountPoint)) {
          continue;
        }
        
        seenMounts.add(mountPoint);
        
        const usageStr = parts[4] || '0%';
        const usagePercent = parseInt(usageStr.replace('%', ''), 10) || 0;
        
        devices.push({
          filesystem: parts[0],
          size: parts[1],
          used: parts[2],
          available: parts[3],
          usagePercent,
          mountPoint
        });
      }
    }

    return devices;
  } catch {
    return [];
  }
}

export function parsePorts(result: CommandResult): NetworkPort[] {
  if (!result.stdout) return [];

  try {
    const lines = result.stdout.trim().split('\n');
    const ports: NetworkPort[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('State') || !trimmed.startsWith('LISTEN')) continue;

      const localAddrMatch = trimmed.match(/(\S+):(\d+)\s+\S+\s+\S+/);
      if (localAddrMatch) {
        const address = localAddrMatch[1];
        const port = parseInt(localAddrMatch[2], 10);
        
        const procMatch = trimmed.match(/users:\(\("([^"]+)".*pid=(\d+)/);
        const process = procMatch ? procMatch[1] : '-';
        const pid = procMatch ? parseInt(procMatch[2], 10) : null;

        ports.push({
          protocol: 'tcp',
          localAddress: address,
          port,
          state: 'LISTEN',
          process,
          pid
        });
      }
    }

    return ports;
  } catch {
    return [];
  }
}

export function parseContainers(result: CommandResult): Container[] {
  if (!result.stdout || result.stdout.includes('Docker not available')) return [];

  try {
    const lines = result.stdout.trim().split('\n');
    const containers: Container[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('CONTAINER')) continue;

      const parts = trimmed.split(/\s{2,}/);
      if (parts.length >= 5) {
        containers.push({
          id: parts[0] || '',
          name: parts[1] || '',
          image: parts[2] || '',
          status: parts[4] || '',
          state: parts[3]?.includes('Up') ? 'running' : 'stopped',
          ports: parts[5] || '',
          createdAt: parts[3] || ''
        });
      }
    }

    return containers;
  } catch {
    return [];
  }
}

export async function getSystemSummary(
  executeCmd: (cmd: string) => Promise<CommandResult>
): Promise<SystemSummary> {
  try {
    const [memResult, storageResult, portsResult, containersResult] = await Promise.all([
      executeCmd('free -m').catch(() => ({ stdout: '', stderr: 'Failed', code: 1 })),
      executeCmd('df -h').catch(() => ({ stdout: '', stderr: 'Failed', code: 1 })),
      executeCmd('ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null').catch(() => ({ stdout: '', stderr: 'Failed', code: 1 })),
      executeCmd('docker ps -a --format "table {{.ID}}\\t{{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Status}}\\t{{.Ports}}" 2>/dev/null || echo "Docker not available"').catch(() => ({ stdout: 'Docker not available', stderr: '', code: 0 }))
    ]);

    const memory = parseMemory(memResult) ?? {
      total: 0,
      used: 0,
      free: 0,
      available: 0,
      buffers: 0,
      cached: 0,
      usagePercent: 0
    };

    return {
      memory,
      storage: parseStorage(storageResult),
      ports: parsePorts(portsResult),
      containers: parseContainers(containersResult),
      lastUpdated: Date.now()
    };
  } catch (error) {
    return {
      memory: { total: 0, used: 0, free: 0, available: 0, buffers: 0, cached: 0, usagePercent: 0 },
      storage: [],
      ports: [],
      containers: [],
      lastUpdated: Date.now(),
      error: error instanceof Error ? error.message : 'Unknown error'
    } as SystemSummary;
  }
}
