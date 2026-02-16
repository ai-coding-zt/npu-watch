import type { 
  NPUDevice, 
  NPUChip, 
  NPUBordInfo, 
  NPUTemperature, 
  NPUPower, 
  NPUMemory, 
  NPUUsage,
  NPUProcess,
  NPUECC,
  NPUSummary 
} from '../types.js';
import { RETRY_DELAY_MS, DEFAULT_COMMAND_RETRIES } from '../constants/index.js';

interface CommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

export async function parseDeviceList(result: CommandResult): Promise<NPUDevice[]> {
  if (result.code !== 0 || !result.stdout) return [];
  
  const lines = result.stdout.trim().split('\n');
  const devices: NPUDevice[] = [];
  
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const parts = line.split(/\s+/);
    if (parts.length >= 2) {
      const id = parseInt(parts[0], 10);
      if (!isNaN(id)) {
        devices.push({
          id,
          name: parts.slice(1).join(' ')
        });
      }
    }
  }
  
  return devices;
}

export async function parseChipList(result: CommandResult): Promise<NPUChip[]> {
  if (result.code !== 0 || !result.stdout) return [];
  
  const lines = result.stdout.trim().split('\n');
  const chips: NPUChip[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.includes('NPU ID')) continue;
    
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 4) {
      const npuId = parseInt(parts[0], 10);
      const chipId = parseInt(parts[1], 10);
      if (!isNaN(npuId) && !isNaN(chipId)) {
        const chipName = parts.slice(3).join(' ');
        if (chipName.toLowerCase() !== 'mcu') {
          chips.push({
            npuId,
            chipId,
            name: chipName,
            health: 'OK'
          });
        }
      }
    }
  }
  
  return chips;
}

export async function parseBoardInfo(result: CommandResult, npuId: number): Promise<NPUBordInfo | null> {
  if (result.code !== 0 || !result.stdout) return null;
  
  const lines = result.stdout.trim().split('\n');
  let name = '';
  let health = '';
  let firmwareVersion = '';
  let softwareVersion = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes('NPU Name') || trimmed.includes('Name')) {
      const match = trimmed.match(/:\s*(.+)/);
      if (match) name = match[1].trim();
    } else if (trimmed.includes('Health')) {
      const match = trimmed.match(/:\s*(.+)/);
      if (match) health = match[1].trim();
    } else if (trimmed.includes('Firmware Version')) {
      const match = trimmed.match(/:\s*(.+)/);
      if (match) firmwareVersion = match[1].trim();
    } else if (trimmed.includes('Software Version') || trimmed.includes('Version')) {
      const match = trimmed.match(/:\s*(.+)/);
      if (match) softwareVersion = match[1].trim();
    }
  }
  
  return {
    npuId,
    name,
    health,
    firmwareVersion,
    softwareVersion
  };
}

export async function parseTemperature(result: CommandResult, npuId: number, chipId: number): Promise<NPUTemperature | null> {
  if (result.code !== 0 || !result.stdout) return null;
  
  const lines = result.stdout.trim().split('\n');
  let npuTemp = 0;
  let aiCoreTemp = 0;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes('NPU Temperature') || trimmed.includes('HBM Temperature')) {
      const match = trimmed.match(/:\s*([\d.]+)/);
      if (match) npuTemp = Math.round(parseFloat(match[1]));
    } else if (trimmed.includes('AI Core Temperature')) {
      const match = trimmed.match(/:\s*([\d.]+)/);
      if (match) aiCoreTemp = Math.round(parseFloat(match[1]));
    }
  }
  
  return { npuId, chipId, npuTemp, aiCoreTemp };
}

export async function parsePower(result: CommandResult, npuId: number, chipId: number): Promise<NPUPower | null> {
  if (result.code !== 0 || !result.stdout) return null;
  
  const lines = result.stdout.trim().split('\n');
  let powerUsage = 0;
  let powerLimit = 0;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes('Power Usage') || trimmed.includes('Real-time Power')) {
      const match = trimmed.match(/:\s*([\d.]+)/);
      if (match) powerUsage = Math.round(parseFloat(match[1]));
    } else if (trimmed.includes('Power Limit') || trimmed.includes('Power Cap')) {
      const match = trimmed.match(/:\s*([\d.]+)/);
      if (match) powerLimit = Math.round(parseFloat(match[1]));
    }
  }
  
  return { npuId, chipId, powerUsage, powerLimit };
}

