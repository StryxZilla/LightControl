# BanlanX APK Inventory & File Provenance

**Date**: 2026-10-27  
**Package**: `com.spled.scenex`  
**Application Label**: BanlanX  
**Source Device**: Android Emulator (`emulator-5554`)  
**Device OS**: Android 16 (Build 36, `sdk_gphone64_x86_64`)  
**On-Device Storage Path**: `/data/app/~~ulM99EfcL9AVCW2-ehfrYw==/com.spled.scenex-42pGodbKYMf9Iu01IPgfCQ==/`  
**Local Storage Path**: `G:\Light Test\research\apk\original\`  

---

## 1. File Inventory & Cryptographic Hashes

| File Name | Split Type | Size (Bytes) | SHA-256 Digest | MD5 Digest |
| :--- | :--- | :---: | :--- | :--- |
| **`base.apk`** | Base Application | 81,201,032 | `944af50ecb6db7fb2155bd1dfc71f570c4b004348e9bf359bdd588b8371e4e60` | `ca9e32de35a148722891927e906dd082` |
| **`split_config.arm64_v8a.apk`** | Native ABI (arm64) | 24,811,004 | `b094cb4cb5acb9d44090b2b35c178e1a1a835825e74c2b6606b6f4ee7f5f9595` | `68546c69b435fd11eef1c6342671a1ca` |
| **`split_config.en.apk`** | Localization (English) | 41,369 | `b64e806d308da3cd926d3440f19dce6acf0519e0f45d1579deaee5daffb374e4` | `bf0b1d6a08e604d2cf9cd872649bbda1` |
| **`split_config.es.apk`** | Localization (Spanish) | 29,081 | `2ee612d1367e71797f9a9797d2ddbb74bfc5c398fc24b4b532f3c9f2670536d1` | `853142e7bae6dd3275f2962d87fb681e` |
| **`split_config.xxhdpi.apk`** | Density Resources | 399,705 | `5e493ff29787056aa27a8137b7c67f0fe14b3428b78911a96481cbd60205d809` | `f3940c7b97a34a0175f9f38fc88a850b` |

**Total Pulled Size**: 106,482,191 bytes (~101.5 MB).

---

## 2. Provenance & Retrieval Details

- **Acquisition Timestamp**: `2026-10-27T12:34:33-05:00`
- **Acquisition Tool**: Android Debug Bridge (`adb` version `1.0.41`, revision `37.0.1-15733141`)
- **Transport Security**: Direct local USB/ADB socket link to authorized target device `emulator-5554`.
- **Integrity Verification**: Hashes calculated immediately post-transfer using standard SHA-256 and MD5 block streams.
- **Device State**: Device remained entirely unmodified. No APK was uninstalled, modified, or re-signed on the target device.

---

## 3. Source Control & Legal Compliance

> [!IMPORTANT]
> In strict accordance with `AGENTS.md` and clean-room engineering ethics:
> 1. All files in `research/apk/` and `research/decompiled/` are explicitly excluded from Git source tracking via `.gitignore`.
> 2. No proprietary binary APKs, dex files, or copyrighted assets shall ever be committed, published, or redistributed.
> 3. These files serve solely as local reference material for protocol interoperability verification.
