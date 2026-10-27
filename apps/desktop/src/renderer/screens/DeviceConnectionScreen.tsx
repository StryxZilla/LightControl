import React, { useState } from 'react';
import { useDevice } from '../context/DeviceContext.tsx';
import { Icon } from '../components/Icon.tsx';

export const DeviceConnectionScreen: React.FC = () => {
  const {
    devices,
    selectedDevice,
    setSelectedDeviceId,
    connectDevice,
    disconnectDevice,
    startDiscovery,
    stopDiscovery,
    isScanning,
  } = useDevice();

  const [manualIp, setManualIp] = useState('192.168.86.34');
  const [manualPort, setManualPort] = useState('8587');
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const handleConnect = async (id: string) => {
    setConnectingId(id);
    try {
      await connectDevice(id);
    } finally {
      setConnectingId(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    await disconnectDevice(id);
  };

  return (
    <div className="p-8 space-y-8 overflow-y-auto max-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Controllers & Transports</h2>
          <p className="text-xs text-gray-400 mt-1">
            Discover, pair, and connect local Wi-Fi, BLE, and simulated LED controllers
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => (isScanning ? stopDiscovery() : startDiscovery())}
            className={`px-4 py-2 rounded-md text-xs font-semibold flex items-center gap-2 transition-all shadow-md ${
              isScanning
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
            }`}
          >
            <Icon name="refresh" className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Stop Scanning' : 'Scan for Controllers'}</span>
          </button>
        </div>
      </div>

      {/* Manual Connection Input Card */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6">
        <h3 className="text-sm font-bold text-white mb-1">Direct Network Connection</h3>
        <p className="text-xs text-gray-400 mb-4">
          Connect directly to an SP530E controller via local TCP socket (SPNET port 8587)
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] text-gray-400 font-medium uppercase mb-1 block">
              Controller IP Address
            </label>
            <input
              type="text"
              value={manualIp}
              onChange={(e) => setManualIp(e.target.value)}
              placeholder="192.168.86.34"
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-xs text-white font-mono focus:border-blue-500 outline-none"
            />
          </div>
          <div className="w-28">
            <label className="text-[10px] text-gray-400 font-medium uppercase mb-1 block">
              Port
            </label>
            <input
              type="text"
              value={manualPort}
              onChange={(e) => setManualPort(e.target.value)}
              placeholder="8587"
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-xs text-white font-mono focus:border-blue-500 outline-none"
            />
          </div>
          <div className="self-end">
            <button
              onClick={() => {
                const id = `sp530e-wifi-${manualIp.replace(/\./g, '-')}`;
                handleConnect(id);
              }}
              className="px-4 py-2 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-white text-xs font-semibold rounded-md transition-all flex items-center gap-2"
            >
              <Icon name="link" className="w-4 h-4 text-cyan-400" />
              <span>Connect Socket</span>
            </button>
          </div>
        </div>
      </div>

      {/* Discovered Controllers Table */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
        <div className="p-5 border-b border-[#30363d] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Discovered Devices ({devices.length})</h3>
            <p className="text-xs text-gray-400">Available hardware and simulation targets</p>
          </div>
        </div>

        <div className="divide-y divide-[#30363d]">
          {devices.map((device) => {
            const isConnected = device.connectionInfo.state === 'connected';
            const isSelected = selectedDevice?.id === device.id;
            const isConnecting = connectingId === device.id;

            return (
              <div
                key={device.id}
                className="p-5 flex items-center justify-between hover:bg-[#21262d]/40 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-11 h-11 rounded-lg flex items-center justify-center border ${
                      device.connectionInfo.transport === 'ble'
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                        : device.connectionInfo.transport === 'wifi-tcp' || device.connectionInfo.transport === 'wifi-http'
                        ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                        : 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                    }`}
                  >
                    <Icon
                      name={device.connectionInfo.transport === 'ble' ? 'bluetooth' : 'wifi'}
                      className="w-5 h-5"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-semibold text-white">{device.name}</span>
                      <span className="text-[10px] font-mono uppercase bg-[#21262d] text-gray-300 px-1.5 py-0.5 rounded border border-[#30363d]">
                        {device.family.toUpperCase()}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] font-mono text-blue-300 bg-blue-500/20 px-1.5 py-0.5 rounded">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 font-mono mt-1 flex items-center gap-3">
                      <span>Address: {device.connectionInfo.address}</span>
                      <span>•</span>
                      <span>Transport: {device.connectionInfo.transport.toUpperCase()}</span>
                      {device.connectionInfo.signalStrength && (
                        <>
                          <span>•</span>
                          <span>RSSI: {device.connectionInfo.signalStrength} dBm</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      isConnected
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-gray-800 text-gray-400 border border-gray-700'
                    }`}
                  >
                    {device.connectionInfo.state.toUpperCase()}
                  </span>

                  <button
                    onClick={() => setSelectedDeviceId(device.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-all ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-[#21262d] border-[#30363d] text-gray-300 hover:text-white'
                    }`}
                  >
                    {isSelected ? 'Selected' : 'Select'}
                  </button>

                  {isConnected ? (
                    <button
                      onClick={() => handleDisconnect(device.id)}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnect(device.id)}
                      disabled={isConnecting}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm disabled:opacity-50"
                    >
                      {isConnecting ? 'Connecting...' : 'Connect'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
