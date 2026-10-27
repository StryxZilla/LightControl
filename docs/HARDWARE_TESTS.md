# Hardware Test Plans & Verification Log

## 1. Safety Policies & Operational Rules
1. **Explicit Permission Required**: No active BLE command or network packet shall be sent to physical hardware without explicit user approval.
2. **Current Limiting Awareness**: Ensure strip configurations do not demand current exceeding the power supply's rated wattage to prevent hardware brownouts or damage.
3. **Conservative Default Limits**: Initial testing will enforce a software brightness cap (e.g., 20% max brightness) and low pixel count (e.g., 30 pixels) until thermal and power stability is confirmed.
4. **Zero Fabrication**: All test results (RSSI, connection latency, packet response, visual LED state) must be recorded accurately from real physical observation or verified diagnostic logs.
5. **Connection Exclusivity Warning**: Before initiating any Bluetooth connection from Windows, the BanlanX app on Android must be closed or disconnected, as the SP530E firmware only permits one active BLE connection.

---

## 2. Test Environment Baseline
- **Host**: Windows 10/11 Desktop
- **Primary Target**: SP530E Controller (ESP32-C3 based)
- **Power Supply**: Dedicated DC power adapter (voltage matched to LED strip: 5V/12V/24V)
- **Attached LED Strip**: WS2812B / WS2811 / PWM strip (user specified)
- **Secondary Target**: QuinLED dig2go (ESP32 running WLED)
- **Diagnostic Tools**: ADB logcat, Windows Bluetooth Diagnostic tools, WireShark/Packet capture if needed.

---

## 3. Test Scenarios

### Test Suite 01: SP530E BLE Connection & Discovery
- **TC-01.1**: Discover SP530E advertisement via Windows BLE scanner (Look for manufacturer ID `20563` or service `0xFFE0`).
- **TC-01.2**: Connect to SP530E and enumerate GATT Services and Characteristics (`0xFFE0` / `0xFFE1`).
- **TC-01.3**: Subscribe to notifications on `0xFFE1` and record initial device state payload.

### Test Suite 02: SP530E Core Commands (Safe Verification)
- **TC-02.1**: Send Power Toggle / Power Off packet. Verify LED strip turns off.
- **TC-02.2**: Send Power On packet. Verify strip restores state.
- **TC-02.3**: Send Solid Color (Red, Green, Blue) at 10% brightness. Verify color rendering.
- **TC-02.4**: Send Brightness Step (10% -> 50% -> 10%). Verify smooth adjustment.

### Test Suite 03: SP530E Wi-Fi / SPNET Local LAN Communication
- **TC-03.1**: Send UDP discovery broadcast on port `8587` to detect SP530E IP address on local network.
- **TC-03.2**: Open TCP socket to `<Controller-IP>:8587` and send 13-byte `SPTECH\0` query packet.
- **TC-03.3**: Validate parsed state response chunk vs. BLE state response.

### Test Suite 04: WLED HTTP / WebSocket Integration
- **TC-04.1**: Discover / Connect to QuinLED dig2go via IP address.
- **TC-04.2**: Read device state via `/json/state` and info via `/json/info`.
- **TC-04.3**: Send state updates via JSON API and WebSocket.

---

## 4. Hardware Test Execution Log

| Test ID | Date | Target Device | Action Performed | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| *HT-001* | *Pending* | SP530E | BLE Advertisement Scan | Locate device MAC & name | Awaiting Phase 3 | Pending |
| *HT-002* | *Pending* | SP530E | Wi-Fi UDP Discovery (8587) | Locate device IP address | Awaiting Phase 3 | Pending |
