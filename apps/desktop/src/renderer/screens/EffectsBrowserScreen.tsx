import React, { useState, useMemo } from 'react';
import { useDevice } from '../context/DeviceContext.tsx';
import { Icon } from '../components/Icon.tsx';

const BUILTIN_EFFECT_CATALOG = [
  { id: 1, name: 'Rainbow Flow', category: 'Dynamic', desc: 'Continuous flowing spectrum across all pixels' },
  { id: 2, name: 'Color Chase', category: 'Dynamic', desc: 'Trailing color chasing along the strip' },
  { id: 3, name: 'Breathing Ambient', category: 'Ambient', desc: 'Gentle pulsating brightness glow' },
  { id: 4, name: 'Meteor Rain', category: 'Dynamic', desc: 'High-speed cascading shooting stars with tail' },
  { id: 5, name: 'Fireplace Flicker', category: 'Ambient', desc: 'Warm organic fire flame simulation' },
  { id: 6, name: 'Color Wave', category: 'Dynamic', desc: 'Smooth sinusoidal chromatic wave' },
  { id: 7, name: 'Twinkle Stars', category: 'Ambient', desc: 'Sparkling random starry night glow' },
  { id: 8, name: 'Color Wipe', category: 'Dynamic', desc: 'Progressive pixel fill and wipe transition' },
  { id: 9, name: 'Cylon Scanner', category: 'Dynamic', desc: 'Back-and-forth scanning laser beam' },
  { id: 10, name: 'Rainbow Cycle', category: 'Party', desc: 'Fast full-strip rotating color cycle' },
  { id: 11, name: 'Strobe Flash', category: 'Party', desc: 'High-energy rhythmic optical flash' },
  { id: 12, name: 'Aurora Borealis', category: 'Ambient', desc: 'Ethereal northern lights color drift' },
];

export const EffectsBrowserScreen: React.FC = () => {
  const { selectedDevice, setEffect } = useDevice();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [speed, setSpeed] = useState<number>(selectedDevice?.state.effectSpeed ?? 50);

  if (!selectedDevice) {
    return <div className="p-8 text-center text-gray-400">No device selected.</div>;
  }

  const activeEffectId = selectedDevice.state.mode === 'effect' ? selectedDevice.state.effectId : null;

  const categories = ['All', 'Dynamic', 'Ambient', 'Party'];

  const filteredEffects = useMemo(() => {
    return BUILTIN_EFFECT_CATALOG.filter((fx) => {
      const matchesCat = selectedCategory === 'All' || fx.category === selectedCategory;
      const matchesSearch = fx.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            fx.desc.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  const handleSelectEffect = (id: number) => {
    setEffect(id, speed);
  };

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    if (typeof activeEffectId === 'number') {
      setEffect(activeEffectId, newSpeed);
    }
  };

  return (
    <div className="p-8 space-y-6 overflow-y-auto max-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Dynamic Effects Browser</h2>
          <p className="text-xs text-gray-400 mt-1">
            Browse and trigger built-in hardware animations on {selectedDevice.name}
          </p>
        </div>

        {/* Global Effect Parameters: Speed */}
        <div className="flex items-center gap-4 bg-[#161b22] border border-[#30363d] px-4 py-2 rounded-xl">
          <div className="flex items-center gap-2 text-xs text-gray-300 font-medium">
            <Icon name="sliders" className="w-4 h-4 text-cyan-400" />
            <span>Effect Speed:</span>
          </div>
          <input
            type="range"
            min="1"
            max="100"
            value={speed}
            onChange={(e) => handleSpeedChange(parseInt(e.target.value, 10))}
            className="w-28 accent-cyan-500"
          />
          <span className="text-xs font-mono text-cyan-300 w-8 text-right">{speed}%</span>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 bg-[#161b22] p-1 rounded-lg border border-[#30363d]">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search effects by name..."
            className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3.5 py-1.5 text-xs text-white placeholder-gray-500 focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      {/* Effects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredEffects.map((fx) => {
          const isActive = activeEffectId === fx.id;

          return (
            <div
              key={fx.id}
              onClick={() => handleSelectEffect(fx.id)}
              className={`p-5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between group ${
                isActive
                  ? 'bg-blue-950/30 border-blue-500 shadow-lg shadow-blue-500/10'
                  : 'bg-[#161b22] border-[#30363d] hover:border-gray-500 hover:bg-[#21262d]/50'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full ${
                      fx.category === 'Dynamic'
                        ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                        : fx.category === 'Party'
                        ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                        : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {fx.category}
                  </span>
                  <span className="text-[10px] font-mono text-gray-500">ID: {fx.id}</span>
                </div>

                <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                  {fx.name}
                </h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">{fx.desc}</p>
              </div>

              <div className="mt-5 pt-3 border-t border-[#30363d] flex items-center justify-between">
                <span
                  className={`text-[11px] font-medium ${
                    isActive ? 'text-blue-400 font-semibold' : 'text-gray-500'
                  }`}
                >
                  {isActive ? '● ACTIVE ON HARDWARE' : 'Click to Activate'}
                </span>
                <Icon
                  name="play"
                  className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-gray-600 group-hover:text-gray-300'}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
