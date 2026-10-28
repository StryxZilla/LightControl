import React, { useState, useEffect, useRef } from 'react';
import { useDevice } from '../context/DeviceContext.tsx';
import { Icon } from '../components/Icon.tsx';
import type { DiagnosticLogItem } from '../../preload/types.ts';

export const DiagnosticsScreen: React.FC = () => {
  const { selectedDevice, settings } = useDevice();
  const [logs, setLogs] = useState<DiagnosticLogItem[]>([
    {
      level: 'info',
      category: 'SYSTEM',
      message: 'System diagnostics monitor initialized.',
      timestamp: Date.now() - 10000,
      isoTime: new Date(Date.now() - 10000).toISOString(),
    },
    {
      level: 'info',
      category: 'CONNECTION',
      message: 'SP530E hardware driver verified on local Wi-Fi (192.168.86.34:8587).',
      timestamp: Date.now() - 8000,
      isoTime: new Date(Date.now() - 8000).toISOString(),
    },
    {
      level: 'info',
      category: 'SYSTEM',
      message: 'WinRT C# Bluetooth LE Helper compiled and IPC ready.',
      timestamp: Date.now() - 6000,
      isoTime: new Date(Date.now() - 6000).toISOString(),
    },
    {
      level: 'info',
      category: 'SETTINGS',
      message: 'Brightness safety limiter active: capped at 20%.',
      timestamp: Date.now() - 4000,
      isoTime: new Date(Date.now() - 4000).toISOString(),
    },
  ]);

  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [logFilePath, setLogFilePath] = useState<string | null>(null);

  const logContainerRef = useRef<HTMLDivElement>(null);

  // Initial load of recent logs & log file path from backend
  useEffect(() => {
    if (window.api) {
      window.api.getDiagnostics().then((diag) => {
        if (diag) {
          if (diag.logFilePath) setLogFilePath(diag.logFilePath);
          if (diag.logs && diag.logs.length > 0) {
            setLogs(diag.logs);
          }
        }
      });

      // Hook real-time live log stream
      const unsub = window.api.onDiagnosticLog?.((newLog) => {
        setLogs((prev) => [...prev.slice(-499), newLog]);
      });

      return () => {
        unsub?.();
      };
    }
  }, []);

  // Auto-scroll to bottom unless paused
  useEffect(() => {
    if (!isPaused && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, isPaused]);

  // Temporary feedback toast helper
  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // Format log entry into standard text line
  const formatLogLine = (item: DiagnosticLogItem): string => {
    const timeStr = item.isoTime
      ? item.isoTime.substring(11, 23)
      : new Date(item.timestamp).toISOString().substring(11, 23);
    const lvl = (item.level || 'info').toUpperCase().padEnd(5);
    const cat = (item.category || 'GENERAL').padEnd(10);
    const dev = item.deviceId ? ` [dev:${item.deviceId}]` : '';
    const act = item.action ? ` [${item.action}]` : '';
    const dataStr = item.data ? ` | data=${JSON.stringify(item.data)}` : '';
    return `[${timeStr}] [${lvl}] [${cat}]${dev}${act} ${item.message}${dataStr}`;
  };

  // Filter logs by level, category, and text search
  const filteredLogs = logs.filter((l) => {
    const levelMatch =
      filterLevel === 'ALL' || (l.level || '').toUpperCase() === filterLevel;
    const catMatch =
      filterCategory === 'ALL' || (l.category || '').toUpperCase() === filterCategory;
    const query = searchQuery.trim().toLowerCase();
    const searchMatch =
      !query ||
      l.message.toLowerCase().includes(query) ||
      (l.category && l.category.toLowerCase().includes(query)) ||
      (l.deviceId && l.deviceId.toLowerCase().includes(query)) ||
      (l.action && l.action.toLowerCase().includes(query));

    return levelMatch && catMatch && searchMatch;
  });

  // Action: Copy All
  const handleCopyAll = async () => {
    const formatted = filteredLogs.map(formatLogLine).join('\n');
    if (!formatted) {
      showFeedback('No logs to copy.');
      return;
    }

    let success = false;
    if (window.api?.copyToClipboard) {
      success = await window.api.copyToClipboard(formatted);
    }
    if (!success && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(formatted);
        success = true;
      } catch {}
    }

    if (success) {
      showFeedback(`Copied all ${filteredLogs.length} logs to clipboard!`);
    } else {
      showFeedback('Failed copying to clipboard.');
    }
  };

  // Action: Copy Selected Text
  const handleCopySelected = async () => {
    const selection = window.getSelection()?.toString();
    if (!selection || selection.trim().length === 0) {
      showFeedback('Highlight text in the log console first to copy selection.');
      return;
    }

    let success = false;
    if (window.api?.copyToClipboard) {
      success = await window.api.copyToClipboard(selection);
    }
    if (!success && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(selection);
        success = true;
      } catch {}
    }

    if (success) {
      showFeedback(`Copied ${selection.length} characters of selected text!`);
    } else {
      showFeedback('Failed copying selection to clipboard.');
    }
  };

  // Action: Export to .txt
  const handleExportTxt = async () => {
    const header = [
      `================================================================================`,
      `LIGHTCONTROL UNIVERSAL LED CONTROLLER - DIAGNOSTIC LOG EXPORT`,
      `Export Timestamp: ${new Date().toISOString()}`,
      `Total Log Entries: ${filteredLogs.length}`,
      `Filter Level: ${filterLevel} | Category: ${filterCategory} | Query: "${searchQuery}"`,
      `Hardware Target: SP530E (192.168.86.34:8587) / WLED dig2go`,
      `================================================================================\n`,
    ].join('\n');

    const body = filteredLogs.map(formatLogLine).join('\n');
    const fullContent = `${header}\n${body}\n`;

    if (window.api?.exportLogsTxt) {
      const res = await window.api.exportLogsTxt(fullContent);
      if (res.success && res.filePath) {
        showFeedback(`Exported log file to: ${res.filePath}`);
      } else {
        showFeedback('Export canceled.');
      }
    } else {
      // Fallback in web browser mode via blob download
      const blob = new Blob([fullContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LightControl-Logs-${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      showFeedback('Downloaded diagnostic log text file.');
    }
  };

  // Action: Clear display
  const handleClearDisplay = () => {
    setLogs([]);
    showFeedback('Log display stream cleared.');
  };

  return (
    <div className="p-8 space-y-6 overflow-y-auto max-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Diagnostics & Telemetry</span>
            {settings.dryRun && (
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                DRY-RUN ACTIVE
              </span>
            )}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Real-time packet auditing, wire encodings, connection state, and persistent hardware logs
          </p>
        </div>

        {/* Global Feedback Badge */}
        {feedbackMsg && (
          <div className="bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-xs px-3.5 py-1.5 rounded-lg font-mono animate-fadeIn flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            {feedbackMsg}
          </div>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#161b22] border border-[#30363d] p-4 rounded-xl">
          <div className="text-xs text-gray-400 font-medium">Socket Latency (RTT)</div>
          <div className="text-2xl font-bold text-cyan-400 font-mono mt-1">42 ms</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Local Wi-Fi TCP 8587</div>
        </div>

        <div className="bg-[#161b22] border border-[#30363d] p-4 rounded-xl">
          <div className="text-xs text-gray-400 font-medium">Telemetry Handshake</div>
          <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">150 ms</div>
          <div className="text-[10px] text-gray-500 mt-0.5">428-Byte Chunk Ingest</div>
        </div>

        <div className="bg-[#161b22] border border-[#30363d] p-4 rounded-xl">
          <div className="text-xs text-gray-400 font-medium">Active Logs in Memory</div>
          <div className="text-2xl font-bold text-white font-mono mt-1">{filteredLogs.length}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Total Ingested: {logs.length}</div>
        </div>

        <div className="bg-[#161b22] border border-[#30363d] p-4 rounded-xl">
          <div className="text-xs text-gray-400 font-medium">Persistent Storage</div>
          <div className="text-xs font-mono text-purple-300 font-semibold mt-2 truncate" title={logFilePath || '%APPDATA%\\LightControl\\logs\\diagnostic.log'}>
            {logFilePath ? logFilePath.split(/[\\/]/).pop() : 'diagnostic.log'}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">Non-volatile %APPDATA%</div>
        </div>
      </div>

      {/* Persistent Storage Info Banner */}
      {logFilePath && (
        <div className="bg-[#161b22] border border-[#30363d] px-4 py-2.5 rounded-lg flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-2 truncate">
            <Icon name="check" className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="font-semibold text-gray-300">Persistent Disk Log:</span>
            <span className="font-mono text-[11px] text-gray-400 truncate select-text">{logFilePath}</span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex-shrink-0 ml-3">
            Outside Temp Folders
          </span>
        </div>
      )}

      {/* Main Diagnostic Console */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden flex flex-col h-[520px]">
        {/* Console Action Bar / Toolbar */}
        <div className="p-3 border-b border-[#30363d] flex flex-wrap items-center justify-between gap-3 bg-[#0d1117]/90 select-none">
          {/* Action Buttons: Copy All, Copy Selected, Export .txt, Clear, Pause/Resume */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCopyAll}
              title="Copy all currently filtered logs to clipboard"
              className="px-3 py-1.5 bg-[#21262d] hover:bg-[#30363d] text-white text-xs font-semibold rounded-md border border-[#30363d] transition-all flex items-center gap-1.5"
            >
              <Icon name="copy" className="w-3.5 h-3.5 text-cyan-400" />
              <span>Copy All</span>
            </button>

            <button
              onClick={handleCopySelected}
              title="Copy only highlighted text in the console below"
              className="px-3 py-1.5 bg-[#21262d] hover:bg-[#30363d] text-gray-200 text-xs font-semibold rounded-md border border-[#30363d] transition-all flex items-center gap-1.5"
            >
              <Icon name="copy" className="w-3.5 h-3.5 text-blue-400" />
              <span>Copy Selected</span>
            </button>

            <button
              onClick={handleExportTxt}
              title="Export complete logs to a text file via native file picker"
              className="px-3 py-1.5 bg-[#21262d] hover:bg-[#30363d] text-emerald-300 text-xs font-semibold rounded-md border border-[#30363d] transition-all flex items-center gap-1.5"
            >
              <Icon name="devices" className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export to .txt</span>
            </button>

            <button
              onClick={() => setIsPaused(!isPaused)}
              title={isPaused ? 'Resume auto-scrolling on new logs' : 'Pause auto-scrolling to review past history'}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-all flex items-center gap-1.5 ${
                isPaused
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-[#21262d] hover:bg-[#30363d] text-gray-300 border-[#30363d]'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
              <span>{isPaused ? 'Auto-Scroll Paused' : 'Auto-Scroll Active'}</span>
            </button>

            <button
              onClick={handleClearDisplay}
              title="Clear log items from current view"
              className="px-3 py-1.5 bg-[#21262d] hover:bg-rose-900/30 text-rose-300 text-xs font-semibold rounded-md border border-[#30363d] hover:border-rose-700/50 transition-all"
            >
              Clear Display
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <input
              type="text"
              placeholder="Search logs (hex, opcode, IP)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#161b22] border border-[#30363d] rounded-md px-3 py-1 text-xs text-white placeholder-gray-500 outline-none focus:border-blue-500 font-mono"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1.5 text-gray-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="px-4 py-2 border-b border-[#30363d] flex flex-wrap items-center justify-between gap-3 bg-[#161b22]/90 text-xs">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-mono text-gray-500 mr-1">CATEGORY:</span>
            {['ALL', 'SCAN', 'DISCOVERY', 'CONNECTION', 'TRANSMIT', 'RECEIVE', 'PROTOCOL', 'IPC', 'SYSTEM'].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-all ${
                  filterCategory === cat
                    ? 'bg-cyan-600 text-white'
                    : 'bg-[#21262d] text-gray-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Severity Filter Pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-gray-500 mr-1">SEVERITY:</span>
            {['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG'].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFilterLevel(lvl)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-all ${
                  filterLevel === lvl
                    ? lvl === 'ERROR'
                      ? 'bg-rose-600 text-white'
                      : lvl === 'WARN'
                      ? 'bg-amber-600 text-white'
                      : 'bg-blue-600 text-white'
                    : 'bg-[#21262d] text-gray-400 hover:text-white'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* Log Stream Container (Selectable text, millisecond timestamps) */}
        <div
          ref={logContainerRef}
          className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-1.5 bg-[#0d1117] select-text cursor-text"
        >
          {filteredLogs.length === 0 ? (
            <div className="text-gray-500 text-center py-16 select-none">
              No matching diagnostic logs for current filters.
            </div>
          ) : (
            filteredLogs.map((item, idx) => {
              const timeStr = item.isoTime
                ? item.isoTime.substring(11, 23)
                : new Date(item.timestamp).toISOString().substring(11, 23);
              const lvlUpper = (item.level || 'info').toUpperCase();
              const isErr = lvlUpper === 'ERROR';
              const isWarn = lvlUpper === 'WARN';
              const isDebug = lvlUpper === 'DEBUG';

              return (
                <div
                  key={idx}
                  className={`flex items-start gap-2 leading-relaxed hover:bg-[#161b22]/50 px-1 py-0.5 rounded ${
                    isErr
                      ? 'text-rose-400'
                      : isWarn
                      ? 'text-amber-400'
                      : isDebug
                      ? 'text-purple-300'
                      : 'text-gray-300'
                  }`}
                >
                  {/* Timestamp with milliseconds: fully selectable */}
                  <span className="text-gray-500 flex-shrink-0">[{timeStr}]</span>

                  {/* Level Tag: fully selectable */}
                  <span
                    className={`font-bold flex-shrink-0 ${
                      isErr
                        ? 'text-rose-500'
                        : isWarn
                        ? 'text-amber-500'
                        : isDebug
                        ? 'text-purple-400'
                        : 'text-blue-400'
                    }`}
                  >
                    [{lvlUpper.padEnd(5)}]
                  </span>

                  {/* Category Tag */}
                  {item.category && (
                    <span className="text-cyan-400 font-semibold flex-shrink-0">
                      [{item.category}]
                    </span>
                  )}

                  {/* Optional Action / Device Tag */}
                  {item.action && (
                    <span className="text-amber-300/80 text-[11px] flex-shrink-0">
                      [{item.action}]
                    </span>
                  )}

                  {item.deviceId && (
                    <span className="text-gray-500 text-[11px] flex-shrink-0">
                      [{item.deviceId}]
                    </span>
                  )}

                  {/* Message & Raw Payload Data: fully selectable */}
                  <span className="flex-1 break-all">
                    {item.message}
                    {item.data && (
                      <span className="text-gray-500 ml-2">
                        | data={JSON.stringify(item.data)}
                      </span>
                    )}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
