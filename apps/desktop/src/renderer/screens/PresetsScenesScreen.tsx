import React, { useState } from 'react';
import { useDevice } from '../context/DeviceContext.tsx';
import { Icon } from '../components/Icon.tsx';
import type { Preset } from '../../../../../packages/core/src/presets.ts';

export const PresetsScenesScreen: React.FC = () => {
  const { presets, applyPreset, savePreset, deletePreset, selectedDevice } = useDevice();
  const [newPresetName, setNewPresetName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreatePreset = () => {
    if (!newPresetName.trim() || !selectedDevice) return;

    const newPreset: Preset = {
      id: `preset-custom-${Date.now()}`,
      name: newPresetName.trim(),
      state: {
        power: selectedDevice.state.power,
        brightness: selectedDevice.state.brightness,
        color: { ...selectedDevice.state.color },
        mode: selectedDevice.state.mode,
        effectId: selectedDevice.state.effectId,
        effectSpeed: selectedDevice.state.effectSpeed,
      },
      tags: ['custom', selectedDevice.family],
      createdAt: Date.now(),
    };

    savePreset(newPreset);
    setNewPresetName('');
    setIsCreating(false);
  };

  return (
    <div className="p-8 space-y-8 overflow-y-auto max-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Presets & Lighting Scenes</h2>
          <p className="text-xs text-gray-400 mt-1">
            Store, apply, and export favorite lighting configurations across controllers
          </p>
        </div>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-md shadow-md shadow-blue-600/30 transition-all flex items-center gap-2"
        >
          <Icon name="plus" className="w-4 h-4" />
          <span>Capture Current State</span>
        </button>
      </div>

      {/* Preset Creation Form Drawer */}
      {isCreating && (
        <div className="bg-[#161b22] border border-blue-500/50 rounded-xl p-5 shadow-lg space-y-4">
          <h3 className="text-sm font-bold text-white">Save Current Device State as New Scene</h3>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="e.g. Midnight Movie Focus, Cyber Chill..."
              className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-xs text-white focus:border-blue-500 outline-none"
            />
            <button
              onClick={handleCreatePreset}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-md"
            >
              Save Scene
            </button>
            <button
              onClick={() => setIsCreating(false)}
              className="px-3 py-2 bg-[#21262d] text-gray-400 hover:text-white text-xs rounded-md"
            >
              Cancel
            </button>
          </div>
          {selectedDevice && (
            <div className="text-[11px] text-gray-400 font-mono">
              Capturing: Brightness {selectedDevice.state.brightness}%, Mode {selectedDevice.state.mode},
              Color {selectedDevice.state.color.hex || 'RGB'}
            </div>
          )}
        </div>
      )}

      {/* Preset Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {presets.map((preset) => {
          const isFactory = preset.id.startsWith('preset-warm') || preset.id.startsWith('preset-cool') || preset.id.startsWith('preset-cyberpunk') || preset.id.startsWith('preset-rainbow');

          return (
            <div
              key={preset.id}
              className="bg-[#161b22] border border-[#30363d] hover:border-gray-500 rounded-xl p-5 flex flex-col justify-between transition-all group"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="w-10 h-10 rounded-lg border border-white/20 shadow-md flex items-center justify-center"
                    style={{
                      backgroundColor: preset.state.color?.hex || '#3b82f6',
                    }}
                  >
                    <Icon name="presets" className="w-5 h-5 text-black/60" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isFactory && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                        FACTORY
                      </span>
                    )}
                    {!isFactory && (
                      <button
                        onClick={() => deletePreset(preset.id)}
                        className="text-gray-500 hover:text-rose-400 p-1"
                        title="Delete Scene"
                      >
                        <Icon name="trash" className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                  {preset.name}
                </h3>
                <div className="text-xs text-gray-400 font-mono mt-1 space-y-0.5">
                  <div>Brightness: {preset.state.brightness}%</div>
                  <div>Mode: {preset.state.mode || 'solid'}</div>
                  {preset.state.color?.hex && <div>Hex: {preset.state.color.hex}</div>}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-[#30363d] flex items-center justify-between">
                <button
                  onClick={() => applyPreset(preset.id)}
                  className="w-full py-2 bg-[#21262d] hover:bg-blue-600 text-gray-200 hover:text-white text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-2"
                >
                  <Icon name="play" className="w-3.5 h-3.5" />
                  <span>Activate Scene</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
