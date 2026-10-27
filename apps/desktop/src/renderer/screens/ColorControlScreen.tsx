import React, { useState, useEffect } from 'react';
import { useDevice } from '../context/DeviceContext.tsx';
import { Icon } from '../components/Icon.tsx';
import { rgbToHex, hexToRgb } from '../../../../../packages/core/src/color.ts';

const PALETTE_SWATCHES = [
  { name: 'Pure Red', hex: '#FF0000', r: 255, g: 0, b: 0 },
  { name: 'Vibrant Green', hex: '#00FF00', r: 0, g: 255, b: 0 },
  { name: 'Royal Blue', hex: '#0000FF', r: 0, g: 0, b: 255 },
  { name: 'Cyan Neon', hex: '#00FFFF', r: 0, g: 255, b: 255 },
  { name: 'Magenta Pink', hex: '#FF00FF', r: 255, g: 0, b: 255 },
  { name: 'Electric Yellow', hex: '#FFFF00', r: 255, g: 255, b: 0 },
  { name: 'Warm White (2700K)', hex: '#FFB43C', r: 255, g: 180, b: 60, cct: 2700 },
  { name: 'Cool White (6500K)', hex: '#FFFFFF', r: 255, g: 255, b: 255, cct: 6500 },
  { name: 'Amber Sunset', hex: '#FF8000', r: 255, g: 128, b: 0 },
  { name: 'Cyberpunk Violet', hex: '#8B5CF6', r: 139, g: 92, b: 246 },
];

