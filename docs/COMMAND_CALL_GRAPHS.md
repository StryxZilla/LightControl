# SP530E Command Call Graphs & Architectural Traces

**Scope**: End-to-end execution flow from representative UI actions in BanlanX to outgoing wire transmissions.  
**Frameworks Covered**: Flutter Presentation Layer, Native Android Host, Wi-Fi Socket, and BLE GATT.  

---

## 1. Representative UI Action: Color Change Call Graph

This trace demonstrates the end-to-end execution flow when a user selects a color (e.g. Blue `#0000FF`) on the color wheel:

```mermaid
sequenceDiagram
    autonumber
    actor User as User Interaction
    participant UI as Flutter Route: /sp630e/settings/color
    participant State as Sp630eController (Dart)
    participant Lfx as LfxExternParams / LfxColorSet
    participant NetTransport as SPNET TCP Client (Dart Socket)
    participant BLEMethod as MethodChannel: flutter_ble/main
    participant BLEPlugin as Native FlutterBlePlugin (C2.a / E2.d)
    participant AndroidGatt as Android BluetoothGatt API
    participant Hardware as Physical SP530E Controller (ESP32-C3)

    User->>UI: Selects Color #0000FF on HSV Palette
    UI->>State: setLfxColor(Color(0xFF0000FF))
    State->>Lfx: LfxColorProps(r: 0, g: 0, b: 255)
    
    alt Transport Mode == Wi-Fi (SPNET TCP Port 8587)
        State->>NetTransport: sendCommand(0x03, payload: [0x2C, 0x00, 0x00, 0xFF])
        NetTransport->>NetTransport: Prepend 13-Byte Header: "SPTECH\0" + 0x03 + 0x58 + len(4)
        NetTransport->>Hardware: TCP Socket Write to <192.168.86.34:8587>
        Hardware-->>NetTransport: Acknowledges & Updates RMT SPI WS2812B Waveform
    else Transport Mode == Bluetooth Low Energy (0xFFE0 / 0xFFE1)
        State->>BLEMethod: invokeMethod("writeBleCharacteristicValue", {deviceId, serviceUuid, characteristicUuid, value})
        BLEMethod->>BLEPlugin: C2.b.onMethodCall -> E2.d.onMethodCall
        BLEPlugin->>AndroidGatt: writeCharacteristic(char0xFFE1, bytes, WRITE_TYPE_NO_RESPONSE)
        AndroidGatt->>Hardware: Over-The-Air BLE Write to 0xFFE1
        Hardware-->>State: Emits state change event on 0xFFE1 Notification
    end
```

---

## 2. Power Toggle Call Graph

```mermaid
sequenceDiagram
    autonumber
    actor User as User Tap
    participant UI as Flutter Route: /sp630e/settings
    participant State as Sp630eController (Dart)
    participant Codec as SpnetCodec (13-Byte Framing)
    participant Socket as TCP Socket (Port 8587)
    participant Hardware as SP530E Physical Controller

    User->>UI: Taps Power Button (ic_btn_power.png)
    UI->>State: setPower(powerState: false)
    State->>Codec: encodePowerCommand(false)
    Codec->>Codec: Frame: "SPTECH\0" | cmd: 0x03 | key: 0x58 | len: 2 | [0x2A, 0x00]
    Codec->>Socket: Socket.write(frameBuffer)
    Socket->>Hardware: TCP Packet: 53 50 54 45 43 48 00 03 58 00 00 00 02 2A 00
    Hardware->>Hardware: Cut PWM / WS2812B data line drive
    Hardware-->>Socket: TCP State Chunk Response (power: 0)
    Socket-->>State: Decodes data[40] == 0x00
    State-->>UI: Updates UI Power State Indicator to Inactive
```

---

## 3. Wi-Fi Local Discovery Lifecycle (`_spled._tcp`)

```mermaid
sequenceDiagram
    autonumber
    participant App as BanlanX App Launch
    participant LockPlugin as MulticastLockPlugin (H2.a)
    participant WifiMgr as Android WifiManager
    participant Bonsoir as BonsoirPlugin (P2.b / P2.f)
    participant Lan as Local Network (2.4GHz Wi-Fi)
    participant Controller as SP530E Controller (192.168.86.34)

    App->>LockPlugin: invokeMethod("acquire_multicast_lock")
    LockPlugin->>WifiMgr: createMulticastLock("discovery").acquire()
    App->>Bonsoir: startDiscovery(service: "_spled._tcp")
    Bonsoir->>Lan: mDNS Multicast PTR Query for "_spled._tcp.local" (224.0.0.251:5353)
    Controller-->>Lan: mDNS Response: SP530E-34._spled._tcp.local -> 192.168.86.34:8587
    Lan-->>Bonsoir: Receives SRV / A records
    Bonsoir-->>App: BonsoirDiscoveryEventType.discoveryServiceResolved (IP: 192.168.86.34, Port: 8587)
    App->>LockPlugin: invokeMethod("release_multicast_lock")
    LockPlugin->>WifiMgr: release()
    App->>Controller: Opens TCP socket to 192.168.86.34:8587
```

---

## 4. Bluetooth LE Discovery & Connection Lifecycle

```mermaid
sequenceDiagram
    autonumber
    participant App as BanlanX App (Device List)
    participant FlutterBle as MethodChannel: flutter_ble/main
    participant NativeBle as E2.l / E2.d (BLE Manager)
    participant AndroidBt as Android BluetoothAdapter
    participant Device as SP530E BLE Peripheral

    App->>FlutterBle: invokeMethod("startBluetoothDevicesDiscovery", {services: ["0xFFE0"]})
    FlutterBle->>NativeBle: E2.l.onMethodCall("startBluetoothDevicesDiscovery")
    NativeBle->>AndroidBt: BluetoothLeScanner.startScan(filters, settings, callback)
    Device-->>AndroidBt: BLE Advertisement (Mfg ID: 20563, Model: 0x4E, UUID: 0xFFE0)
    AndroidBt-->>NativeBle: onScanResult()
    NativeBle-->>App: EventChannel: bluetooth_device_found (Name, MAC, RSSI, Model 0x4E)
    App->>FlutterBle: invokeMethod("stopBluetoothDevicesDiscovery")
    App->>FlutterBle: invokeMethod("createBleConnection", {deviceId: MAC, timeout: 5000})
    FlutterBle->>NativeBle: E2.d.onMethodCall("createBleConnection")
    NativeBle->>Device: BluetoothDevice.connectGatt(transport: 2)
    Device-->>NativeBle: onConnectionStateChange(GATT_SUCCESS, STATE_CONNECTED)
    NativeBle->>Device: discoverServices()
    Device-->>NativeBle: Enumerated Services: 0xFFE0 -> Characteristic 0xFFE1
    NativeBle->>Device: setCharacteristicNotification(char0xFFE1, true)
    NativeBle-->>App: EventChannel: ble_connection_state_changed (connected: true)
```
