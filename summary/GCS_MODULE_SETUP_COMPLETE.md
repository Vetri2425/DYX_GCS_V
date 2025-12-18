# GCS LoRa Module Configuration - COMPLETE ✅

## Setup Summary

**Date:** 2025-12-16
**Module:** eByte E22-900T22U
**Location:** India (865-867 MHz ISM band)
**COM Port:** COM17 (CH340 USB-Serial)
**Configuration Baud Rate:** 115200

---

## ✅ Configuration Applied

The following configuration has been successfully applied to your GCS (Ground Control Station) base module:

| Parameter | Value | Description |
|-----------|-------|-------------|
| **Module Address** | 0000 | Base station identifier |
| **Channel** | 15 | 865.125 MHz (India ISM band) |
| **UART Settings** | 9600,8,1,0,0 | 9600 baud, 8 data bits, no parity, 1 stop bit |
| **Air Data Rate** | 2400 bps | Balanced speed/range for RTK |
| **Transmission Power** | 20 dBm | Maximum legal in India |
| **Transmission Mode** | 0 | Transparent mode |
| **FEC** | Enabled | Forward Error Correction |
| **Network ID** | RTK1 | Network identifier |

---

## 🔧 Hardware Configuration

### Current State: CONFIGURATION MODE
- **M0:** HIGH (3.3V)
- **M1:** LOW (GND)
- **Status:** Configuration complete, ready to switch to normal mode

### Next: Switch to NORMAL OPERATION MODE

**To activate the configuration and start RTK operation:**

1. **Disconnect M0 from 3.3V, connect to GND (LOW)**
2. **Keep M1 connected to GND (LOW)**
3. **Power cycle the module** (unplug and replug USB)
4. **Module is now operational at 9600 baud for RTK data**

---

## 📡 Operating Specifications

### Frequency & Range
- **Frequency:** 865.125 MHz (Channel 15)
- **ISM Band:** 865-867 MHz (License-free in India)
- **Estimated Range:** 2-5 km (line of sight, with good antennas)
- **Urban Range:** 500m - 1.5 km

### Data Throughput
- **Air Data Rate:** 2400 bps
- **Actual Throughput:** ~300 bytes/sec
- **RTK Data Rate:** Supports 500-2000 bytes/sec RTCM3 messages

### Power & Compliance
- **TX Power:** 20 dBm (100 mW)
- **Compliant:** WPC India regulations for 865-867 MHz
- **Current Draw:** ~120-140 mA during transmission

---

## 🚀 Next Steps

### 1. Finalize GCS Module Hardware
```
Action: Switch M0 to LOW (GND)
Action: Power cycle module
Result: Module operational on COM17 at 9600 baud
```

### 2. Configure Rover Module (Jetson Side)
Use the same process but with these changes:
- **Module Address:** 0001 (instead of 0000)
- **All other settings:** IDENTICAL to GCS module
- **Configuration command:**
  ```powershell
  # On Jetson or rover computer
  .\configure-lora-module.ps1 -ComPort <ROVER_PORT> -ModuleType Rover -BaudRate 115200
  ```

### 3. Test Communication
After both modules are in Normal Mode:

**On GCS (COM17):**
```powershell
.\test-lora-connection.ps1 -ComPort COM17 -Mode Send -BaudRate 9600
```

**On Rover:**
```powershell
.\test-lora-connection.ps1 -ComPort <ROVER_PORT> -Mode Receive -BaudRate 9600
```

### 4. Integrate with RTK System

**GCS Side (NTRIP to LoRa):**
```
NTRIP Client → RTCM3 Data → Serial Port (COM17, 9600 baud) → LoRa Transmission
```

**Rover Side (LoRa to GNSS):**
```
LoRa Reception → Serial Port (9600 baud) → GNSS Receiver RTK Input → RTK Fixed Position
```

---

## 🐛 Troubleshooting

### If module doesn't respond after switching to Normal Mode:
1. Verify M0 and M1 are both connected to GND
2. Power cycle the module
3. Check that you're connecting at **9600 baud** (not 115200)
4. Configuration mode uses 115200, Normal mode uses 9600

### To reconfigure the module:
1. Set M0 to HIGH (3.3V), M1 to LOW (GND)
2. Power cycle
3. Connect at 115200 baud
4. Resend configuration commands

### To query current configuration:
```powershell
# Module must be in Configuration Mode (M0=HIGH, M1=LOW)
.\verify-config.ps1 -ComPort COM17 -BaudRate 115200
```

---

## 📋 Quick Reference Commands

### Configuration Mode (M0=HIGH, M1=LOW, 115200 baud):
```powershell
# Auto-detect baud rate
.\auto-detect-baud.ps1 -ComPort COM17

# Configure GCS module
.\configure-gcs-now.ps1 -ComPort COM17 -BaudRate 115200

# Verify configuration
.\verify-config.ps1 -ComPort COM17 -BaudRate 115200
```

### Normal Mode (M0=LOW, M1=LOW, 9600 baud):
```powershell
# Send test messages
.\test-lora-connection.ps1 -ComPort COM17 -Mode Send -BaudRate 9600

# Receive test messages
.\test-lora-connection.ps1 -ComPort COM17 -Mode Receive -BaudRate 9600
```

---

## 📊 Module Modes Summary

| Mode | M0 | M1 | Baud Rate | Purpose |
|------|----|----|-----------|---------|
| **Configuration** | HIGH | LOW | 115200 | Send AT commands |
| **Normal** | LOW | LOW | 9600 | RTK data transmission |
| **WOR (Wake on Radio)** | LOW | HIGH | 9600 | Power saving mode |
| **Deep Sleep** | HIGH | HIGH | - | Ultra low power |

---

## ✅ Configuration Checklist - GCS Module

- [x] Found COM port (COM17)
- [x] Detected configuration baud rate (115200)
- [x] Set module address to 0000
- [x] Set channel to 15 (865 MHz)
- [x] Set UART to 9600 baud
- [x] Set air data rate to 2400 bps
- [x] Set power to 20 dBm
- [x] Enabled FEC
- [x] Set network ID to RTK1
- [x] Saved configuration
- [ ] **PENDING:** Switch to Normal Mode (M0=LOW, M1=LOW)
- [ ] **PENDING:** Power cycle module
- [ ] **PENDING:** Test at 9600 baud

---

## 🔄 Rover Module Configuration (TODO)

When you're ready to configure the Rover module on Jetson:

1. Connect rover module to Jetson via USB-Serial
2. Find COM port (likely /dev/ttyUSB0 or similar on Linux)
3. Set M0=HIGH, M1=LOW
4. Run configuration with **ModuleType=Rover** (address will be 0001)
5. Switch to Normal Mode
6. Test communication between GCS and Rover

---

## 📞 Support Files Created

- `configure-lora-module.ps1` - Interactive configuration script
- `auto-detect-baud.ps1` - Auto-detect correct baud rate
- `configure-gcs-now.ps1` - Direct GCS configuration (no prompts)
- `verify-config.ps1` - Query module configuration
- `test-lora-connection.ps1` - Test communication between modules
- `LORA_RTK_CONFIGURATION.md` - Complete technical reference
- `LORA_POWERSHELL_GUIDE.md` - PowerShell usage guide

---

**Status:** GCS Module configuration COMPLETE ✅
**Next Action:** Switch hardware pins to Normal Mode (M0=LOW, M1=LOW) and power cycle

---

*Configuration completed: 2025-12-16*
*Location: India (865-867 MHz ISM band)*
*Compliance: WPC India regulations*