export const ColorControlScreen: React.FC = () => {
  const { selectedDevice, setColor } = useDevice();

  if (!selectedDevice) {
    return <div className="p-8 text-center text-gray-400">No device selected.</div>;
  }

  const currentColor = selectedDevice.state.color;
  const [r, setR] = useState(currentColor.r);
  const [g, setG] = useState(currentColor.g);
  const [b, setB] = useState(currentColor.b);
  const [w, setW] = useState(currentColor.w ?? 0);
  const [cct, setCct] = useState(currentColor.cct ?? 4000);
  const [hexInput, setHexInput] = useState(currentColor.hex || rgbToHex({ r, g, b }));

  // Keep internal state aligned if device state updates from telemetry
  useEffect(() => {
    setR(currentColor.r);
    setG(currentColor.g);
    setB(currentColor.b);
    if (currentColor.w !== undefined) setW(currentColor.w);
    if (currentColor.cct !== undefined) setCct(currentColor.cct);
    setHexInput(currentColor.hex || rgbToHex({ r: currentColor.r, g: currentColor.g, b: currentColor.b }));
  }, [currentColor]);

  const updateColor = (newR: number, newG: number, newB: number, newW?: number, newCct?: number) => {
    const hex = rgbToHex({ r: newR, g: newG, b: newB });
    setR(newR);
    setG(newG);
    setB(newB);
    if (newW !== undefined) setW(newW);
    if (newCct !== undefined) setCct(newCct);
    setHexInput(hex);
    setColor({ r: newR, g: newG, b: newB, w: newW, cct: newCct, hex });
  };

  const handleHexChange = (val: string) => {
    setHexInput(val);
    const parsed = hexToRgb(val);
    if (parsed) {
      updateColor(parsed.r, parsed.g, parsed.b, w, cct);
    }
  };

  const supportsWhite = selectedDevice.capabilities.supportsWhiteChannel;
  const supportsCct = selectedDevice.capabilities.supportsColorTemperature;

  return (
    <div className="p-8 space-y-8 overflow-y-auto max-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Color Control</h2>
        <p className="text-xs text-gray-400 mt-1">
          Adjust solid RGB color, white channels, and color temperature for {selectedDevice.name}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Color Swatch & Wheel / Hue Slider */}
        <div className="lg:col-span-5 bg-[#161b22] border border-[#30363d] rounded-xl p-6 flex flex-col items-center">
          {/* Large Preview Swatch */}
          <div
            className="w-48 h-48 rounded-2xl border-2 border-white/20 shadow-2xl mb-6 relative overflow-hidden transition-all duration-300"
            style={{
              backgroundColor: hexInput,
              boxShadow: `0 0 50px -10px ${hexInput}80`,
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent flex items-end p-4">
              <span className="text-sm font-mono font-bold text-white drop-shadow">
                {hexInput.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Hex Input Box */}
          <div className="w-full max-w-xs mb-6">
            <label className="text-[10px] text-gray-400 font-medium uppercase mb-1 block">
              Hex Color Code
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-gray-500">#</span>
              <input
                type="text"
                value={hexInput.replace('#', '')}
                onChange={(e) => handleHexChange('#' + e.target.value)}
                maxLength={6}
                className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-1.5 text-xs text-white font-mono focus:border-blue-500 outline-none uppercase"
              />
            </div>
          </div>

          {/* Preset Swatches Palette */}
          <div className="w-full">
            <div className="text-[10px] text-gray-400 font-medium uppercase mb-2">
              Quick Swatches
            </div>
            <div className="grid grid-cols-5 gap-2.5">
              {PALETTE_SWATCHES.map((swatch) => (
                <button
                  key={swatch.name}
                  onClick={() => updateColor(swatch.r, swatch.g, swatch.b, w, swatch.cct)}
                  className="group relative h-9 rounded-md border border-white/20 hover:scale-105 transition-all shadow-sm flex items-center justify-center"
                  style={{ backgroundColor: swatch.hex }}
                  title={swatch.name}
                >
                  {hexInput.toUpperCase() === swatch.hex.toUpperCase() && (
                    <Icon name="check" className="w-4 h-4 text-white drop-shadow-md" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Sliders for RGB, White, and CCT */}
        <div className="lg:col-span-7 bg-[#161b22] border border-[#30363d] rounded-xl p-6 space-y-6">
          <h3 className="text-sm font-bold text-white">Channel Adjustments</h3>

          {/* Red Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-rose-400 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                Red Channel
              </span>
              <span className="font-mono text-gray-300">{r} / 255</span>
            </div>
            <input
              type="range"
              min="0"
              max="255"
              value={r}
              onChange={(e) => updateColor(parseInt(e.target.value, 10), g, b, w, cct)}
              className="w-full accent-rose-500"
            />
          </div>

          {/* Green Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                Green Channel
              </span>
              <span className="font-mono text-gray-300">{g} / 255</span>
            </div>
            <input
              type="range"
              min="0"
              max="255"
              value={g}
              onChange={(e) => updateColor(r, parseInt(e.target.value, 10), b, w, cct)}
              className="w-full accent-emerald-500"
            />
          </div>

          {/* Blue Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-blue-400 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                Blue Channel
              </span>
              <span className="font-mono text-gray-300">{b} / 255</span>
            </div>
            <input
              type="range"
              min="0"
              max="255"
              value={b}
              onChange={(e) => updateColor(r, g, parseInt(e.target.value, 10), w, cct)}
              className="w-full accent-blue-500"
            />
          </div>

          {/* Optional White Channel */}
          {supportsWhite && (
            <div className="space-y-1.5 pt-2 border-t border-[#30363d]">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-gray-200 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-white inline-block shadow-sm" />
                  White Channel (RGBW)
                </span>
                <span className="font-mono text-gray-300">{w} / 255</span>
              </div>
              <input
                type="range"
                min="0"
                max="255"
                value={w}
                onChange={(e) => updateColor(r, g, b, parseInt(e.target.value, 10), cct)}
                className="w-full accent-gray-200"
              />
            </div>
          )}

          {/* Optional Color Temperature (CCT) */}
          {supportsCct && (
            <div className="space-y-1.5 pt-2 border-t border-[#30363d]">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                  <Icon name="brightness" className="w-4 h-4 text-amber-400" />
                  Color Temperature (CCT)
                </span>
                <span className="font-mono text-gray-300">{cct} K</span>
              </div>
              <input
                type="range"
                min="2700"
                max="6500"
                step="50"
                value={cct}
                onChange={(e) => updateColor(r, g, b, w, parseInt(e.target.value, 10))}
                className="w-full"
                style={{
                  background: 'linear-gradient(to right, #ffb43c, #ffffff, #a3c4f3)',
                }}
              />
            </div>
          )}

          {/* Capability Footer Note */}
          <div className="p-3 bg-[#0d1117] rounded-lg border border-[#30363d] text-[11px] text-gray-400 font-mono">
            Color Modes: {selectedDevice.capabilities.colorModes.join(', ').toUpperCase()} • 
            White Channel: {supportsWhite ? 'Enabled' : 'Disabled'} • 
            CCT: {supportsCct ? 'Supported' : 'Unavailable'}
          </div>
        </div>
      </div>
    </div>
  );
};
