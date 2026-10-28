import * as fs from 'node:fs';
import * as path from 'node:path';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface DiagnosticLogEntry {
  timestamp: number;
  isoTime: string;
  level: LogLevel;
  category: string;
  action?: string;
  deviceId?: string;
  transport?: string;
  message: string;
  data?: any;
}

export interface DeviceTelemetryStats {
  deviceId: string;
  connected: boolean;
  connectedSince?: number;
  packetsSent: number;
  bytesSent: number;
  packetsReceived: number;
  bytesReceived: number;
  averageLatencyMs: number;
  lastLatencyMs?: number;
  errorCount: number;
  lastError?: string;
  lastErrorTimestamp?: number;
}

/**
 * Redacts sensitive fields (passwords, tokens, keys) from logged data.
 */
export function redactSensitiveData(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveData(item));
  }

  const sensitiveKeys = ['password', 'pwd', 'token', 'auth', 'secret', 'key', 'credential', 'ssid_pwd'];
  const sanitized: Record<string, any> = {};

  for (const [k, v] of Object.entries(obj)) {
    const isSensitive = sensitiveKeys.some((s) => k.toLowerCase().includes(s));
    if (isSensitive && typeof v === 'string') {
      sanitized[k] = '[REDACTED]';
    } else if (typeof v === 'object') {
      sanitized[k] = redactSensitiveData(v);
    } else {
      sanitized[k] = v;
    }
  }

  return sanitized;
}

/**
 * Central Diagnostics & Telemetry Service with Persistent Structured Logging
 */
export class DiagnosticsService {
  private logs: DiagnosticLogEntry[] = [];
  private stats = new Map<string, DeviceTelemetryStats>();
  private listeners = new Set<(entry: DiagnosticLogEntry) => void>();
  private readonly maxLogs: number;
  private logFilePath: string | null = null;

  constructor(maxLogs = 1000, logFilePath?: string) {
    this.maxLogs = maxLogs;
    if (logFilePath) {
      this.setLogFilePath(logFilePath);
    }
  }

  setLogFilePath(filePath: string): void {
    try {
      this.logFilePath = path.resolve(filePath);
      fs.mkdirSync(path.dirname(this.logFilePath), { recursive: true });
    } catch (err: any) {
      console.error(`Failed to initialize diagnostic log file at ${filePath}:`, err.message);
    }
  }

  getLogFilePath(): string | null {
    return this.logFilePath;
  }

