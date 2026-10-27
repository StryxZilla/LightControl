# LightControl — Device Pairing & Connection Guide

This guide walks you through connecting and pairing your LED controllers with **LightControl** on Windows 10/11.

---

## Supported Hardware Overview

| Controller | Recommended Transport | Protocol / Port | Multi-Client |
| :--- | :--- | :--- | :--- |
| **BanlanX SP530E** | **Local Wi-Fi (LAN)** *(Recommended)* | TCP Socket (`port 8587`) | **Yes** (Multiple PCs/devices can connect) |
| **BanlanX SP530E** | **Bluetooth Low Energy (BLE)** | WinRT GATT Service `0xFFE0` | **No** (Strict 1-device limit) |
| **QuinLED dig2go** | **Local Wi-Fi (LAN)** | HTTP REST (`port 80`) + WebSocket (`/ws`) | **Yes** (Real-time bidirectional sync) |
| **Generic WLED** | **Local Wi-Fi (LAN)** | HTTP REST (`port 80`) + WebSocket (`/ws`) | **Yes** |

---

## 1. Connecting the BanlanX SP530E

### Method A: Local Wi-Fi (Recommended)
Local Wi-Fi control connects directly over your local area network (LAN) using port **8587**. It provides sub-50ms command latency and does **not** lock out other devices.

#### Step 1: Connect the SP530E to your Wi-Fi network (One-Time Setup)
If your SP530E is not yet on your home Wi-Fi:
1. Power on the SP530E (12V or 24V DC depending on your LED strip).
2. Open the **BanlanX** mobile app on your Android or iOS phone.
3. Tap **+** (Add Device) and follow the prompt to provision the SP530E to your **2.4 GHz** home Wi-Fi network (*Note: The SP530E Wi-Fi radio only supports 2.4 GHz, not 5 GHz*).
4. Once connected to Wi-Fi, the controller saves your network credentials permanently. **You do not need the mobile app anymore.**

#### Step 2: Find the SP530E's IP Address
You can locate your SP530E's local IP address using any of these methods:
- **Router DHCP List**: Log into your home router's admin panel and check the connected clients list for device hostnames like `SP530E`, `espressif`, or `spled` (e.g. `192.168.1.34`).
- **In LightControl**: Press `Ctrl+2` (Controllers & Transports) and click **Scan for Controllers**.
- **Mobile App**: In the BanlanX app, tap Device Settings ➔ Device Info to view the assigned IP.

#### Step 3: Connect in LightControl
1. In LightControl, navigate to **Controllers & Transports** (`Ctrl+2` or click the connection icon in the sidebar).
2. Under **Direct Network Connection**, click the **SP530E (TCP 8587)** toggle button.
3. Enter your controller's IP address (e.g., `192.168.1.34`) and leave port as `8587`.
4. Click **Connect Socket**.
5. Once connected, LightControl automatically queries the controller's firmware version, active IC type, pixel count, and power status.

---

### Method B: Bluetooth Low Energy (BLE)
If Wi-Fi is unavailable, LightControl can connect directly over Windows native Bluetooth Low Energy using its embedded WinRT BLE driver.

> [!IMPORTANT]
> **Strict Single-Client BLE Constraint**: The SP530E microcontroller supports only **one** active BLE connection at a time. If the BanlanX app is open on your phone or connected in the background, the controller will **not** advertise and Windows will be unable to discover or connect to it.
> 
> **You MUST force-close the BanlanX app or disable Bluetooth on your mobile phone before connecting from Windows.**

#### Step-by-Step BLE Pairing:
1. Ensure your Windows 10/11 PC has **Bluetooth turned ON** (`Settings` ➔ `Bluetooth & devices`).
2. Power on the SP530E and ensure your phone's Bluetooth is toggled **OFF**.
3. In LightControl, go to **Controllers & Transports** (`Ctrl+2`).
4. Click **Scan for Controllers**.
5. LightControl's background WinRT helper will scan for nearby controllers advertising Service UUID `0xFFE0`.
6. When the SP530E appears in the **Discovered Devices** list, click **Connect**.

---

## 2. Connecting QuinLED dig2go / WLED Controllers

The QuinLED dig2go runs official WLED firmware (Sound-Reactive ESP32). LightControl connects to it via HTTP port 80 and establishes a real-time WebSocket connection for sub-10ms state synchronization.

