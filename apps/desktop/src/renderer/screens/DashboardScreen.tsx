import React from 'react';
import { useDevice } from '../context/DeviceContext.tsx';
import { Icon } from '../components/Icon.tsx';

export const DashboardScreen: React.FC = () => {
  const {
    devices,
    selectedDevice,
    setSelectedDeviceId,
    setActiveScreen,
    setPower,
    presets,
    applyPreset,
    settings,
  } = useDevice();

  if (!selectedDevice) {
    return (
      <div className="p-8 text-center text-gray-400">
        No controllers discovered. Please navigate to Controllers to scan.
      </div>
    );
  }

  const onlineCount = devices.filter((d) => d.connectionInfo.state === 'connected').length;

  return (
    <div className="p-8 space-y-8 overflow-y-auto max-h-[calc(100vh-4rem)]">
      {/* Top Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">System Dashboard</h2>
          <p className="text-xs text-gray-400 mt-1">
            Universal LED Controller • Windows 10/11 Architecture
          </p>
        </div>
        <div className="flex items-center gap-2">
          {settings.dryRun && (
            <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs rounded-full font-mono flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              DRY-RUN SAFETY ENABLED
            </span>
          )}
          <button
            onClick={() => setActiveScreen('devices')}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-md shadow-md shadow-blue-600/30 transition-all flex items-center gap-2"
          >
            <Icon name="plus" className="w-3.5 h-3.5" />
            <span>Manage Controllers</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Metric 1: Online Status */}
        <div className="bg-[#161b22] border border-[#30363d] p-5 rounded-xl flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Icon name="wifi" className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-gray-400 font-medium">Online Controllers</div>
            <div className="text-2xl font-bold text-white mt-0.5">
              {onlineCount} <span className="text-xs font-normal text-gray-500">/ {devices.length}</span>
            </div>
          </div>
        </div>

        {/* Metric 2: Active Controller */}
        <div className="bg-[#161b22] border border-[#30363d] p-5 rounded-xl flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Icon name="devices" className="w-6 h-6" />
          </div>
          <div className="truncate">
            <div className="text-xs text-gray-400 font-medium">Selected Controller</div>
            <div className="text-sm font-bold text-white mt-0.5 truncate">{selectedDevice.name}</div>
            <div className="text-[10px] font-mono text-gray-500">
              {selectedDevice.connectionInfo.address}
            </div>
          </div>
        </div>

        {/* Metric 3: Active State */}
        <div className="bg-[#161b22] border border-[#30363d] p-5 rounded-xl flex items-center gap-4 shadow-sm">
          <div
            className="w-12 h-12 rounded-lg border border-white/20 flex items-center justify-center shadow-md"
            style={{
              backgroundColor: selectedDevice.state.power
                ? selectedDevice.state.color.hex || '#FFFFFF'
                : '#1f2937',
            }}
          >
            <Icon
              name="color"
              className={`w-6 h-6 ${selectedDevice.state.power ? 'text-black/70' : 'text-gray-500'}`}
            />
          </div>
          <div>
            <div className="text-xs text-gray-400 font-medium">Output Mode</div>
            <div className="text-sm font-bold text-white mt-0.5 uppercase">
              {selectedDevice.state.power ? selectedDevice.state.mode : 'OFF'}
            </div>
            <div className="text-[10px] text-gray-400">
              Brightness: {selectedDevice.state.brightness}%
            </div>
          </div>
        </div>

        {/* Metric 4: Hardware Target */}
        <div className="bg-[#161b22] border border-[#30363d] p-5 rounded-xl flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Icon name="sliders" className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-gray-400 font-medium">Hardware Model</div>
            <div className="text-sm font-bold text-white mt-0.5">
              {selectedDevice.capabilities.firmwareInfo?.model || selectedDevice.family.toUpperCase()}
            </div>
            <div className="text-[10px] text-gray-500 font-mono">
              Pixels: {selectedDevice.capabilities.maxTotalPixels} • Segs: {selectedDevice.capabilities.maxSegments}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Controllers & Quick Presets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Discovered Controllers List */}
        <div className="lg:col-span-2 bg-[#161b22] border border-[#30363d] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Configured Controllers</h3>
              <p className="text-xs text-gray-400">Click a controller to control or view telemetry</p>
            </div>
            <button
              onClick={() => setActiveScreen('devices')}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium"
            >
              View all →
            </button>
          </div>

          <div className="space-y-3">
            {devices.map((device) => {
              const isSelected = selectedDevice.id === device.id;
              const isConnected = device.connectionInfo.state === 'connected';

              return (
                <div
                  key={device.id}
                  onClick={() => setSelectedDeviceId(device.id)}
                  className={`p-4 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-[#21262d] border-blue-500 shadow-sm'
                      : 'bg-[#0d1117]/60 border-[#30363d] hover:bg-[#21262d]/60'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{
                        backgroundColor: device.state.power
                          ? device.state.color.hex || '#3b82f6'
                          : '#21262d',
                      }}
                    >
                      <Icon
                        name={device.connectionInfo.transport === 'ble' ? 'bluetooth' : 'wifi'}
                        className={`w-5 h-5 ${device.state.power ? 'text-black/80' : 'text-gray-400'}`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{device.name}</span>
                        {isSelected && (
                          <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded font-mono">
                            SELECTED
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 font-mono mt-0.5">
                        {device.connectionInfo.address} • {device.connectionInfo.transport.toUpperCase()} •{' '}
                        {device.capabilities.maxTotalPixels} Pixels
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                        isConnected
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-gray-700 text-gray-400'
                      }`}
                    >
                      {device.connectionInfo.state.toUpperCase()}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPower(!device.state.power);
                      }}
                      className={`p-2 rounded-md transition-all ${
                        device.state.power
                          ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                          : 'bg-[#21262d] text-gray-400 hover:bg-[#30363d]'
                      }`}
                      title="Toggle Power"
                    >
                      <Icon name="power" className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Quick Presets Launcher */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Quick Scenes</h3>
              <p className="text-xs text-gray-400">One-click scene application</p>
            </div>
            <button
              onClick={() => setActiveScreen('presets')}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium"
            >
              Manage →
            </button>
          </div>

          <div className="space-y-2.5">
            {presets.slice(0, 4).map((p) => (
              <button
                key={p.id}
                onClick={() => applyPreset(p.id)}
                className="w-full p-3 rounded-lg bg-[#0d1117]/60 hover:bg-[#21262d] border border-[#30363d] transition-all flex items-center justify-between text-left group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 rounded-md border border-white/20 shadow-sm"
                    style={{
                      backgroundColor: p.state.color?.hex || '#3b82f6',
                    }}
                  />
                  <div>
                    <div className="text-xs font-semibold text-white group-hover:text-blue-400 transition-colors">
                      {p.name}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      Bri: {p.state.brightness}% • Mode: {p.state.mode || 'solid'}
                    </div>
                  </div>
                </div>
                <Icon name="play" className="w-3.5 h-3.5 text-gray-500 group-hover:text-blue-400" />
              </button>
            ))}
          </div>

          {/* Quick Hardware Notice */}
          <div className="mt-6 p-3.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200 space-y-1">
            <div className="font-semibold flex items-center gap-1.5 text-blue-300">
              <Icon name="check" className="w-4 h-4 text-emerald-400" />
              <span>SP530E Controller Verified</span>
            </div>
            <p className="text-[11px] text-blue-300/80 leading-relaxed">
              Physical SP530E is online via local Wi-Fi TCP port 8587 with 20% safe brightness cap.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
