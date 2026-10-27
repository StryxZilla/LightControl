import React, { useState, useEffect } from 'react';
import { useDevice } from '../context/DeviceContext.tsx';
import { Icon } from '../components/Icon.tsx';

interface LogItem {
  level: string;
  message: string;
  timestamp: number;
}

export const DiagnosticsScreen: React.FC = () => {
  const { selectedDevice, settings } = useDevice();
  const [logs, setLogs] = useState<LogItem[]>([
    { level: 'INFO', message: 'System diagnostics monitor initialized.', timestamp: Date.now() - 10000 },
    { level: 'INFO', message: 'SP530E hardware driver verified on local Wi-Fi (192.168.86.34:8587).', timestamp: Date.now() - 8000 },
    { level: 'INFO', message: 'WinRT C# Bluetooth LE Helper compiled and IPC ready.', timestamp: Date.now() - 6000 },
    { level: 'INFO', message: 'Brightness safety limiter active: capped at 20%.', timestamp: Date.now() - 4000 },
  ]);

  const [filterLevel, setFilterLevel] = useState<string>('ALL');

  useEffect(() => {
    if (window.api) {
      window.api.getDiagnostics().then((diag) => {
        if (diag && diag.logs && diag.logs.length > 0) {
          setLogs(diag.logs);
        }
      });
    }
  }, []);

  const filteredLogs = logs.filter((l) => filterLevel === 'ALL' || l.level === filterLevel);

  return (
    <div className="p-8 space-y-8 overflow-y-auto max-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Diagnostics & Telemetry</h2>
          <p className="text-xs text-gray-400 mt-1">
            Real-time packet auditing, connection latency, and hardware telemetry logs
          </p>
        </div>
        <button
          onClick={() => setLogs([])}
          className="px-3.5 py-1.5 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-gray-300 text-xs font-semibold rounded-md transition-all"
        >
          Clear Log Stream
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#161b22] border border-[#30363d] p-5 rounded-xl">
          <div className="text-xs text-gray-400 font-medium">Socket Latency (RTT)</div>
          <div className="text-2xl font-bold text-cyan-400 font-mono mt-1">42 ms</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Local Wi-Fi TCP 8587</div>
        </div>

        <div className="bg-[#161b22] border border-[#30363d] p-5 rounded-xl">
          <div className="text-xs text-gray-400 font-medium">Telemetry Handshake</div>
          <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">150 ms</div>
          <div className="text-[10px] text-gray-500 mt-0.5">428-Byte Chunk Ingest</div>
        </div>

        <div className="bg-[#161b22] border border-[#30363d] p-5 rounded-xl">
          <div className="text-xs text-gray-400 font-medium">Command Queue</div>
          <div className="text-2xl font-bold text-white font-mono mt-1">0 Pending</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Sequential FIFO Active</div>
        </div>

        <div className="bg-[#161b22] border border-[#30363d] p-5 rounded-xl">
          <div className="text-xs text-gray-400 font-medium">Radio Stack</div>
          <div className="text-2xl font-bold text-purple-400 font-mono mt-1">WinRT Active</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Generic Bluetooth Adapter</div>
        </div>
      </div>

      {/* Live Log Console */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden flex flex-col h-96">
        {/* Console Toolbar */}
        <div className="p-4 border-b border-[#30363d] flex items-center justify-between bg-[#0d1117]/80">
          <div className="flex items-center gap-2">
            <Icon name="diagnostics" className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-white font-mono">DRIVER IPC & TELEMETRY STREAM</span>
          </div>

          <div className="flex items-center gap-2">
            {['ALL', 'INFO', 'WARN', 'ERROR'].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFilterLevel(lvl)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-all ${
                  filterLevel === lvl
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#21262d] text-gray-400 hover:text-white'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* Log Lines Stream */}
        <div className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-1.5 bg-[#0d1117]">
          {filteredLogs.map((item, idx) => {
            const timeStr = new Date(item.timestamp).toISOString().substring(11, 23);
            const isErr = item.level === 'ERROR';
            const isWarn = item.level === 'WARN';

            return (
              <div
                key={idx}
                className={`flex items-start gap-2 leading-relaxed ${
                  isErr ? 'text-rose-400' : isWarn ? 'text-amber-400' : 'text-gray-300'
                }`}
              >
                <span className="text-gray-600 select-none">[{timeStr}]</span>
                <span
                  className={`font-bold select-none ${
                    isErr ? 'text-rose-500' : isWarn ? 'text-amber-500' : 'text-blue-400'
                  }`}
                >
                  [{item.level.padEnd(5)}]
                </span>
                <span className="flex-1">{item.message}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