export async function parseCommon(result: CommandResult, npuId: number): Promise<{ hbmUsageRate: number }> {
  if (result.code !== 0 || !result.stdout) {
    return { hbmUsageRate: 0 };
  }
  
  const lines = result.stdout.trim().split('\n');
  let hbmUsageRate = 0;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes('HBM')) {
      const match = trimmed.match(/(\d+)/);
      if (match) {
        hbmUsageRate = parseInt(match[1], 10);
      }
    }
  }
  
  return { hbmUsageRate };
}

export async function parseMemory(result: CommandResult, npuId: number, chipId: number, hbmUsageRate: number = 0): Promise<NPUMemory | null> {
  if (result.code !== 0 || !result.stdout) return null;
  
  const lines = result.stdout.trim().split('\n');
  let memoryUsage = 0;
  let memoryTotal = 0;
  let memoryUsageRate = 0;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes('Memory Usage') && !trimmed.includes('Rate')) {
      const match = trimmed.match(/:\s*([\d.]+)/);
      if (match) memoryUsage = parseInt(match[1], 10);
    } else if (trimmed.includes('Memory Total') || trimmed.includes('HBM Capacity')) {
      const match = trimmed.match(/:\s*([\d.]+)/);
      if (match) memoryTotal = parseInt(match[1], 10);
    } else if (trimmed.includes('Memory Usage Rate') || (trimmed.includes('Usage Rate') && !trimmed.includes('HBM'))) {
      const match = trimmed.match(/:\s*([\d.]+)/);
      if (match) memoryUsageRate = parseInt(match[1], 10);
    }
  }
  
  return { npuId, chipId, memoryUsage, memoryTotal, memoryUsageRate, hbmUsageRate };
}

export async function parseUsage(result: CommandResult, npuId: number, chipId: number): Promise<NPUUsage | null> {
  if (result.code !== 0 || !result.stdout) return null;
  
  const lines = result.stdout.trim().split('\n');
  let aiCoreUsage = 0;
  let memoryUsage = 0;
  let bandwidthUsage = 0;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes('AI Core Usage') || trimmed.includes('AICore Usage')) {
      const match = trimmed.match(/(\d+)/);
      if (match) aiCoreUsage = parseInt(match[1], 10);
    } else if (trimmed.includes('Memory Usage')) {
      const match = trimmed.match(/(\d+)/);
      if (match) memoryUsage = parseInt(match[1], 10);
    } else if (trimmed.includes('Bandwidth')) {
      const match = trimmed.match(/(\d+)/);
      if (match) bandwidthUsage = parseInt(match[1], 10);
    }
  }
  
  return { npuId, chipId, aiCoreUsage, memoryUsage, bandwidthUsage };
}

export async function parseProcesses(result: CommandResult, npuId: number, chipId: number): Promise<NPUProcess[]> {
  if (result.code !== 0 || !result.stdout) {
    return [];
  }
  
  if (result.stdout.includes('does not support')) {
    return [];
  }
  
  const lines = result.stdout.trim().split('\n');
  const processes: NPUProcess[] = [];
  
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const parts = line.split(/\s+/);
    if (parts.length >= 2) {
      const pid = parseInt(parts[0], 10);
      if (!isNaN(pid)) {
        processes.push({
          pid,
          processName: parts[1] || '',
          memoryUsage: parts[2] ? parseInt(parts[2], 10) : 0,
          aiCoreUsage: parts[3] ? parseInt(parts[3], 10) : 0,
          npuId
        });
      }
    }
  }
  
  return processes;
}

