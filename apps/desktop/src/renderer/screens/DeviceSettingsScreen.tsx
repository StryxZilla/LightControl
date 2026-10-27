import React, { useState, useEffect } from 'react';
import { useDevice } from '../context/DeviceContext.tsx';
import { Icon } from '../components/Icon.tsx';
import type { SegmentConfig } from '../../../../../packages/core/src/types.ts';

export const DeviceSettingsScreen: React.FC = () => {
  const {
    selectedDevice,
    setSegments,
    connectDevice,
    disconnectDevice,
    rescanDevices,
    testConnection,
    updateDeviceConfig,
    isScanning,
  } = useDevice();

  if (!selectedDevice) {
    return (
      <div className="p-8 text-center text-gray-400">
        No controller selected. Please navigate to Controllers & Transports to select a device.
      </div>
    );
  }

  // Parse host and port from connectionInfo address
  const [host, setHost] = useState('');
  const [port, setPort] = useState('8587');
  const [deviceName, setDeviceName] = useState(selectedDevice.name);
  const [icType, setIcType] = useState('WS2812B');
  const [pixelCount, setPixelCount] = useState(selectedDevice.capabilities.maxTotalPixels || 60);
  const [channelOrder, setChannelOrder] = useState('GRB');

  // Test connection state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
    firmware?: string;
    pixels?: number;
  } | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    setDeviceName(selectedDevice.name);
    setPixelCount(selectedDevice.capabilities.maxTotalPixels || 60);

    const addr = selectedDevice.connectionInfo.address || '';
    if (addr.includes(':')) {
      const parts = addr.split(':');
      setHost(parts[0] || '192.168.86.34');
      setPort(parts[1] || '8587');
    } else {
      setHost(addr || '192.168.86.34');
      setPort('8587');
    }
  }, [selectedDevice.id]);

  const [segmentsList, setSegmentsList] = useState<SegmentConfig[]>(
    selectedDevice.state.segments || [
      { id: 0, start: 0, stop: pixelCount, length: pixelCount, on: true },
    ]
  );

  const isConnected = selectedDevice.connectionInfo.state === 'connected';

  const handleTestConnection = async () => {
    if (!testConnection) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const portNum = parseInt(port, 10) || 8587;
      const res = await testConnection(host, portNum);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Test error: ${err.message}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!updateDeviceConfig) return;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const portNum = parseInt(port, 10) || 8587;
      await updateDeviceConfig(selectedDevice.id, {
        name: deviceName,
        host,
        port: portNum,
        icType,
        pixelCount,
        channelOrder,
      });
      setSaveMessage('Configuration saved successfully');
      setTimeout(() => setSaveMessage(null), 3500);
    } catch (err: any) {
      setSaveMessage(`Save failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddSegment = () => {
    if (segmentsList.length >= selectedDevice.capabilities.maxSegments) return;
    const lastStop = segmentsList[segmentsList.length - 1]?.stop || 0;
    const newStop = Math.min(pixelCount, lastStop + 20);

    const newSeg: SegmentConfig = {
      id: segmentsList.length,
      start: lastStop,
      stop: newStop,
      length: newStop - lastStop,
      on: true,
    };

    const updated = [...segmentsList, newSeg];
    setSegmentsList(updated);
    setSegments(updated);
  };

  const handleRemoveSegment = (id: number) => {
    if (segmentsList.length <= 1) return;
    const updated = segmentsList.filter((s) => s.id !== id);
    setSegmentsList(updated);
    setSegments(updated);
  };

  return (
    <div className="p-8 space-y-8 overflow-y-auto max-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-white">Device Configuration</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-mono uppercase bg-blue-500/10 border border-blue-500/30 text-blue-400">
              {selectedDevice.family.toUpperCase()}
            </span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-mono uppercase font-semibold border ${
                isConnected
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : selectedDevice.connectionInfo.state === 'connecting'
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 animate-pulse'
                  : 'bg-gray-800 text-gray-400 border-gray-700'
              }`}
            >
              {selectedDevice.connectionInfo.state.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Verified network transport parameters, hardware identification, and LED output calibration
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => rescanDevices()}
            disabled={isScanning}
            className="px-3.5 py-2 bg-[#21262d] hover:bg-[#30363d] text-gray-200 border border-[#30363d] rounded-md text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <Icon name="refresh" className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>Rescan Subnet</span>
          </button>
          <button
            onClick={handleSaveConfig}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-semibold flex items-center gap-2 transition-all shadow-md shadow-blue-600/30 disabled:opacity-50"
          >
            <Icon name="sliders" className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </div>

      {saveMessage && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs rounded-lg flex items-center gap-2 animate-fadeIn">
          <Icon name="check" className="w-4 h-4 text-emerald-400" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Grid: 2 Separate Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* SECTION 1: Network & Connection Configuration */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[#30363d] pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Icon name="link" className="w-4 h-4 text-cyan-400" />
              <span>Network & Connection Transport</span>
            </h3>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
              Verified SPNET Protocol
            </span>
          </div>

          {/* Device Name */}
          <div className="space-y-1.5">
            <label className="text-xs text-gray-300 font-medium">Device Label</label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="SP530E Controller"
              className="w-full bg-[#0d1117] border border-[#30363d] text-white text-xs rounded-md px-3 py-2 font-mono outline-none focus:border-blue-500"
            />
          </div>

          {/* Controller Model & Architecture */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] text-gray-400 font-medium">Actual Hardware Model</label>
              <div className="p-2 bg-[#0d1117] border border-[#30363d] rounded text-xs font-mono text-white">
                BanlanX SP530E (5CH)
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-gray-400 font-medium">Transport Protocol</label>
              <div className="p-2 bg-[#0d1117] border border-[#30363d] rounded text-xs font-mono text-cyan-400">
                {selectedDevice.connectionInfo.transport === 'wifi-tcp' ? 'Local Wi-Fi (TCP)' : 'WinRT BLE (GATT)'}
              </div>
            </div>
          </div>

          {/* IP and Port */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs text-gray-300 font-medium">Target IP Address</label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="192.168.86.34"
                className="w-full bg-[#0d1117] border border-[#30363d] text-white text-xs rounded-md px-3 py-2 font-mono outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-300 font-medium">Verified TCP Port</label>
              <input
                type="text"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="8587"
                className="w-full bg-[#0d1117] border border-[#30363d] text-white text-xs rounded-md px-3 py-2 font-mono outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Controller Telemetry Snapshot */}
          <div className="p-3.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-xs font-mono text-gray-300 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-gray-400">Firmware Version:</span>
              <span className="text-cyan-400 font-bold">
                {selectedDevice.capabilities.firmwareInfo?.version || 'V2.0.13 (Wire Telemetry)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Connection State:</span>
              <span className={isConnected ? 'text-emerald-400' : 'text-gray-400'}>
                {selectedDevice.connectionInfo.state.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Active Endpoint:</span>
              <span>{host}:{port}</span>
            </div>
          </div>

          {/* Test Connection Button & Result */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3">
              <button
                onClick={handleTestConnection}
                disabled={isTesting || !host}
                className="flex-1 px-3.5 py-2 bg-[#21262d] hover:bg-[#30363d] text-cyan-300 border border-cyan-500/30 rounded-md text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <Icon name="refresh" className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-cyan-400' : 'text-cyan-400'}`} />
                <span>{isTesting ? 'Testing Socket (2500ms)...' : 'Test Connection'}</span>
              </button>

              {isConnected ? (
                <button
                  onClick={() => disconnectDevice(selectedDevice.id)}
                  className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-md text-xs font-semibold transition-all"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={() => connectDevice(selectedDevice.id)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-semibold transition-all shadow-sm"
                >
                  Connect
                </button>
              )}
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-lg border text-xs font-mono animate-fadeIn ${
                  testResult.success
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                }`}
              >
                <div className="flex items-center gap-2 font-bold mb-1">
                  <Icon name={testResult.success ? 'check' : 'alert'} className="w-4 h-4" />
                  <span>{testResult.success ? 'Connection Test Succeeded' : 'Connection Test Failed'}</span>
                </div>
                <div className="text-[11px] opacity-90">{testResult.message}</div>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 2: LED Hardware Output Configuration */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[#30363d] pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Icon name="sliders" className="w-4 h-4 text-purple-400" />
              <span>LED Hardware Strip Output</span>
            </h3>
            <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
              Addressable IC
            </span>
          </div>

          {/* IC Selection */}
          <div className="space-y-1.5">
            <label className="text-xs text-gray-300 font-medium">Driver IC Protocol</label>
            <select
              value={icType}
              onChange={(e) => setIcType(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] text-white text-xs rounded-md px-3 py-2 font-mono outline-none focus:border-blue-500"
            >
              <option value="WS2812B">WS2812B (Standard High-Speed 800kHz)</option>
              <option value="WS2811">WS2811 (12V Regulated)</option>
              <option value="SK6812">SK6812 (RGBW Dedicated White)</option>
              <option value="UCS1903">UCS1903 (High Frequency)</option>
            </select>
          </div>

          {/* Color Channel Order & Total Pixels */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-gray-300 font-medium">Color Channel Order</label>
              <select
                value={channelOrder}
                onChange={(e) => setChannelOrder(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] text-white text-xs rounded-md px-3 py-2 font-mono outline-none focus:border-blue-500"
              >
                <option value="GRB">GRB (Standard WS2812B)</option>
                <option value="RGB">RGB (Direct Mapping)</option>
                <option value="BRG">BRG (Inverted)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-300 font-medium">Total Pixel Count</label>
              <input
                type="number"
                min="1"
                max="1024"
                value={pixelCount}
                onChange={(e) => setPixelCount(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-[#0d1117] border border-[#30363d] text-white text-xs rounded-md px-3 py-2 font-mono outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Visual Strip Segmentation Bar */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-400 font-medium uppercase">Visual Strip Partition</span>
              <button
                onClick={handleAddSegment}
                disabled={segmentsList.length >= selectedDevice.capabilities.maxSegments}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-semibold rounded flex items-center gap-1 disabled:opacity-50"
              >
                <Icon name="plus" className="w-3 h-3" />
                <span>Add Zone</span>
              </button>
            </div>

            <div className="h-6 w-full rounded-md bg-[#0d1117] border border-[#30363d] flex overflow-hidden">
              {segmentsList.map((seg, idx) => {
                const colors = ['bg-blue-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500'];
                const widthPercent = (seg.length / pixelCount) * 100;

                return (
                  <div
                    key={seg.id}
                    style={{ width: `${widthPercent}%` }}
                    className={`${colors[idx % colors.length]} flex items-center justify-center text-[10px] font-mono font-bold text-black border-r border-black/30 truncate px-1`}
                    title={`Zone ${seg.id}: Pixels ${seg.start}-${seg.stop}`}
                  >
                    Z{seg.id}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Segment Details List */}
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {segmentsList.map((seg) => (
              <div
                key={seg.id}
                className="p-2.5 bg-[#0d1117] border border-[#30363d] rounded-lg flex items-center justify-between text-xs font-mono"
              >
                <div>
                  <span className="font-bold text-white">Zone {seg.id}: </span>
                  <span className="text-gray-400">
                    Pixels {seg.start} to {seg.stop} ({seg.length} LEDs)
                  </span>
                </div>
                {segmentsList.length > 1 && (
                  <button
                    onClick={() => handleRemoveSegment(seg.id)}
                    className="text-gray-500 hover:text-rose-400 p-1"
                    title="Remove Zone"
                  >
                    <Icon name="trash" className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
