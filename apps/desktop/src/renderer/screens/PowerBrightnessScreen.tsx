import React from 'react';
import { useDevice } from '../context/DeviceContext.tsx';
import { Icon } from '../components/Icon.tsx';

export const PowerBrightnessScreen: React.FC = () => {
  const { selectedDevice, setPower, setBrightness, settings } = useDevice();

  if (!selectedDevice) {
    return <div className="p-8 text-center text-gray-400">No device selected.</div>;
  }

  const isPowerOn = selectedDevice.state.power;
  const currentBrightness = selectedDevice.state.brightness;
  const safetyCap = selectedDevice.capabilities.brightnessRange.safetyLimit || settings.safetyBrightnessLimit;

  const quickLevels = [5, 10, 15, safetyCap];

  return (
    <div className="p-8 space-y-8 overflow-y-auto max-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Power & Brightness</h2>
        <p className="text-xs text-gray-400 mt-1">
          Master output toggles and hardware-safe intensity controls for {selectedDevice.name}
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

        {/* Right Card: Precision Brightness Slider & Safety Cap */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Intensity Control</h3>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-blue-500/10 text-blue-300 border border-blue-500/20">
              Safety Cap: {safetyCap}%
            </span>
          </div>

          {/* Large Percentage Readout */}
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black text-white font-mono">{currentBrightness}</span>
            <span className="text-xl text-gray-400 font-mono">%</span>
          </div>

          {/* Slider */}
          <div className="space-y-2">
            <input
              type="range"
              min="0"
              max={safetyCap}
              value={currentBrightness}
              onChange={(e) => setBrightness(parseInt(e.target.value, 10))}
              className="w-full h-3 accent-blue-500 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] font-mono text-gray-500">
              <span>0% (Off)</span>
              <span>10%</span>
              <span className="text-amber-400 font-semibold">{safetyCap}% (Max Safe)</span>
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
                      : 'bg-[#0d1117] border-[#30363d] text-gray-300 hover:bg-[#21262d]'
                  }`}
                >
                  {lvl}%
                </button>
              ))}
            </div>
          </div>

          {/* Hardware Protection Notice */}
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-200/90 leading-relaxed">
            <span className="font-bold text-amber-300">Thermal Protection Notice:</span> The 20%
            software limit protects 5V addressable strips from excessive current draw and voltage
            drop without multi-point power injection.
          </div>
        </div>
      </div>
    </div>
  );
};
