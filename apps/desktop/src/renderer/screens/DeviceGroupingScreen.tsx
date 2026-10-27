import React, { useState } from 'react';
import { useDevice } from '../context/DeviceContext.tsx';
import { Icon } from '../components/Icon.tsx';

interface DeviceGroup {
  id: string;
  name: string;
  deviceIds: string[];
}

export const DeviceGroupingScreen: React.FC = () => {
  const { devices, setPower } = useDevice();
  const [groups, setGroups] = useState<DeviceGroup[]>([
    {
      id: 'group-all',
      name: 'Entire Installation (All Lights)',
      deviceIds: devices.map((d) => d.id),
    },
    {
      id: 'group-living',
      name: 'Living Room Zone',
      deviceIds: [devices[0]?.id || ''],
    },
  ]);

  const [newGroupName, setNewGroupName] = useState('');

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    setGroups([
      ...groups,
      {
        id: `group-${Date.now()}`,
        name: newGroupName.trim(),
        deviceIds: [devices[0]?.id || ''],
      },
    ]);
    setNewGroupName('');
  };

  const toggleDeviceInGroup = (groupId: string, deviceId: string) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const exists = g.deviceIds.includes(deviceId);
        return {
          ...g,
          deviceIds: exists
            ? g.deviceIds.filter((id) => id !== deviceId)
            : [...g.deviceIds, deviceId],
        };
      })
    );
  };

  const syncGroupPower = async (group: DeviceGroup, on: boolean) => {
    for (const id of group.deviceIds) {
      // Set power on each member
      setPower(on);
    }
  };

  return (
    <div className="p-8 space-y-8 overflow-y-auto max-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Device Grouping & Zones</h2>
          <p className="text-xs text-gray-400 mt-1">
            Synchronize power, color, and scenes across multiple physical controllers
          </p>
        </div>
      </div>

      {/* Add Group Form */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 flex items-center gap-3">
        <input
          type="text"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          placeholder="New Zone Name (e.g. Master Bedroom, Accent Strips)..."
          className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-xs text-white focus:border-blue-500 outline-none"
        />
        <button
          onClick={handleCreateGroup}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-md shadow-sm flex items-center gap-2"
        >
          <Icon name="plus" className="w-4 h-4" />
          <span>Add Group</span>
        </button>
      </div>

      {/* Group Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {groups.map((group) => (
          <div key={group.id} className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Icon name="grouping" className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{group.name}</h3>
                  <div className="text-[10px] text-gray-400 font-mono">
                    {group.deviceIds.length} Assigned Controllers
                  </div>
                </div>
              </div>

              {/* Group Quick Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => syncGroupPower(group, true)}
                  className="px-3 py-1 bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold rounded hover:bg-emerald-600/30"
                >
                  All ON
                </button>
                <button
                  onClick={() => syncGroupPower(group, false)}
                  className="px-3 py-1 bg-gray-800 text-gray-400 border border-gray-700 text-xs font-semibold rounded hover:bg-gray-700"
                >
                  All OFF
                </button>
              </div>
            </div>

            {/* Member Devices Checklist */}
            <div className="space-y-2 pt-2 border-t border-[#30363d]">
              <div className="text-[10px] text-gray-400 uppercase font-medium">Zone Members:</div>
              {devices.map((device) => {
                const isMember = group.deviceIds.includes(device.id);

                return (
                  <label
                    key={device.id}
                    className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                      isMember
                        ? 'bg-[#21262d] border-blue-500/50 text-white'
                        : 'bg-[#0d1117] border-[#30363d] text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isMember}
                        onChange={() => toggleDeviceInGroup(group.id, device.id)}
                        className="accent-blue-500 rounded"
                      />
                      <span className="text-xs font-medium">{device.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-gray-500 uppercase">
                      {device.family}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
