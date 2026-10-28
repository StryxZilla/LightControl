import React from 'react';
import { useDevice } from '../context/DeviceContext.tsx';
import { Icon } from './Icon.tsx';

export const Header: React.FC = () => {
  const {
    devices,
    selectedDevice,
    setSelectedDeviceId,
    setPower,
    setBrightness,
    startDiscovery,
    isScanning,
    statusMessage,
    settings,
    updateSettings,
  } = useDevice();

  if (!selectedDevice) {
    return (
      <header className="h-16 bg-[#161b22] border-b border-[#30363d] px-6 flex items-center justify-between">
        <div className="text-sm text-gray-400">Searching for controllers...</div>
      </header>
    );
  }

  const isConnected = selectedDevice.connectionInfo.state === 'connected';
  const isPowerOn = selectedDevice.state.power;

  return (
    <header className="h-16 bg-[#161b22] border-b border-[#30363d] px-6 flex items-center justify-between gap-4 select-none">
      {/* Device Selector & Transport Status */}
      <div className="flex items-center gap-3">
        <select
          value={selectedDevice.id}
          onChange={(e) => setSelectedDeviceId(e.target.value)}
          className="bg-[#21262d] border border-[#30363d] text-white text-xs rounded-md px-3 py-1.5 font-medium outline-none focus:border-blue-500 cursor-pointer max-w-xs"
        >
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.connectionInfo.transport.toUpperCase()})
            </option>
          ))}
        </select>

        {/* Transport Type Badge */}
        <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#21262d] text-[11px] font-mono text-gray-300 border border-[#30363d]">
          {selectedDevice.connectionInfo.transport === 'wifi-tcp' || selectedDevice.connectionInfo.transport === 'wifi-http' ? (
            <Icon name="wifi" className="w-3.5 h-3.5 text-cyan-400" />
          ) : selectedDevice.connectionInfo.transport === 'ble' ? (
            <Icon name="bluetooth" className="w-3.5 h-3.5 text-blue-400" />
          ) : (
            <Icon name="devices" className="w-3.5 h-3.5 text-purple-400" />
          )}
          <span>{selectedDevice.connectionInfo.transport.toUpperCase()}</span>
        </span>

        {/* Connection Status Pill */}
        <span
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
            isConnected
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}
          />
          {selectedDevice.connectionInfo.state.toUpperCase()}
        </span>

        {/* Live Hardware vs Dry-Run Mode Toggle Badge */}
        <button
          onClick={() => updateSettings({ dryRun: !settings.dryRun })}
          title={
            settings.dryRun
              ? 'Simulation Active: Wire transmission is simulated in-memory. Click to toggle LIVE HARDWARE transmission.'
              : 'Live Hardware Active: Wire packets are sent to physical controller. Click to switch to SIMULATION.'
          }
          className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold border transition-all cursor-pointer ${
            settings.dryRun
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
              : 'bg-blue-500/15 text-cyan-300 border-blue-500/30 hover:bg-blue-500/25'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${settings.dryRun ? 'bg-amber-400' : 'bg-cyan-400 animate-pulse'}`}
          />
          <span>{settings.dryRun ? 'DRY-RUN' : 'LIVE'}</span>
        </button>
      </div>

      {/* Global Status Banner if any */}
      {statusMessage && (
        <div className="text-xs text-amber-300 bg-amber-900/30 px-3 py-1 rounded border border-amber-700/50 truncate max-w-sm">
          {statusMessage}
        </div>
      )}

      {/* Quick Power & Brightness Controls */}
      <div className="flex items-center gap-4">
        {/* Quick Brightness Slider */}
        <div className="flex items-center gap-2 bg-[#21262d] px-3 py-1.5 rounded-md border border-[#30363d]">
          <Icon name="brightness" className="w-4 h-4 text-amber-400" />
          <input
            type="range"
            min="0"
            max={selectedDevice.capabilities.brightnessRange.safetyLimit || 20}
            value={selectedDevice.state.brightness}
            onChange={(e) => setBrightness(parseInt(e.target.value, 10))}
            className="w-24 accent-blue-500"
          />
          <span className="text-xs font-mono text-gray-300 w-8 text-right">
            {selectedDevice.state.brightness}%
          </span>
        </div>

        {/* Master Power Toggle */}
        <button
          onClick={() => setPower(!isPowerOn)}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
            isPowerOn
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30'
              : 'bg-[#21262d] hover:bg-[#30363d] text-gray-400 border border-[#30363d]'
          }`}
        >
          <Icon name="power" className="w-4 h-4" />
          <span>{isPowerOn ? 'ON' : 'OFF'}</span>
        </button>

        {/* Scan Refresh Button */}
        <button
          onClick={() => startDiscovery()}
          disabled={isScanning}
          className="p-2 rounded-md bg-[#21262d] hover:bg-[#30363d] text-gray-300 border border-[#30363d] disabled:opacity-50"
          title="Rescan Controllers"
        >
          <Icon name="refresh" className={`w-4 h-4 ${isScanning ? 'animate-spin text-blue-400' : ''}`} />
        </button>
      </div>
    </header>
  );
};