export async function parseNpuInfo(result: CommandResult): Promise<NPUProcess[]> {
  if (result.code !== 0 || !result.stdout) {
    return [];
  }
  
  const processes: NPUProcess[] = [];
  const lines = result.stdout.trim().split('\n');
  const collectedPids = new Set<number>();
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
      continue;
    }
    
    if (trimmed.includes('NPU') && trimmed.includes('Chip') && trimmed.includes('Process id')) {
      continue;
    }
    
    if (trimmed.includes('0000:') && trimmed.includes('/')) {
      continue;
    }
    
    const parts = trimmed.split('|').map(p => p.trim()).filter(p => p);
    
    if (parts.length >= 3) {
      const npuChipParts = parts[0].split(/\s+/).filter(p => p);
      const npuId = parseInt(npuChipParts[0], 10);
      const pid = parseInt(parts[1], 10);
      const processName = parts[2];
      const memoryUsage = parts.length >= 4 ? parseInt(parts[3], 10) : 0;
      
      if (!isNaN(npuId) && npuId >= 0 && !isNaN(pid) && pid > 0 && processName && !collectedPids.has(pid)) {
        collectedPids.add(pid);
        processes.push({
          pid,
          processName,
          memoryUsage: memoryUsage || 0,
          aiCoreUsage: 0,
          npuId
        });
      }
    }
  }
  
  return processes;
}

export async function getProcessesAlternative(
  executeCmd: (cmd: string) => Promise<CommandResult>
): Promise<NPUProcess[]> {
  const processes: NPUProcess[] = [];
  const collectedPids = new Set<number>();
  
  const uniqueNpuIds = [0, 1, 2, 3, 4, 5, 6, 7];
  for (const npuId of uniqueNpuIds) {
    const devicePath = `/dev/davinci${npuId}`;
    const fuserResult = await executeCmd(`fuser ${devicePath} 2>/dev/null`);
    if (fuserResult.code === 0 && fuserResult.stdout.trim()) {
      const pids = fuserResult.stdout.trim().split(/\s+/).filter(p => /^\d+$/.test(p));
      for (const pidStr of pids) {
        const pid = parseInt(pidStr, 10);
        if (!isNaN(pid) && !collectedPids.has(pid)) {
          collectedPids.add(pid);
          const procResult = await executeCmd(`ps -p ${pid} -o comm= 2>/dev/null || echo "unknown"`);
          processes.push({
            pid,
            processName: procResult.stdout.trim() || 'unknown',
            memoryUsage: 0,
            aiCoreUsage: 0,
            npuId
          });
        }
      }
    }
  }
  
  const ascendPids = await executeCmd(`ps aux | grep -E 'ascend|npu|davinci|torch_npu|mindspore|pytorch|python.*train' | grep -v grep | awk '{print $2}' | head -50`);
  if (ascendPids.code === 0 && ascendPids.stdout.trim()) {
    const pids = ascendPids.stdout.trim().split(/\n/).filter(p => /^\d+$/.test(p));
    for (const pidStr of pids) {
      const pid = parseInt(pidStr, 10);
      if (!isNaN(pid) && !collectedPids.has(pid)) {
        collectedPids.add(pid);
        const procResult = await executeCmd(`ps -p ${pid} -o comm= 2>/dev/null || echo "unknown"`);
        processes.push({
          pid,
          processName: procResult.stdout.trim() || 'unknown',
          memoryUsage: 0,
          aiCoreUsage: 0,
          npuId: -1
        });
      }
    }
  }
  
  return processes;
}

export async function parseECC(result: CommandResult, npuId: number, chipId: number): Promise<NPUECC | null> {
  if (result.code !== 0 || !result.stdout) return null;
  
  const lines = result.stdout.trim().split('\n');
  let eccErrorCount = 0;
  let eccMode = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes('ECC Error Count') || trimmed.includes('Error Count')) {
      const match = trimmed.match(/(\d+)/);
      if (match) eccErrorCount = parseInt(match[1], 10);
    } else if (trimmed.includes('ECC Mode')) {
      const match = trimmed.match(/:\s*(.+)/);
      if (match) eccMode = match[1].trim();
    }
  }
  
  return { npuId, chipId, eccErrorCount, eccMode };
}

async function retryCommand(
  executeCmd: (cmd: string) => Promise<CommandResult>,
  cmd: string,
  maxRetries: number = DEFAULT_COMMAND_RETRIES
): Promise<CommandResult> {
  let lastError: Error | null = null;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await executeCmd(cmd);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error('Unknown error');
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
  return { stdout: '', stderr: lastError?.message || 'Max retries exceeded', code: 1 };
}

