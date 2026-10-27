import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.tsx';
import { DeviceProvider } from './context/DeviceContext.tsx';
import './index.css';

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <DeviceProvider>
        <App />
      </DeviceProvider>
    </React.StrictMode>
  );
}
