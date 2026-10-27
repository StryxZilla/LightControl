# Protocol Reference Links & Research Bibliography

This document catalogs verified technical references, manufacturer documentation, open-source repositories, reverse-engineering analyses, and issue threads relevant to the **SP530E** and **WLED / QuinLED dig2go** platforms.

---

## 1. SP530E & BanlanX Ecosystem

### 1.1 Manufacturer Documentation & Manuals
* **SuperLightingLED SP530E Specifications**:  
  Technical product sheet and 5-in-1 capabilities.  
  [https://superlightingled.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFkGJg0IHyAa8_BRnuDZX7cqilyYtc0xoDd5Emv7WW2IEjO9T7vBB_0H-TveSUW47Kozmgf_sTfhIysKJwXae8uAhE3u1isBo_rjf-2SoRy9lcmykCm7h4hnt2DeCT6rg6PPJ9vZw1K5Z-OATHGkbOnOA==)
* **Sperll Official SP530E User Manual**:  
  Wiring diagrams, PWM/SPI limits, IC compatibility list, and operating modes.  
  [https://manuals.plus](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH0VTPmJa6uxbERIf5U_ofVYK9h9ikJJh67lTvAbasrG3hZUo9PRSJwbEW1ADN27cnWdbAc2losbQAIZlwRySyBu3_R6YGbAvgbP62CvPHshqReXKvuzjVoymI=)
* **LEDBE Technical Datasheet**:  
  Electrical parameters (20-85mA quiescent, 12A max), dimensions (78x56x20mm), pixel capacity.  
  [https://ledbe.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFuqCXfp1LwQxI37E9ooHqrbjFV49LYbocJhHlDyPmSz7RCfMC1c90jIkM3RbKxMamMVADyF0YeUiB-8dhAd9CYiq0pFpbxaViCi9bK7IFLtI7D8lQHOBNRdJTRYat6mI2j-zpNugT3_kfmAakX)
* **BanlanX Official App Setup & Pairing Guide**:  
  BLE discovery, 2.4GHz Wi-Fi provisioning, and cloud binding.  
  [https://banlanx.net](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGP9WJSx8jqXxyJ5ixThHuUHORJGW7YAEtQef_KY2tOO8ZShifT0llXHNOh4SHip8MrLlW3cF93Z-T2pVc606ArHeiGOBFiBhlpOHt-bVcJwtCUkExWKSHonkxyowQp-M-7thhQ)
* **Elektroda SP530E Teardown & ESP32-C3 Firmware Discussion**:  
  Hardware teardown confirming ESP32-C3 microcontroller architecture.  
  [https://elektroda.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHY3GBRaxpREpLvK2sWj3EorpIeaUqW1o2az5chmj3zX3yE5e0pEWar4_MtVGOSAI8PAkOWVTCRoNqXQDs7iweFkzmttF4YoJgoW1ERz9IPc0-XGojyb4Kv2zgVSgvUshRu6V5u2GMSQAM=)

### 1.2 Open-Source Reverse Engineering & Protocol Repositories
* **`monty68/uniled` (Universal Light Controller Integration)**:  
  Primary source of truth for Sperll/BanlanX reverse engineering in Home Assistant.  
  [https://github.com/monty68/uniled](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFac2EKA07URyU57SasQmD7Nc2Zpp1Qodyn58GKiCy_YcEuQEQd07u7ltoBMBtFqZxlZdNDVLMi2WXmhpOJtPxGt3Ll1UVIeYt58LpBP5iR4jsGBrTkYQ==)
  * SP530E Model Code (`0x4E`) Mapping: [uniled/lib/net/sp53x_54xe.py](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFu9vRP8sAk30oHkFsiKmeMXey-9k8590EiQxwy-EuwxCEOmpD9N-_ZZzoyep9qiZ_ebeIwGYkGPbCn0d5X0R8n-PpR7eMBSED_AxcVNB6G9VPJkswysrDW3m5XnmmhnHegHH-vIg==)
  * SPNET Framing & Port 8587: [uniled/lib/net/sp53x_54xe.py](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFfs9pRqO7pzjwRBKVXXUzZsc-Rwo7Xiaq_PKoVUiHwJdvQjplyOBe5MiroiguefgkmkM0uKtLWlIVxkh_Z0b7M1_fUwzDp7UmRQ8ZpIvuRvPJEZQdi_3C4b0h2Qx1BH638hQ==)
  * Issue #144 (SP530E power state config bug): [uniled/issues/144](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGINbddXZP3YvO5lxaYaJnUw0ML-Xu2usvMVjOaFx23OFLoEkb2PbwmAc4n9BOR0BMS3MiVrKiOVCerv3DympBc0mW7mDkZwVEdkD3f_ms55qHXw5TEQjQUkMk0po12)
  * Issue #138 (SP530E WS2805 RGB+CCT mixed output bug): [uniled/issues/138](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEmO0A36BYGEY9Tcqw0geXe-BD9z0Xilwxyqjcdi16troS7V2rOhm-2GM3CwbsInnHWFw5Dn3kd13s0WeUo7I7CSoEAUksBmNrATGZBpfhGAnhEoCzrlIa8weHGts31sZtACA==)
  * Single-Connection BLE Rule Documentation: [uniled wiki](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEsqnezHvGOjDLoNuXZoYLInlm-nwn_uTgLp1B8ryZ8Iy70Cbe-GaTWzJf4PjjSkSbu6tM-28pFpgoOdr5wFVJsE0PqTbJ43u80PSMmKfduY76sGt5jsJk=)
* **`phhusson/ha-banlanx` (BanlanX BLE Home Assistant Integration)**:  
  Direct BLE GATT control over `0xFFE0` / `0xFFE1`.  
  [https://github.com/phhusson/ha-banlanx](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFTMhS8qX1e9Cz1spiPl6o4Trw5l3hDczlBIOOxAn7nhS30sPgSjD7YV6xeQg2GExl9GcqYUWR2dFZtSh8GyhIPCDY0NjnqYnoKyRua14FrPuCGHMsn5Sqzm3hRDBzErC9n5w==)
* **`xevrion/wallglow`**:  
  Standalone Python tool implementing BanlanX BLE packet framing.  
  [https://github.com/xevrion/wallglow](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHXxmPxFERHcBAOqSknNgyb7dFsfUyx22eyONekvQukfRnm_b7hwtACVx_0JpCHNq9N0swqZsxwhPWTdn5-mazjsK1ZwhjTMxJjxCdCirGcyg8JnIETheul)

---

## 2. WLED & QuinLED dig2go

### 2.1 Official WLED Documentation
* **WLED JSON API Official Reference**:  
  State, Info, Effects, Palettes schemas, and POST updating rules.  
  [https://wled.ge/json](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH0WZZZ7qyrT9nWQhZakvXsJ169HpBwK6s52l82JW8BZnZMzXfRZudanZ4QqXuk03aQL3ZRwjVCrX1T3HMkXRCpN2wfVt8oDB_rAiUel0n8i32rNXz46XSYVdUm8aU=)
* **WLED WebSocket Interface (`/ws`)**:  
  Real-time state pushing, bi-directional commands, keepalive.  
  [https://wled.ge/ws](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEZdk0-zc6AjiPhO4HGeVWMj5ZRH0izuACrGJCIuQezLqsIsQ_lStLN634FVTzZAe5m2F474D9WLnHr4mDIHD5WpZwdDyZZHX4PedAfIWm6E8m6p2x09ntSM-NSEkikPw==)
* **WLED mDNS Discovery (`_wled._tcp`)**:  
  Zero-configuration local network discovery and hostname resolution.  
  [https://wled.ge/mdns](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGKIL-n-9n45q_2Fv_wKxNYoP5Z7lgsSYFG8kI9xCwgxI3BmaKPJBjLn71zQZ4paFrp-eNRrork5ppBesvgMVWNM8mbWcJ3uqfRwHjt7g6O76CYbL1xPwUK)
* **WLED Effects and Palettes Mapping**:  
  Index mapping for `fx` and `pal` parameters.  
  [https://wled.ge/effects](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHZCVgTHhv-tJaWU4gu51nYGAP6T9NxDAYNh4pHaVRuGgGxTQzSGTDLN3EAL-5fOI6-y5CnWVbNMjN1etAuqvXIFY3LTMAutq3VgK0U84ttamz-LvqcwRElJsYi)

### 2.2 QuinLED dig2go Hardware Documentation
* **QuinLED-Dig2GO Official Hardware Page (Quindor / Intermit.Tech)**:  
  Comprehensive electrical schematics, 5V level shifter details, USB-C 3A limits, and onboard MOSFET power relay.  
  [https://quinled.info/quinled-dig2go](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGpqDabTq7XNcODlIQ3wAsY1fcKJC9I2L4He6_ldai87JMylwNKFRagOIr3LI7LBWCtD4yLW7Xz44VjGd7dBsQ5xYrsYAvsl25PJXbs7gcetc9SOG4Dmz2dDV0=)
* **Dig2GO Technical Guide & Specs**:  
  ESP32-WROOM-32E, I2S digital microphone, expansion headers, form factor.  
  [https://dig2go.info](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFTuX0rXuIsIj4Bpav3HEqyepTGXkzj7mdeBpIzDn107n-UlnRlAemggHPNg6cqB_R88TnitCXNUgTgPhyTxBEnT-aTlSdt0WHz3Q==)
