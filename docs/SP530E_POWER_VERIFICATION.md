# SP530E Power Command Verification & Hardware Test Results

## 1. Verified Command Byte Structure

### 1.1 SPTECH Wi-Fi TCP Power Command (14 Bytes Verified Live)
* **Transport**: TCP Port 8587 (`SPNET`)
* **Endpoint**: `192.168.86.34:8587`
* **Raw Wire Bytes (Power OFF)**:
  `53 50 54 45 43 48 00 50 00 00 00 00 01 00`
* **Raw Wire Bytes (Power ON)**:
  `53 50 54 45 43 48 00 50 00 00 00 00 01 01`
* **Dissection**:
  - `53 50 54 45 43 48 00` (Bytes 0..6): ASCII `"SPTECH\0"` Magic Prefix
  - `50` (Byte 7): Command Opcode `0x50` (`CMD_POWER` in SPTech protocol)
  - `00` (Byte 8): Session/Encoder Key (`0x00`)
  - `00 00` (Bytes 9..10): Single packet (0 of 0)
  - `00 01` (Bytes 11..12): 16-bit Big-Endian payload length (1 byte)
  - `00` / `01` (Byte 13): Target State (`0x00` = Power OFF, `0x01` = Power ON)

### 1.2 BanlanX Gen 3 BLE Companion Frame
* **Transport**: Bluetooth Low Energy GATT Characteristic `0xFFE1`
* **Peripheral MAC**: `7C:4F:AD:EB:2A:AA`
* **Raw Wire Bytes (7 bytes)**:
  `53 50 00 01 00 01 00`
* **Dissection**:
  - `53`: ASCII `'S'` Frame Header
  - `50`: Opcode `0x50` (Power Command)
  - `00`: Sub-command / Sequence key
  - `01`: Delivery flag
  - `00 01`: 16-bit Big-Endian payload length (1 byte)
  - `00`: Power state (`0x00` = OFF, `0x01` = ON)

---

## 2. Empirical Hardware Test Execution & Results

### Test Execution Log (`scripts/test-sp530e-power-hardware.ts`)
```text
Connecting to SP530E hardware at 192.168.86.34:8587...
TCP Socket Connected.
1. Querying initial device state...
Initial State: Power=ON, Brightness=100%, Mode=solid, Pixels=60, FW=V2.0.13
Initial Raw Hex: 5350544543480002000000019f01010011001e56322e302e313320860303...

2. Transmitting exactly ONE Power OFF command (Opcode 0x50):
   Packet Hex: 5350544543480050000000000100 (14 bytes)
   Packet successfully written to socket.

3. Querying post-command device state...
Post-Command State: Power=OFF, Brightness=100%
Post-Command Raw Hex: 5350544543480002000000019f01010011001e56322e302e313320860303...

--- Verification Summary ---
Before: Power ON
After : Power OFF
State Changed: true
```

### Telemetry Difference Breakdown:
- **Pre-Command Buffer Offset 40**: `0x01` (`Power = ON`)
- **Post-Command Buffer Offset 40**: `0x00` (`Power = OFF`)
- **Total Payload Diffs**: Exactly 1 byte modified in the 428-byte device state block.
- **Hardware Status**: Confirmed hardware execution and telemetry sync.

---

## 3. Automated Test Suite Status
* Static checks: **0 errors**
* Unit & regression test suite: **80 / 80 tests passing**
  - Mutex lock against concurrent socket races: **PASS**
  - FIFO command queue and retry on transient drop: **PASS**
  - Split / concatenated stream frame parser: **PASS**
  - BLE filter excluding random peripherals: **PASS**
  - Rate limiter asynchronous serialization: **PASS**
  - SPTech command opcodes (Power `0x50`, Brightness `0x51`, Color `0x52`, Mode `0x53`): **PASS**
