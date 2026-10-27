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

---

## ADR-005: Modular Architecture & Dependency Injection for Device Adapters
- **Status**: Accepted
- **Context**: The application must support heterogeneous device families (`sp530e`, `wled`, `mock`) with distinct network and radio transports (Bluetooth LE GATT, local Wi-Fi TCP, HTTP REST, WebSocket). Hardcoding device creation or tightly coupling transports to presentation logic introduces rigidity and breaks extensibility.
- **Decision**:
  - Implement a pluggable Hardware Abstraction Layer (HAL) centered on `ILedAdapter` and `ILedDevice`.
  - Use Dependency Injection via `DeviceManager.registerAdapter(adapter)` to dynamically register adapters at boot or runtime.
  - Decouple device discovery orchestration: `DeviceManager.startDiscovery()` triggers discovery across all registered adapters concurrently using `Promise.all`.
  - Maintain clean separation between protocol codecs (`Sp530eBleCodec`, `SpnetCodec`, `WledCodec`) and device runtime classes (`SP530EBleDevice`, `SP530EWiFiDevice`, `WledDevice`, `MockLedDevice`).
- **Consequences**:
  - New controllers (e.g., Govee, Zigbee/ZHA, ArtNet/DMX) can be plugged in by implementing `ILedAdapter` without modifying core logic.
  - Full testability via `MockAdapter` without requiring real hardware radios.
  - Decouples UI presentation from hardware transport nuances.

---

## ADR-006: Centralized Command Rate Limiting & Coalescing Engine
- **Context**: High-frequency user interactions (rapidly dragging a brightness slider or color picker wheel) generate dozens of state mutation events per second. Hardware controllers like the SP530E (running microcontrollers over BLE GATT or raw TCP sockets) suffer from small receive buffers and cannot process unthrottled bursts, resulting in dropped packets, desynchronized states, or connection drops.
- **Status**: Accepted
- **Decision**:
  - Implement a centralized `DeviceRateLimiter` with a default 50ms window (maximum 20 Hz command rate).
  - Rapid sequential mutations within the cooldown interval are coalesced into a trailing execution.
  - Intermediate values are safely discarded while the final user selection is guaranteed to be transmitted to the hardware.
  - All pending promises from coalesced callers resolve with the final execution result, preventing unhandled promises or memory leaks.
  - Independent per-device execution queues prevent throttling on one controller from impacting another.
- **Consequences**:
  - Complete elimination of hardware packet buffer overruns and radio congestion.
  - Fluid, latency-free slider and color picker experience in the UI with guaranteed eventual consistency on physical LEDs.
