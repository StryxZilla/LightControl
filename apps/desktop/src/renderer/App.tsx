import React, { useEffect } from 'react';
import { useDevice } from './context/DeviceContext.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { Header } from './components/Header.tsx';

// All 11 Screens
import { DashboardScreen } from './screens/DashboardScreen.tsx';
import { DeviceConnectionScreen } from './screens/DeviceConnectionScreen.tsx';
import { ColorControlScreen } from './screens/ColorControlScreen.tsx';
import { PowerBrightnessScreen } from './screens/PowerBrightnessScreen.tsx';
import { EffectsBrowserScreen } from './screens/EffectsBrowserScreen.tsx';
import { MusicReactiveScreen } from './screens/MusicReactiveScreen.tsx';
import { PresetsScenesScreen } from './screens/PresetsScenesScreen.tsx';
import { DeviceGroupingScreen } from './screens/DeviceGroupingScreen.tsx';
import { DeviceSettingsScreen } from './screens/DeviceSettingsScreen.tsx';
import { DiagnosticsScreen } from './screens/DiagnosticsScreen.tsx';
import { AppSettingsScreen } from './screens/AppSettingsScreen.tsx';

export const App: React.FC = () => {
  const { activeScreen, setActiveScreen, selectedDevice, setPower } = useDevice();

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            setActiveScreen('dashboard');
            break;
          case '2':
            e.preventDefault();
            setActiveScreen('devices');
            break;
          case '3':
            e.preventDefault();
            setActiveScreen('color');
            break;
          case '4':
            e.preventDefault();
            setActiveScreen('power');
            break;
          case '5':
            e.preventDefault();
            setActiveScreen('effects');
            break;
          case '6':
            e.preventDefault();
            setActiveScreen('music');
            break;
          case '7':
            e.preventDefault();
            setActiveScreen('presets');
            break;
          case '8':
            e.preventDefault();
            setActiveScreen('grouping');
            break;
          case 'p':
          case 'P':
            e.preventDefault();
            if (selectedDevice) {
              setPower(!selectedDevice.state.power);
            }
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveScreen, selectedDevice, setPower]);

  const renderActiveScreen = () => {
    switch (activeScreen) {
      case 'dashboard':
        return <DashboardScreen />;
      case 'devices':
        return <DeviceConnectionScreen />;
      case 'color':
        return <ColorControlScreen />;
      case 'power':
        return <PowerBrightnessScreen />;
      case 'effects':
        return <EffectsBrowserScreen />;
      case 'music':
        return <MusicReactiveScreen />;
      case 'presets':
        return <PresetsScenesScreen />;
      case 'grouping':
        return <DeviceGroupingScreen />;
      case 'device-settings':
        return <DeviceSettingsScreen />;
      case 'diagnostics':
        return <DiagnosticsScreen />;
      case 'settings':
        return <AppSettingsScreen />;
      default:
        return <DashboardScreen />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0d1117] text-[#f0f6fc]">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main App Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header />
        <main className="flex-1 overflow-hidden relative">{renderActiveScreen()}</main>
      </div>
    </div>
  );
};
