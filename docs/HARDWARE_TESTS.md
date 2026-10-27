# SP530E Hardware Test Plan & Execution Report

## 1. Safety Policies & Operational Boundaries

In accordance with `AGENTS.md` and user safety instructions:
1. **Approval Gate**: Real network/radio packets are never transmitted to physical hardware without explicit user confirmation.
2. **Dry-Run Default**: All testing tools, scripts, and harness CLIs execute in `dryRun: true` mode by default.
3. **Brightness Safety Limit**: A strict **20% maximum brightness cap** is hard-coded into all test sequences to protect the 5V WS2812B LED strip and controller from power supply overload or overheating.
4. **Zero Destructive Operations**: No factory reset opcodes, firmware write frames, or unmapped commands will be sent to the device.

---

## 2. Target Hardware Environment

- **Controller**: BanlanX SP530E Universal LED Controller
- **Firmware Version**: `V2.0.13` (Confirmed via live handshake)
- **Local Network Target**: `192.168.86.34:8587` (Static DHCP lease on LAN)
- **Host Machine**: Windows 11 (`192.168.86.27`)
- **Attached LED Strip**: WS2812B Addressable LED Strip (60 pixels, 5V)
- **Bluetooth Subsystem**: Generic Bluetooth Adapter (`USB\VID_13D3&PID_3586`)

---

## 3. Step-by-Step Test Sequence

| Step | Operation | Parameters | Expected Frame Layout | Success Criteria |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **Socket Handshake** | TCP `192.168.86.34:8587` | `SYN -> SYN/ACK` | Connection established in < 100 ms |
| **2** | **Telemetry Query** | Read-only state query | `53 50 54 45 43 48 00 02 58 00 00 00 00` | 428-byte response received; decoded |
| **3** | **Power ON** | State = ON | `53 50 54 45 43 48 00 03 58 00 00 00 03 03 01 01` | Strip illuminates |
| **4** | **Brightness Cap** | Level = 20% | `53 50 54 45 43 48 00 03 58 00 00 00 03 03 02 33` | LEDs maintain safe 20% intensity |
| **5a**| **Solid RED** | R=255, G=0, B=0 | `53 50 54 45 43 48 00 03 58 00 00 00 05 03 04 FF 00 00` | Entire strip illuminates pure red |
| **5b**| **Solid GREEN** | R=0, G=255, B=0 | `53 50 54 45 43 48 00 03 58 00 00 00 05 03 04 00 FF 00` | Entire strip illuminates pure green |
| **5c**| **Solid BLUE** | R=0, G=0, B=255 | `53 50 54 45 43 48 00 03 58 00 00 00 05 03 04 00 00 FF` | Entire strip illuminates pure blue |
| **6** | **Dynamic Rainbow** | Effect ID = 1, Spd = 50% | `53 50 54 45 43 48 00 03 58 00 00 00 03 03 06 01` | Rainbow wave animates across 60 pixels |

---

## 4. Dry-Run Verification Report

The diagnostic test harness (`apps/test-harness/cli.ts`) was executed across both Wi-Fi and BLE modes with dry-run protection:

### Wi-Fi Dry-Run Execution Summary
```
================================================================
       SP530E CONTROLLER HARDWARE DIAGNOSTIC HARNESS            
================================================================
 Transport Mode     : WIFI
 Target IP:Port     : 192.168.86.34:8587
 Mode               : DRY-RUN (SIMULATED - NO PHYSICAL WRITES)
 Safety Limit       : 20% Brightness Cap Enforced
================================================================
✔ [PASS] 1. Connect Transport
    Details: Connected successfully via wifi
✔ [PASS] 2. Query State
    Details: Power: true, Bri: 20%, Mode: solid, Color: (255,255,255)
✔ [PASS] 3. Set Power ON
    Details: State: power=true
    Wire Bytes: [53 50 54 45 43 48 00 03 58 00 00 00 03 03 01 01]
✔ [PASS] 4. Set Brightness (20%)
    Details: Brightness set to safe cap (20%)
    Wire Bytes: [53 50 54 45 43 48 00 03 58 00 00 00 03 03 02 33]
✔ [PASS] 5a. Color RED (255, 0, 0)
    Details: Color set to Solid Red
    Wire Bytes: [53 50 54 45 43 48 00 03 58 00 00 00 05 03 04 FF 00 00]
✔ [PASS] 5b. Color GREEN (0, 255, 0)
    Details: Color set to Solid Green
    Wire Bytes: [53 50 54 45 43 48 00 03 58 00 00 00 05 03 04 00 FF 00]
✔ [PASS] 5c. Color BLUE (0, 0, 255)
    Details: Color set to Solid Blue
    Wire Bytes: [53 50 54 45 43 48 00 03 58 00 00 00 05 03 04 00 00 FF]
✔ [PASS] 6. Effect Mode 1 (Rainbow, Speed 50%)
    Details: Dynamic effect activated
    Wire Bytes: [53 50 54 45 43 48 00 03 58 00 00 00 03 03 06 01]
================================================================
```

### Bluetooth LE Dry-Run Execution Summary
```
================================================================
       SP530E CONTROLLER HARDWARE DIAGNOSTIC HARNESS            
================================================================
 Transport Mode     : BLE
 Target BLE Address : Auto-scan / default
 Mode               : DRY-RUN (SIMULATED - NO PHYSICAL WRITES)
 Safety Limit       : 20% Brightness Cap Enforced
================================================================
✔ [PASS] 1. Connect Transport (Connected via BLE)
✔ [PASS] 2. Query State (Power: true, Bri: 20%, Mode: solid)
✔ [PASS] 3. Set Power ON (Wire Bytes: [53 50 00 01 00 01 01])
✔ [PASS] 4. Set Brightness 20% (Wire Bytes: [53 50 00 02 00 01 33])
✔ [PASS] 5a. Color RED (Wire Bytes: [53 50 00 04 00 03 FF 00 00])
✔ [PASS] 5b. Color GREEN (Wire Bytes: [53 50 00 04 00 03 00 FF 00])
✔ [PASS] 5c. Color BLUE (Wire Bytes: [53 50 00 04 00 03 00 00 FF])
✔ [PASS] 6. Effect Rainbow (Wire Bytes: [53 50 00 06 00 01 01])
================================================================
```

---

## 5. Live Hardware Validation Status

- **Read-Only Telemetry Query**: **CONFIRMED ON HARDWARE** (Empirically verified in Prompt 7; 428-byte packet decoded).
- **Physical Mutating Transmissions**: **PENDING EXPLICIT USER APPROVAL**.
- **Pending Live Verification Command**:
  ```powershell
  node --experimental-strip-types apps/test-harness/cli.ts --transport=wifi --host=192.168.86.34 --port=8587 --live
  ```