async function getChipData(
  executeCmd: (cmd: string) => Promise<CommandResult>,
  chip: NPUChip
): Promise<{
  board: NPUBordInfo | null;
  temp: NPUTemperature | null;
  pwr: NPUPower | null;
  mem: NPUMemory | null;
  usg: NPUUsage | null;
  eccInfo: NPUECC | null;
}> {
  const [boardResult, tempResult, pwrResult, memResult, usgResult, eccResult, commonResult] = await Promise.all([
    retryCommand(executeCmd, `npu-smi info -t board -i ${chip.npuId}`),
    retryCommand(executeCmd, `npu-smi info -t temp -i ${chip.npuId} -c ${chip.chipId}`),
    retryCommand(executeCmd, `npu-smi info -t power -i ${chip.npuId} -c ${chip.chipId}`),
    retryCommand(executeCmd, `npu-smi info -t memory -i ${chip.npuId} -c ${chip.chipId}`),
    retryCommand(executeCmd, `npu-smi info -t usages -i ${chip.npuId} -c ${chip.chipId}`),
    retryCommand(executeCmd, `npu-smi info -t ecc -i ${chip.npuId} -c ${chip.chipId}`),
    retryCommand(executeCmd, `npu-smi info -t common -i ${chip.npuId}`)
  ]);

  const commonInfo = await parseCommon(commonResult, chip.npuId);
  
  const [board, temp, pwr, mem, usg, eccInfo] = await Promise.all([
    parseBoardInfo(boardResult, chip.npuId),
    parseTemperature(tempResult, chip.npuId, chip.chipId),
    parsePower(pwrResult, chip.npuId, chip.chipId),
    parseMemory(memResult, chip.npuId, chip.chipId, commonInfo.hbmUsageRate),
    parseUsage(usgResult, chip.npuId, chip.chipId),
    parseECC(eccResult, chip.npuId, chip.chipId)
  ]);

  return { board, temp, pwr, mem, usg, eccInfo };
}

export async function getFullSummary(
  executeCmd: (cmd: string) => Promise<CommandResult>
): Promise<NPUSummary> {
  const [devicesResult, chipsResult, npuInfoResult] = await Promise.all([
    retryCommand(executeCmd, 'npu-smi info -l'),
    retryCommand(executeCmd, 'npu-smi info -m'),
    retryCommand(executeCmd, 'npu-smi info')
  ]);
  
  const devices = await parseDeviceList(devicesResult);
  const chips = await parseChipList(chipsResult);
  
  const boardInfo: NPUBordInfo[] = [];
  const temperatures: NPUTemperature[] = [];
  const power: NPUPower[] = [];
  const memory: NPUMemory[] = [];
  const usage: NPUUsage[] = [];
  const ecc: NPUECC[] = [];

  for (const chip of chips) {
    const data = await getChipData(executeCmd, chip);
    if (data.board) boardInfo.push(data.board);
    if (data.temp) temperatures.push(data.temp);
    if (data.pwr) power.push(data.pwr);
    if (data.mem) memory.push(data.mem);
    if (data.usg) usage.push(data.usg);
    if (data.eccInfo) ecc.push(data.eccInfo);
  }

  const processes: NPUProcess[] = [];
  const collectedPids = new Set<number>();
  
  const npuInfoProcesses = await parseNpuInfo(npuInfoResult);
  for (const proc of npuInfoProcesses) {
    if (!collectedPids.has(proc.pid)) {
      collectedPids.add(proc.pid);
      processes.push(proc);
    }
  }
  
  if (processes.length === 0) {
    const uniqueNpuIds = [...new Set(chips.map(c => c.npuId))];
    for (const npuId of uniqueNpuIds) {
      const procResult = await retryCommand(executeCmd, `npu-smi info proc -i ${npuId}`);
      const npuProcesses = await parseProcesses(procResult, npuId, 0);
      
      for (const proc of npuProcesses) {
        if (!collectedPids.has(proc.pid)) {
          collectedPids.add(proc.pid);
          processes.push(proc);
        }
      }
    }
  }
  
  if (processes.length === 0) {
    const altProcesses = await getProcessesAlternative(executeCmd);
    for (const proc of altProcesses) {
      if (!collectedPids.has(proc.pid)) {
        collectedPids.add(proc.pid);
        processes.push(proc);
      }
    }
  }

  return {
    devices,
    chips,
    boardInfo,
    temperatures,
    power,
    memory,
    usage,
    processes,
    ecc,
    lastUpdated: Date.now()
  };
}