### Step 1: Initial Wi-Fi Setup (If Fresh Out of the Box)
If the dig2go has not yet been connected to your home Wi-Fi:
1. Plug the dig2go into a 5V 3A USB-C power source.
2. On your PC or phone, open available Wi-Fi networks and look for **`WLED-AP`**.
3. Connect to **`WLED-AP`** using the default password: **`wled1234`**.
4. In your web browser, navigate to **`http://4.3.2.1`** (or follow the captive portal prompt).
5. Click **Config** ➔ **WiFi Setup**.
6. Enter your home 2.4 GHz Wi-Fi SSID and password.
7. Click **Save & Connect**. The dig2go will reboot and join your home network.

### Step 2: Connect in LightControl
1. Connect your Windows PC to the same Wi-Fi or LAN network.
2. In LightControl, navigate to **Controllers & Transports** (`Ctrl+2`).
3. Under **Direct Network Connection**, click the **WLED / dig2go (HTTP 80)** toggle button.
4. Enter the controller's IP address (e.g. `192.168.1.50`) or mDNS hostname (`wled.local`). Port defaults to `80`.
5. Click **Connect WLED / dig2go**.
6. LightControl will:
   - Perform an initial HTTP handshake querying `/json/info` and `/json/state`.
   - Automatically detect QuinLED dig2go hardware and digital microphone audio capabilities.
   - Establish an RFC 6455 WebSocket (`/ws`) stream for instantaneous bidirectional state synchronization.

---

## 3. Configuring Your LED Strip (First Time Run)

Once connected, navigate to **Strip Configuration** in LightControl (or press `Ctrl+9` / click the gear icon in the sidebar) to configure your hardware properties:

1. **Pixel Count**: Enter the total number of addressable LEDs on your strip (e.g. `60`, `144`, `300`).
2. **LED Driver IC**:
   - `WS2812B / WS2811` (Most common 3-wire digital addressable strips).
   - `UCS1903`
   - `SK6812` (RGBW strips with dedicated white channel).
3. **Color Channel Order**:
   - Standard WS2812B strips use **GRB** order. If red and green appear swapped when testing colors, change this to **GRB** or **RGB**.

---

## 4. Hardware Safety Guardrails

- **20% Brightness Safety Limit**: LightControl enforces a **20% maximum brightness cap** by default. High-density addressable LED strips (like 60+ LEDs at full white) can draw over 2-3 Amps, which can overheat wiring or cause brownout resets on USB ports.
- **Adjusting Safety Limits**: If your LED strip is powered by an external dedicated power supply with sufficient amperage, you can increase or disable the safety brightness limit in **Application Settings** (`#app-settings`).
- **Dry-Run Mode**: In **Application Settings**, toggle *Dry-Run Mode* to inspect commands, opcodes, and hex logs in the **Diagnostics** screen without transmitting physical signals to your LEDs.

---

## 5. Troubleshooting & FAQ

### SP530E: "Connection Timed Out" on Local Wi-Fi
- **Check Subnet**: Make sure your PC and the SP530E are connected to the same router subnet (e.g. both on `192.168.1.x`).
- **Check 2.4 GHz Band**: The SP530E only works on 2.4 GHz. If your router uses separate 2.4 GHz and 5 GHz networks, ensure your PC can reach the 2.4 GHz devices (check for "AP Isolation" or "Client Isolation" settings in your router).
- **Verify IP**: Check your router's DHCP table to verify the SP530E's IP address has not changed. (Tip: Set a DHCP reservation or static IP in your router for convenience).

### SP530E: "Device Not Found" over Bluetooth (BLE)
- **Phone App Lockout**: Ensure the BanlanX mobile app is **completely closed** and not running in the background on your phone.
- **Toggle Bluetooth**: Turn Windows Bluetooth OFF and back ON in Windows Settings (`ms-settings:bluetooth`).
- **Distance**: Ensure your PC's Bluetooth antenna is within 15-20 feet of the controller.

### WLED / dig2go: "WebSocket Closed / HTTP Failed"
- **Ping Test**: Open PowerShell and run `ping <wled-ip>` (e.g. `ping 192.168.1.50`).
- **Web Interface Check**: Open `http://<wled-ip>` in your web browser. If the WLED web UI loads, LightControl can connect.
- **Firewall Prompt**: If Windows Firewall asks for permission on private networks, click **Allow Access**.

### How do I control multiple controllers at the same time?
- Go to the **Device Grouping** screen (`Ctrl+8`). You can create synchronized rooms (e.g., "Living Room", "Desk Setup") and adjust power, brightness, or color across all paired controllers simultaneously.
