# Architecture Decision Records (ADRs)

## ADR-001: Universal LED Hardware Abstraction Layer (HAL)
- **Status**: Accepted
- **Context**: The application must support diverse hardware controllers starting with the BanlanX SP530E (via BLE and potentially Wi-Fi) and QuinLED dig2go (via WLED HTTP/WebSocket), with future controllers anticipated. Different hardware platforms have radically different color spaces, effect repertoires, segment models, and transport layers.
- **Decision**:
  - Define a transport-agnostic interface `ILedDevice` and `ILedAdapter`.
  - Every controller exposes a dynamic `DeviceCapabilities` object declaring supported capabilities (RGB, RGBW, CCT, IC types, segmented controls, built-in effects, music reactive modes, timers).
  - The presentation layer must render UI controls dynamically based on the device's capability flags.
  - The core application logic must never inspect device models directly or assume uniform capabilities.
- **Consequences**:
  - High degree of modularity and maintainability.
  - Easier unit testing using a `MockAdapter`.
  - Additional upfront work required to design a rich capability schema.

---

## ADR-002: Desktop Application Technology Stack
- **Status**: Accepted
- **Context**: The application must provide a responsive, cross-version Windows 10/11 desktop experience with modern UI styling, local hardware connectivity, and robust IPC.
- **Decision**:
  - **Framework**: Electron with TypeScript.
  - **Renderer**: React with Vite for fast HMR and lightweight bundle size.
  - **Styling**: Tailwind CSS for component styling and dark-theme controls.
  - **Security Model**: Strict Context Isolation (`contextIsolation: true`), Sandboxed Preload (`sandbox: true`), and explicit IPC channels. No direct Node.js API access from the UI layer.
- **Consequences**:
  - Ensures a modern desktop UX with native performance for UI rendering.
  - Keeps hardware logic isolated in the Node.js/Electron main process.

---

## ADR-003: Clean-Room Reverse Engineering & Protocol Isolation
- **Status**: Accepted
- **Context**: Protocol details for the SP530E controller must be derived from the BanlanX Android application and hardware interaction. We must maintain strict legal and ethical compliance.
- **Decision**:
  - Reverse engineering is strictly limited to identifying message framing, command byte identifiers, checksum routines, and GATT UUIDs required for interoperability.
  - No decompiled source code or proprietary assets will be committed to the repository.
  - All protocol definitions will be translated into clean TypeScript types, encoders, and decoders written from scratch.
- **Consequences**:
  - Total legal compliance and zero intellectual property contamination.
  - Codebase remains completely open-source and independent.

---

## ADR-004: Windows Bluetooth Low Energy Transport Strategy
- **Status**: Proposed
- **Context**: Node.js BLE native modules (e.g., `@abandonware/noble`) frequently encounter native build friction (node-gyp, Python, MSVC build tools) or runtime instability across different Windows 10/11 WinRT versions.
- **Decision**:
  - Phase 1/2 will test direct Node.js BLE bindings if practical.
  - If native Node compilation or runtime crashes occur, we will implement a decoupled worker/helper process using standard Windows WinRT Bluetooth APIs (`Windows.Devices.Bluetooth.GenericAttributeProfile`), communicating with Electron via standard JSON-RPC over stdin/stdout.
- **Consequences**:
  - Eliminates native compilation roadblocks on developer machines.
  - Guarantees 100% native Windows BLE reliability using Microsoft's supported WinRT APIs.
