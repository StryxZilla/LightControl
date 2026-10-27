import React from 'react';
import { useDevice } from '../context/DeviceContext.tsx';
import { Icon } from '../components/Icon.tsx';

export const AppSettingsScreen: React.FC = () => {
  const { settings, updateSettings } = useDevice();

  const isSafetyEnforced = settings.enforceSafetyBrightness ?? true;
  const isRateLimitEnforced = settings.enforceRateLimiting ?? true;

  return (
    <div className="p-8 space-y-8 overflow-y-auto max-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Application Settings</h2>
        <p className="text-xs text-gray-400 mt-1">
          Configure hardware safety switches, intensity ceilings, rate limits, and network preferences
        </p>
      </div>

      <div className="max-w-3xl space-y-6">
        {/* Card 1: Safety & Hardware Protection Switches */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-[#30363d] pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Icon name="alert" className="w-4 h-4 text-amber-400" />
              <span>Hardware Safety & Protection Switches</span>
            </h3>
            <span className="text-[10px] font-mono text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              Hardware Guards
            </span>
          </div>

          {/* Switch 1: Enforce Brightness Safety Cap */}
          <div className="flex items-center justify-between pb-4 border-b border-[#30363d]">
            <div>
              <div className="text-xs font-semibold text-white flex items-center gap-2">
                <span>Enforce Brightness Safety Cap</span>
                <span
                  className={`text-[10px] px-2 py-0.2 rounded font-mono ${
                    isSafetyEnforced ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {isSafetyEnforced ? 'CLAMPED (SAFE)' : 'UNLOCKED (100% MAX)'}
                </span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                When enabled, limits maximum output to prevent power supply overcurrent and thermal stress on LEDs.
                When disabled, sliders allow full 100% (255) duty cycle.
              </div>
            </div>
            <button
              onClick={() => updateSettings({ enforceSafetyBrightness: !isSafetyEnforced })}
              className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                isSafetyEnforced ? 'bg-amber-500' : 'bg-gray-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  isSafetyEnforced ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* Brightness Safety Limit Ceiling Slider */}
          <div className={`space-y-2 pb-4 border-b border-[#30363d] ${isSafetyEnforced ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <div className="flex justify-between text-xs">
              <div>
                <div className="font-semibold text-white">Maximum Safe Brightness Ceiling</div>
                <div className="text-gray-400">
                  Active clamp applied to all sliders and preset scenes when safety mode is active
                </div>
              </div>
              <span className="font-mono text-cyan-400 font-bold text-sm">
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
              <span className="text-amber-400 font-semibold">20% (Recommended Safe)</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Switch 2: Command Rate Limiting & Coalescing */}
          <div className="flex items-center justify-between pb-4 border-b border-[#30363d]">
            <div>
              <div className="text-xs font-semibold text-white flex items-center gap-2">
                <span>Command Rate Limiting & Coalescing (20 Hz)</span>
                <span
                  className={`text-[10px] px-2 py-0.2 rounded font-mono ${
                    isRateLimitEnforced ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30' : 'bg-gray-800 text-gray-400 border border-gray-700'
                  }`}
                >
                  {isRateLimitEnforced ? '50ms COALESCING' : 'IMMEDIATE DISPATCH'}
                </span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                Throttles rapid slider or color wheel drags to 20 packets/sec to prevent microcontroller serial buffer overrun.
              </div>
            </div>
            <button
              onClick={() => updateSettings({ enforceRateLimiting: !isRateLimitEnforced })}
              className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                isRateLimitEnforced ? 'bg-blue-600' : 'bg-gray-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  isRateLimitEnforced ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* Switch 3: Dry Run Simulation Mode */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-white">Dry-Run Simulation Mode</div>
              <div className="text-xs text-gray-400 mt-0.5">
                When enabled, encodes and validates all protocol frames in memory without sending physical wire packets.
              </div>
            </div>
            <button
              onClick={() => updateSettings({ dryRun: !settings.dryRun })}
              className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${
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
                Default TCP Port
              </label>
              <input
                type="text"
                value={settings.wifiPort}
                onChange={(e) =>
                  updateSettings({ wifiPort: parseInt(e.target.value, 10) || 8587 })
                }
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-xs text-white font-mono focus:border-blue-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Card 3: Automation & Startup */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Icon name="settings" className="w-4 h-4 text-gray-400" />
            <span>Application Preferences</span>
          </h3>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-white">Auto-Connect on Launch</div>
              <div className="text-xs text-gray-400">
                Automatically connects to the last active controller when the desktop app opens
              </div>
            </div>
            <button
              onClick={() =>
                updateSettings({ autoConnectLastDevice: !settings.autoConnectLastDevice })
              }
              className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                settings.autoConnectLastDevice ? 'bg-blue-600' : 'bg-gray-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  settings.autoConnectLastDevice ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
