export type LogLevel = 'info' | 'warn' | 'error';

export interface DiagnosticLogEntry {
  timestamp: number;
  level: LogLevel;
  category: string;
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
 * Central Diagnostics & Telemetry Service
 */
export class DiagnosticsService {
  private logs: DiagnosticLogEntry[] = [];
  private stats = new Map<string, DeviceTelemetryStats>();
  private readonly maxLogs: number;

  constructor(maxLogs = 500) {
    this.maxLogs = maxLogs;
  }

  log(level: LogLevel, category: string, message: string, data?: any): void {
    const entry: DiagnosticLogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  recordConnection(deviceId: string, connected: boolean): void {
    const st = this.getOrCreateStats(deviceId);
    st.connected = connected;
    if (connected) {
      st.connectedSince = Date.now();
    }
    this.log('info', 'connection', `Device ${deviceId} connection status: ${connected}`);
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
    this.log('error', 'device', `Error on ${deviceId}: ${error}`);
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

  getRecentLogs(limit = 50): DiagnosticLogEntry[] {
    return this.logs.slice(-limit);
  }

  exportDiagnosticReport(): string {
    return JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        deviceStats: this.getAllStats(),
        recentLogs: this.getRecentLogs(100),
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
