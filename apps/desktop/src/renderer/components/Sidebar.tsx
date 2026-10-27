import React from 'react';
import { useDevice } from '../context/DeviceContext.tsx';
import { Icon } from './Icon.tsx';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentProps<typeof Icon>['name'];
  shortcut?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'OVERVIEW',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', shortcut: 'Ctrl+1' },
      { id: 'devices', label: 'Controllers', icon: 'devices', shortcut: 'Ctrl+2' },
    ],
  },
  {
    title: 'LIGHTING CONTROL',
    items: [
      { id: 'color', label: 'Color Picker', icon: 'color', shortcut: 'Ctrl+3' },
      { id: 'power', label: 'Power & Brightness', icon: 'power', shortcut: 'Ctrl+4' },
      { id: 'effects', label: 'Dynamic Effects', icon: 'effects', shortcut: 'Ctrl+5' },
      { id: 'music', label: 'Music Reactive', icon: 'music', shortcut: 'Ctrl+6' },
    ],
  },
  {
    title: 'SCENES & ZONES',
    items: [
      { id: 'presets', label: 'Presets & Scenes', icon: 'presets', shortcut: 'Ctrl+7' },
      { id: 'grouping', label: 'Device Grouping', icon: 'grouping', shortcut: 'Ctrl+8' },
    ],
  },
  {
    title: 'HARDWARE & SYSTEM',
    items: [
      { id: 'device-settings', label: 'Strip Configuration', icon: 'sliders' },
      { id: 'diagnostics', label: 'Diagnostics & Logs', icon: 'diagnostics' },
      { id: 'settings', label: 'App Settings', icon: 'settings' },
    ],
  },
];

export const Sidebar: React.FC = () => {
  const { activeScreen, setActiveScreen, selectedDevice, settings } = useDevice();

  return (
    <aside className="w-64 bg-[#161b22] border-r border-[#30363d] flex flex-col h-screen select-none">
      {/* App Branding */}
      <div className="h-16 flex items-center px-5 border-b border-[#30363d] gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Icon name="effects" className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-wide text-white">Universal LED</h1>
          <p className="text-[11px] text-gray-400 font-mono">v0.1.0 • Windows 11</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <div className="px-3 mb-1.5 text-[10px] font-bold tracking-wider text-gray-400 uppercase">
              {section.title}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = activeScreen === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveScreen(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                        : 'text-gray-300 hover:bg-[#21262d] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        name={item.icon}
                        className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400'}`}
                      />
                      <span>{item.label}</span>
                    </div>
                    {item.shortcut && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                          isActive ? 'bg-blue-700 text-blue-100' : 'bg-[#21262d] text-gray-400'
                        }`}
                      >
                        {item.shortcut.replace('Ctrl+', '^')}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer Active Target Badge */}
      <div className="p-3 border-t border-[#30363d] bg-[#0d1117]/60">
        <div className="text-[10px] text-gray-400 font-medium mb-1">TARGET CONTROLLER</div>
        {selectedDevice ? (
          <div className="flex items-center justify-between">
            <div className="truncate pr-2">
              <div className="text-xs font-semibold text-white truncate">{selectedDevice.name}</div>
              <div className="text-[10px] font-mono text-gray-400">
                {selectedDevice.connectionInfo.transport.toUpperCase()} •{' '}
                {selectedDevice.connectionInfo.state}
              </div>
            </div>
            <span
              className={`w-2 h-2 rounded-full ${
                selectedDevice.connectionInfo.state === 'connected' ? 'bg-emerald-400 shadow-glow-cyan' : 'bg-amber-400'
              }`}
            />
          </div>
        ) : (
          <div className="text-xs text-gray-500 italic">No device selected</div>
        )}

        {settings.dryRun && (
          <div className="mt-2 text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-300 px-2 py-0.5 rounded text-center font-mono">
            DRY-RUN SAFETY MODE
          </div>
        )}
      </div>
    </aside>
  );
};
