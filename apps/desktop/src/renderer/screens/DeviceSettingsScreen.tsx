import React, { useState } from 'react';
import { useDevice } from '../context/DeviceContext.tsx';
import { Icon } from '../components/Icon.tsx';
import type { SegmentConfig } from '../../../../../packages/core/src/types.ts';

export const DeviceSettingsScreen: React.FC = () => {
  const { selectedDevice, setSegments } = useDevice();

  if (!selectedDevice) {
    return <div className="p-8 text-center text-gray-400">No device selected.</div>;
  }

  const [icType, setIcType] = useState('WS2812B');
  const [pixelCount, setPixelCount] = useState(selectedDevice.capabilities.maxTotalPixels || 60);
  const [channelOrder, setChannelOrder] = useState('GRB');

  const [segmentsList, setSegmentsList] = useState<SegmentConfig[]>(
    selectedDevice.state.segments || [
      { id: 0, start: 0, stop: pixelCount, length: pixelCount, on: true },
    ]
  );

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
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Hardware Strip Configuration</h2>
        <p className="text-xs text-gray-400 mt-1">
          Configure physical addressable chipset, length, and multi-segment partitions for {selectedDevice.name}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Card: Hardware IC & Pixel Settings */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 space-y-5">
          <h3 className="text-sm font-bold text-white">Chipset & Channel Calibration</h3>

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

          {/* Total Pixel Count */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <label className="text-gray-300 font-medium">Total Addressable Pixels</label>
              <span className="font-mono text-cyan-400">{pixelCount} LEDs</span>
            </div>
            <input
              type="number"
              min="1"
              max={selectedDevice.capabilities.maxTotalPixels}
              value={pixelCount}
              onChange={(e) => setPixelCount(parseInt(e.target.value, 10) || 1)}
              className="w-full bg-[#0d1117] border border-[#30363d] text-white text-xs rounded-md px-3 py-2 font-mono outline-none focus:border-blue-500"
            />
          </div>

          {/* Color Channel Order */}
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

          {/* Controller Info Snapshot */}
          <div className="p-3 bg-[#0d1117] border border-[#30363d] rounded-lg text-xs font-mono text-gray-400 space-y-1">
            <div>Firmware: {selectedDevice.capabilities.firmwareInfo?.version || 'N/A'}</div>
            <div>Model: {selectedDevice.capabilities.firmwareInfo?.model || selectedDevice.family}</div>
            <div>Max Segments: {selectedDevice.capabilities.maxSegments}</div>
          </div>
        </div>

        {/* Right Card: Multi-Segment Partitioning */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Multi-Segment Zoning</h3>
            <button
              onClick={handleAddSegment}
              disabled={segmentsList.length >= selectedDevice.capabilities.maxSegments}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-md flex items-center gap-1.5 disabled:opacity-50"
            >
              <Icon name="plus" className="w-3.5 h-3.5" />
              <span>Add Zone</span>
            </button>
          </div>

          {/* Visual Strip Segmentation Bar */}
          <div className="space-y-2">
            <div className="text-[10px] text-gray-400 font-medium uppercase">Visual Strip Partition</div>
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
          <div className="space-y-2.5">
            {segmentsList.map((seg) => (
              <div
                key={seg.id}
                className="p-3 bg-[#0d1117] border border-[#30363d] rounded-lg flex items-center justify-between text-xs font-mono"
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
                    <Icon name="trash" className="w-4 h-4" />
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
