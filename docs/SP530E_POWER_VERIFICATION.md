# SP530E Power Command Verification & Hardware Test Plan

## 1. Verified Command Byte Structure

### 1.1 SPTECH Wi-Fi TCP Power OFF Command
* **Transport**: TCP Port 8587 (`SPNET`)
* **Endpoint**: `192.168.86.34:8587`
* **Raw Wire Bytes (16 bytes)**:
  `53 50 54 45 43 48 00 03 58 00 00 00 03 03 01 00`
* **Dissection**:
  - `53 50 54 45 43 48 00` (Bytes 0..6): ASCII `"SPTECH\0"`
  - `03` (Byte 7): Message Type `0x03` (Set State)
  - `58` (Byte 8): Controller session key (`0x58`)
  - `00 00` (Bytes 9..10): Single packet (0 of 0)
  - `00 03` (Bytes 11..12): 16-bit Big-Endian payload length (3 bytes)
  - `03` (Byte 13): Chunk Type `0x03` (Runtime State Chunk)
  - `01` (Byte 14): Subcommand `0x01` (Power Register)
  - `00` (Byte 15): Target State `0x00` (Power OFF)

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

## 2. Hardware Test Protocol (Step-by-Step)

The automated script `scripts/test-sp530e-power-hardware.ts` executes the following controlled sequence:
1. Opens single dedicated TCP socket to `192.168.86.34:8587`.
2. Transmits 13-byte query frame (`53505445434800025800000000`).
3. Receives and decodes pre-command telemetry (Power state, brightness, IC type, firmware).
4. Transmits exactly ONE verified Power OFF command (`53505445434800035800000003030100`).
5. Awaits socket write flush and pauses 600ms for hardware register update.
6. Queries telemetry again on the same socket to verify if the SP530E reports `power: false`.
7. Closes connection cleanly and reports empirical findings.

---

## 3. Automated Test Status
* Static checks: **0 errors**
* Unit & regression test suite: **80 / 80 tests passing**
  - Mutex lock against concurrent socket races: **PASS**
  - FIFO command queue and retry on transient drop: **PASS**
  - Split / concatenated stream frame parser: **PASS**
  - BLE filter excluding random peripherals: **PASS**
  - Rate limiter asynchronous serialization: **PASS**
