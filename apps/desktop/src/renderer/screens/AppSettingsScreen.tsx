import React from 'react';
import { useDevice } from '../context/DeviceContext.tsx';
import { Icon } from '../components/Icon.tsx';

export const AppSettingsScreen: React.FC = () => {
  const { settings, updateSettings } = useDevice();

  return (
    <div className="p-8 space-y-8 overflow-y-auto max-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Application Settings</h2>
        <p className="text-xs text-gray-400 mt-1">
          Configure safety parameters, default network targets, and runtime preferences
        </p>
      </div>

      <div className="max-w-3xl space-y-6">
        {/* Card 1: Safety & Hardware Protection */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 space-y-6">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Icon name="alert" className="w-4 h-4 text-amber-400" />
            <span>Hardware Safety & Operating Mode</span>
          </h3>

          {/* Dry Run Toggle */}
          <div className="flex items-center justify-between pb-4 border-b border-[#30363d]">
            <div>
              <div className="text-xs font-semibold text-white">Dry-Run Simulation Mode</div>
              <div className="text-xs text-gray-400">
                When enabled, encodes and validates all protocol frames in memory without sending physical wire packets
              </div>
            </div>
            <button
              onClick={() => updateSettings({ dryRun: !settings.dryRun })}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                settings.dryRun ? 'bg-amber-500' : 'bg-gray-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  settings.dryRun ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* Brightness Safety Cap */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <div>
                <div className="font-semibold text-white">Brightness Safety Clamping Limit</div>
                <div className="text-gray-400">
                  Prevents power supply overload and thermal damage on addressable strips
                </div>
              </div>
              <span className="font-mono text-cyan-400 font-bold">
                {settings.safetyBrightnessLimit}%
              </span>
            </div>

            <input
              type="range"
              min="5"
              max="100"
              step="5"
              value={settings.safetyBrightnessLimit}
              onChange={(e) =>
                updateSettings({ safetyBrightnessLimit: parseInt(e.target.value, 10) })
              }
              className="w-full accent-cyan-500"
            />
            <div className="flex justify-between text-[10px] font-mono text-gray-500">
              <span>5%</span>
              <span className="text-amber-400">20% (Default Safe)</span>
              <span>100% (High Current Warning)</span>
            </div>
          </div>
        </div>

        {/* Card 2: Network & Connection Defaults */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Icon name="wifi" className="w-4 h-4 text-cyan-400" />
            <span>Default Hardware Target</span>
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-gray-400 font-medium uppercase mb-1 block">
                Default SP530E Controller IP
              </label>
              <input
                type="text"
                value={settings.wifiHost}
                onChange={(e) => updateSettings({ wifiHost: e.target.value })}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-xs text-white font-mono focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 font-medium uppercase mb-1 block">
                Port
              </label>
              <input
                type="number"
                value={settings.wifiPort}
                onChange={(e) => updateSettings({ wifiPort: parseInt(e.target.value, 10) || 8587 })}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-xs text-white font-mono focus:border-blue-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Card 3: System & Hardware Compatibility */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 space-y-3">
          <h3 className="text-sm font-bold text-white">System Information & Stack</h3>
          <div className="text-xs text-gray-400 font-mono space-y-1">
            <div>Application: Universal LED Controller v0.1.0</div>
            <div>Runtime: Electron 34.0 • Node.js 24.13 • React 18.3 • Vite 6.0</div>
            <div>Hardware Stack: SP530E (Wi-Fi TCP 8587 & WinRT BLE) • WLED (JSON/WebSocket)</div>
            <div>Architecture: Universal Hardware Abstraction Layer (HAL)</div>
          </div>
        </div>
      </div>
    </div>
  );
};
