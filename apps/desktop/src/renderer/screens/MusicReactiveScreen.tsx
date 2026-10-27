import React, { useState } from 'react';
import { useDevice } from '../context/DeviceContext.tsx';
import { Icon } from '../components/Icon.tsx';

const MUSIC_MODES = [
  { id: 1, name: 'Energy Pulse', desc: 'Rhythmic flash synced to peak audio amplitude' },
  { id: 2, name: 'Rhythm Wave', desc: 'Fluid color wave undulating with melody' },
  { id: 3, name: 'Frequency Spectrum', desc: 'Frequency band distribution across strip pixels' },
  { id: 4, name: 'Bass Strobe', desc: 'Sharp low-end punch for electronic and dance music' },
];

export const MusicReactiveScreen: React.FC = () => {
  const { selectedDevice, setMusicMode } = useDevice();
  const [selectedMode, setSelectedMode] = useState<number>(1);
  const [sensitivity, setSensitivity] = useState<number>(70);
  const [inputSource, setInputSource] = useState<'device_mic' | 'system_audio'>('device_mic');

  if (!selectedDevice) {
    return <div className="p-8 text-center text-gray-400">No device selected.</div>;
  }

  const isMusicMode = selectedDevice.state.mode === 'music';

  const handleApplyMusicMode = (modeId: number) => {
    setSelectedMode(modeId);
    setMusicMode(modeId, sensitivity);
  };

  return (
    <div className="p-8 space-y-8 overflow-y-auto max-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Music-Reactive Lighting</h2>
        <p className="text-xs text-gray-400 mt-1">
          Synchronize LED animations to ambient acoustics and audio playback on {selectedDevice.name}
        </p>
      </div>

      {/* Visualizer Simulation Card */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-8 flex flex-col items-center justify-center text-center relative overflow-hidden">
        {/* Animated Visualizer Bars */}
        <div className="flex items-end justify-center gap-1.5 h-28 w-full max-w-md mb-4">
          {[40, 75, 55, 90, 65, 80, 45, 95, 70, 60, 85, 50, 90, 75, 60, 45].map((h, i) => (
            <div
              key={i}
              className={`w-3.5 rounded-t-sm transition-all duration-150 ${
                isMusicMode
                  ? 'bg-gradient-to-t from-blue-600 via-cyan-400 to-emerald-400 shadow-sm animate-pulse'
                  : 'bg-gray-700 opacity-30'
              }`}
              style={{
                height: isMusicMode ? `${h}%` : '15%',
                animationDelay: `${i * 60}ms`,
              }}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              isMusicMode ? 'bg-emerald-400 animate-ping' : 'bg-gray-600'
            }`}
          />
          <span className="text-xs font-mono font-semibold text-gray-300">
            {isMusicMode ? 'AUDIO SYNC ACTIVE (MICROPHONE LISTENING)' : 'MUSIC MODE STANDBY'}
          </span>
        </div>
      </div>

      {/* Parameter Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Input Source Selection */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white">Audio Capture Source</h3>

          <div className="space-y-2.5">
            <label
              onClick={() => setInputSource('device_mic')}
              className={`p-3.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                inputSource === 'device_mic'
                  ? 'bg-blue-600/10 border-blue-500 text-white'
                  : 'bg-[#0d1117] border-[#30363d] text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon name="music" className="w-4 h-4 text-cyan-400" />
                <div>
                  <div className="text-xs font-semibold">Controller Built-In Microphone</div>
                  <div className="text-[10px] text-gray-400">Zero latency direct analog mic pickup</div>
                </div>
              </div>
              <input
                type="radio"
                name="source"
                checked={inputSource === 'device_mic'}
                onChange={() => {}}
                className="accent-blue-500"
              />
            </label>

            <label
              onClick={() => setInputSource('system_audio')}
              className={`p-3.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                inputSource === 'system_audio'
                  ? 'bg-blue-600/10 border-blue-500 text-white'
                  : 'bg-[#0d1117] border-[#30363d] text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon name="devices" className="w-4 h-4 text-purple-400" />
                <div>
                  <div className="text-xs font-semibold">Desktop Audio Stream (Player)</div>
                  <div className="text-[10px] text-gray-400">Software loopback sound analysis</div>
                </div>
              </div>
              <input
                type="radio"
                name="source"
                checked={inputSource === 'system_audio'}
                onChange={() => {}}
                className="accent-blue-500"
              />
            </label>
          </div>
        </div>

        {/* Card 2: Sensitivity Slider */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Microphone Gain & Sensitivity</h3>
            <span className="text-xs font-mono text-cyan-300">{sensitivity}%</span>
          </div>

          <div className="space-y-3 pt-3">
            <input
              type="range"
              min="1"
              max="100"
              value={sensitivity}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setSensitivity(val);
                if (isMusicMode) setMusicMode(selectedMode, val);
              }}
              className="w-full accent-cyan-500"
            />
            <div className="flex justify-between text-[10px] font-mono text-gray-500">
              <span>Quiet Room</span>
              <span>Medium Loudness</span>
              <span>Club / High Sound Pressure</span>
            </div>
          </div>
        </div>
      </div>

      {/* Music Mode Presets Grid */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white">Reactive Rhythms</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {MUSIC_MODES.map((mode) => {
            const isActive = isMusicMode && selectedMode === mode.id;

            return (
              <div
                key={mode.id}
                onClick={() => handleApplyMusicMode(mode.id)}
                className={`p-5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isActive
                    ? 'bg-blue-600/15 border-blue-500 shadow-md'
                    : 'bg-[#161b22] border-[#30363d] hover:border-gray-500 hover:bg-[#21262d]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Icon name="music" className={`w-5 h-5 ${isActive ? 'text-cyan-400' : 'text-gray-500'}`} />
                    <span className="text-[10px] font-mono text-gray-500">MODE {mode.id}</span>
                  </div>
                  <h4 className="text-xs font-bold text-white">{mode.name}</h4>
                  <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">{mode.desc}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#30363d] flex items-center justify-between">
                  <span className={`text-[10px] font-semibold ${isActive ? 'text-cyan-400' : 'text-gray-500'}`}>
                    {isActive ? 'ENGAGED' : 'Select'}
                  </span>
                  <Icon name="play" className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-gray-600'}`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
