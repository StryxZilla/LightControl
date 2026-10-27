import React from 'react';
import { useDevice } from '../context/DeviceContext.tsx';
import { Icon } from '../components/Icon.tsx';

export const PowerBrightnessScreen: React.FC = () => {
  const { selectedDevice, setPower, setBrightness, settings, updateSettings } = useDevice();

  if (!selectedDevice) {
    return <div className="p-8 text-center text-gray-400">No device selected.</div>;
  }

  const isPowerOn = selectedDevice.state.power;
  const currentBrightness = selectedDevice.state.brightness;
  const isEnforced = settings.enforceSafetyBrightness ?? true;
  const safetyLimit = settings.safetyBrightnessLimit ?? 20;
  const effectiveMax = isEnforced ? safetyLimit : 100;

  const quickLevels = isEnforced
    ? [5, 10, 15, safetyLimit]
    : [25, 50, 75, 100];

  return (
    <div className="p-8 space-y-8 overflow-y-auto max-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Power & Brightness</h2>
        <p className="text-xs text-gray-400 mt-1">
          Master output toggles and configurable intensity controls for {selectedDevice.name}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Card: Master Power Control */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-8 flex flex-col items-center justify-center text-center">
          <div className="text-xs text-gray-400 font-medium uppercase mb-6 tracking-wider">
            Main Output Switch
          </div>

          <button
            onClick={() => setPower(!isPowerOn)}
            className={`w-36 h-36 rounded-full border-4 flex flex-col items-center justify-center transition-all duration-300 shadow-2xl ${
              isPowerOn
                ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400 shadow-emerald-500/30 scale-105'
                : 'bg-[#0d1117] border-gray-700 text-gray-600 hover:border-gray-500'
            }`}
          >
            <Icon name="power" className="w-14 h-14" />
            <span className="text-xs font-bold mt-2 tracking-widest uppercase">
              {isPowerOn ? 'SYSTEM ON' : 'SYSTEM OFF'}
            </span>
          </button>

          <p className="text-xs text-gray-400 mt-6 max-w-xs">
            {isPowerOn
              ? 'Controller is actively driving the physical LED strip.'
              : 'Output is powered down. Microcontroller remains connected and listening on network.'}
          </p>
        </div>

        {/* Right Card: Precision Brightness Slider & Configurable Safety Cap */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Intensity Control</h3>
            <button
              onClick={() => updateSettings({ enforceSafetyBrightness: !isEnforced })}
              title={isEnforced ? 'Click to unlock full 100% brightness range' : 'Click to enforce safe brightness limit'}
              className={`px-3 py-1 rounded-full text-xs font-mono font-medium flex items-center gap-1.5 transition-all border ${
                isEnforced
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
              }`}
            >
              <Icon name={isEnforced ? 'alert' : 'check'} className="w-3.5 h-3.5" />
              <span>{isEnforced ? `Safety Limit: ${safetyLimit}% (Unlock 100%)` : 'Full Range (100% Unlocked)'}</span>
            </button>
          </div>

          {/* Large Percentage Readout */}
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black text-white font-mono">{currentBrightness}</span>
            <span className="text-xl text-gray-400 font-mono">%</span>
            {!isEnforced && currentBrightness > 30 && (
              <span className="text-xs text-amber-400 font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 ml-2">
                High Current Mode
              </span>
            )}
          </div>

          {/* Slider */}
          <div className="space-y-2">
            <input
              type="range"
              min="0"
              max={effectiveMax}
              value={currentBrightness}
              onChange={(e) => setBrightness(parseInt(e.target.value, 10))}
              className={`w-full h-3 cursor-pointer ${isEnforced ? 'accent-amber-500' : 'accent-blue-500'}`}
            />
            <div className="flex justify-between text-[11px] font-mono text-gray-500">
              <span>0% (Off)</span>
              <span>{Math.round(effectiveMax / 2)}%</span>
              <span className={isEnforced ? 'text-amber-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                {effectiveMax}% {isEnforced ? '(Safety Cap)' : '(Max Output)'}
              </span>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="pt-4 border-t border-[#30363d]">
            <div className="text-[10px] text-gray-400 font-medium uppercase mb-2.5">
              Quick Intensity Presets
            </div>
            <div className="grid grid-cols-4 gap-2">
              {quickLevels.map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setBrightness(lvl)}
                  className={`py-2 rounded-md text-xs font-semibold font-mono border transition-all ${
                    currentBrightness === lvl
                      ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                      : 'bg-[#0d1117] border-[#30363d] text-gray-300 hover:text-white hover:bg-[#21262d]'
                  }`}
                >
                  {lvl}%
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