  log(
    level: LogLevel,
    category: string,
    message: string,
    data?: any,
    extra?: { action?: string; deviceId?: string; transport?: string }
  ): void {
    const now = Date.now();
    const isoTime = new Date(now).toISOString();
    const sanitizedData = data !== undefined ? redactSensitiveData(data) : undefined;

    const entry: DiagnosticLogEntry = {
      timestamp: now,
      isoTime,
      level,
      category,
      action: extra?.action,
      deviceId: extra?.deviceId,
      transport: extra?.transport,
      message,
      data: sanitizedData,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Persist to file if logFilePath is configured
    if (this.logFilePath) {
      try {
        const actionStr = extra?.action ? ` [${extra.action}]` : '';
        const devStr = extra?.deviceId ? ` [dev:${extra.deviceId}]` : '';
        const dataStr = sanitizedData ? ` | data=${JSON.stringify(sanitizedData)}` : '';
        const line = `[${isoTime}] [${level.toUpperCase().padEnd(5)}] [${category}]${actionStr}${devStr} ${message}${dataStr}\n`;
        fs.appendFileSync(this.logFilePath, line, 'utf8');
      } catch {
        // Fallback gracefully without breaking main process
      }
    }

    // Notify live in-process listeners
    for (const listener of this.listeners) {
      try {
        listener(entry);
      } catch {}
    }
  }

  onLog(listener: (entry: DiagnosticLogEntry) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Convenience methods for Phase 2 diagnostic tracing
  logScan(action: 'START' | 'STOP', transport: string, details?: any): void {
    this.log('info', 'SCAN', `Scan ${action} on transport: ${transport}`, details, {
      action,
      transport,
    });
  }

  logDeviceDiscovered(device: { id: string; name: string; transport: string; address: string; rssi?: number }): void {
    this.log('info', 'DISCOVERY', `Device discovered: ${device.name} (${device.address})`, device, {
      action: 'DISCOVERED',
      deviceId: device.id,
      transport: device.transport,
    });
  }

  logDeviceUpdated(device: { id: string; state?: string; lastSeen?: number }): void {
    this.log('debug', 'DISCOVERY', `Device updated: ${device.id}`, device, {
      action: 'UPDATED',
      deviceId: device.id,
    });
  }

  logDeviceRemoved(deviceId: string, reason?: string): void {
    this.log('warn', 'DISCOVERY', `Device removed: ${deviceId} (${reason || 'stale/offline'})`, { reason }, {
      action: 'REMOVED',
      deviceId,
    });
  }

  logConnectionAttempt(deviceId: string, transport: string, address: string): void {
    this.log('info', 'CONNECTION', `Attempting connection to ${deviceId} via ${transport} at ${address}`, { address }, {
      action: 'CONNECT_ATTEMPT',
      deviceId,
      transport,
    });
  }

  logConnectionResult(deviceId: string, success: boolean, transport: string, error?: string): void {
    if (success) {
      this.recordConnection(deviceId, true);
      this.log('info', 'CONNECTION', `Successfully connected to ${deviceId} via ${transport}`, undefined, {
        action: 'CONNECT_SUCCESS',
        deviceId,
        transport,
      });
    } else {
      this.recordError(deviceId, error || 'Connection failed');
      this.log('error', 'CONNECTION', `Failed connecting to ${deviceId} via ${transport}: ${error}`, { error }, {
        action: 'CONNECT_FAILED',
        deviceId,
        transport,
      });
    }
  }

  logDisconnect(deviceId: string, reason?: string): void {
    this.recordConnection(deviceId, false);
    this.log('info', 'CONNECTION', `Device disconnected: ${deviceId} (${reason || 'user/socket closed'})`, { reason }, {
      action: 'DISCONNECTED',
      deviceId,
    });
  }

  logCommandEncoded(deviceId: string, opcode: string, frameHex: string, parsedDetails?: any): void {
    this.log('debug', 'PROTOCOL', `Command encoded [${opcode}] for ${deviceId}: ${frameHex}`, parsedDetails, {
      action: 'ENCODE_COMMAND',
      deviceId,
    });
  }

  logCommandTransmitted(deviceId: string, opcode: string, frameHex: string, bytesLength: number): void {
    this.recordPacketSent(deviceId, bytesLength);
    this.log('info', 'TRANSMIT', `Transmitted [${opcode}] (${bytesLength}B) to ${deviceId}: ${frameHex}`, { bytesLength }, {
      action: 'TRANSMITTED',
      deviceId,
    });
  }

  logDeviceResponse(deviceId: string, responseHex: string, latencyMs?: number): void {
    this.recordPacketReceived(deviceId, responseHex.length / 2, latencyMs);
    this.log('info', 'RECEIVE', `Received response from ${deviceId} (${latencyMs ?? 0}ms): ${responseHex.slice(0, 64)}...`, { latencyMs }, {
      action: 'RESPONSE_RECEIVED',
      deviceId,
    });
  }

  recordConnection(deviceId: string, connected: boolean): void {
    const st = this.getOrCreateStats(deviceId);
    st.connected = connected;
    if (connected) {
      st.connectedSince = Date.now();
    }
  }

  recordPacketSent(deviceId: string, byteCount: number): void {
    const st = this.getOrCreateStats(deviceId);
    st.packetsSent++;
    st.bytesSent += byteCount;
  }

  recordPacketReceived(deviceId: string, byteCount: number, latencyMs?: number): void {
    const st = this.getOrCreateStats(deviceId);
    st.packetsReceived++;
    st.bytesReceived += byteCount;
    if (latencyMs !== undefined) {
      st.lastLatencyMs = latencyMs;
      st.averageLatencyMs =
        st.averageLatencyMs === 0 ? latencyMs : Math.round((st.averageLatencyMs * 0.8 + latencyMs * 0.2) * 10) / 10;
    }
  }

  recordError(deviceId: string, error: string): void {
    const st = this.getOrCreateStats(deviceId);
    st.errorCount++;
    st.lastError = error;
    st.lastErrorTimestamp = Date.now();
  }

  private getOrCreateStats(deviceId: string): DeviceTelemetryStats {
    let st = this.stats.get(deviceId);
    if (!st) {
      st = {
        deviceId,
        connected: false,
        packetsSent: 0,
        bytesSent: 0,
        packetsReceived: 0,
        bytesReceived: 0,
        averageLatencyMs: 0,
        errorCount: 0,
      };
      this.stats.set(deviceId, st);
    }
    return st;
  }

  getStats(deviceId: string): DeviceTelemetryStats | undefined {
    const st = this.stats.get(deviceId);
    return st ? { ...st } : undefined;
  }

  getAllStats(): DeviceTelemetryStats[] {
    return Array.from(this.stats.values()).map((s) => ({ ...s }));
  }

  getRecentLogs(limit = 100): DiagnosticLogEntry[] {
    return this.logs.slice(-limit);
  }

  exportDiagnosticReport(): string {
    return JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        logFilePath: this.logFilePath,
        deviceStats: this.getAllStats(),
        recentLogs: this.getRecentLogs(200),
      },
      null,
      2
    );
  }

  clear(): void {
    this.logs = [];
    this.stats.clear();
  }
}
