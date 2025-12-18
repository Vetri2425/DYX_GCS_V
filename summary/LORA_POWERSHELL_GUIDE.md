# PowerShell Guide for LoRa Module Configuration

## 📋 Overview

This guide explains how to use PowerShell to configure and test your eByte E22-900T22U LoRa modules on Windows. Three PowerShell scripts are provided to make configuration easy.

---

## 🔧 Prerequisites

### 1. Find Your COM Port

**Method 1: Device Manager**
1. Press `Win + X` and select "Device Manager"
2. Expand "Ports (COM & LPT)"
3. Look for your USB-to-Serial adapter (e.g., "USB Serial Port (COM3)")
4. Note the COM port number

**Method 2: PowerShell**
```powershell
[System.IO.Ports.SerialPort]::GetPortNames()
```

### 2. Install USB-to-Serial Drivers (if needed)

If your module doesn't show up:
- **CH340/CH341 chip:** Download from [CH340 Driver](http://www.wch.cn/downloads/CH341SER_ZIP.html)
- **FTDI chip:** Download from [FTDI Driver](https://ftdichip.com/drivers/vcp-drivers/)
- **CP2102 chip:** Download from [Silicon Labs CP210x Driver](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers)

### 3. Hardware Setup

**Pin Connections:**
```
LoRa Module    →    USB-to-Serial Adapter
VCC (3.3-5V)  →    VCC/5V
GND           →    GND
TXD           →    RXD (Receive)
RXD           →    TXD (Transmit)
M0            →    Connect to 3.3V (config) or GND (normal)
M1            →    Connect to GND
```

---

## 📜 PowerShell Scripts

### Script 1: configure-lora-module.ps1
**Purpose:** Automatically configure a LoRa module with all settings

**Usage:**
```powershell
# Interactive mode (will prompt for settings)
.\configure-lora-module.ps1

# Specify parameters
.\configure-lora-module.ps1 -ComPort COM3 -ModuleType GCS -BaudRate 9600

# For Rover module
.\configure-lora-module.ps1 -ComPort COM5 -ModuleType Rover -BaudRate 9600
```

**Parameters:**
- `ComPort`: Your COM port (default: COM3)
- `ModuleType`: "GCS" or "Rover" (default: GCS)
- `BaudRate`: Baud rate for config mode (default: 9600)

---

### Script 2: query-lora-config.ps1
**Purpose:** Query and display current module configuration

**Usage:**
```powershell
.\query-lora-config.ps1 -ComPort COM3 -BaudRate 9600
```

**Requirements:**
- Module must be in **Configuration Mode** (M0=HIGH, M1=LOW)

---

### Script 3: test-lora-connection.ps1
**Purpose:** Test communication between two LoRa modules

**Usage:**

**On GCS computer (send mode):**
```powershell
.\test-lora-connection.ps1 -ComPort COM3 -Mode Send -BaudRate 9600
```

**On Rover/Jetson computer (receive mode):**
```powershell
.\test-lora-connection.ps1 -ComPort COM5 -Mode Receive -BaudRate 9600
```

**Requirements:**
- Both modules must be in **Normal Mode** (M0=LOW, M1=LOW)
- Both modules must be already configured with matching settings

---

## 🚀 Step-by-Step Configuration Process

### Step 1: Configure GCS Module

1. **Set module to Configuration Mode:**
   - Connect M0 to 3.3V (HIGH)
   - Connect M1 to GND (LOW)
   - Power cycle the module

2. **Run configuration script:**
   ```powershell
   cd D:\DYX-GCS-Mobile
   .\configure-lora-module.ps1 -ComPort COM3 -ModuleType GCS
   ```

3. **Follow the prompts:**
   - Confirm hardware setup
   - Wait for configuration to complete

4. **Switch to Normal Mode:**
   - Connect M0 to GND (LOW)
   - Connect M1 to GND (LOW)
   - Power cycle the module

---

### Step 2: Configure Rover Module

1. **Set module to Configuration Mode:**
   - Connect M0 to 3.3V (HIGH)
   - Connect M1 to GND (LOW)
   - Power cycle the module

2. **Run configuration script:**
   ```powershell
   cd D:\DYX-GCS-Mobile
   .\configure-lora-module.ps1 -ComPort COM5 -ModuleType Rover
   ```

3. **Follow the prompts**

4. **Switch to Normal Mode:**
   - Connect M0 to GND (LOW)
   - Connect M1 to GND (LOW)
   - Power cycle the module

---

### Step 3: Test Communication

1. **On GCS computer:**
   ```powershell
   .\test-lora-connection.ps1 -ComPort COM3 -Mode Send
   ```

2. **On Rover computer:**
   ```powershell
   .\test-lora-connection.ps1 -ComPort COM5 -Mode Receive
   ```

3. **Test the link:**
   - Type "Hello Rover" in the GCS terminal
   - Press Enter
   - Check if "Hello Rover" appears in the Rover terminal

---

## 🐛 Troubleshooting

### Problem: "Port not found" error

**Solutions:**
1. Check Device Manager for correct COM port
2. Close any other programs using the port (Arduino IDE, PuTTY, etc.)
3. Try unplugging and replugging the USB adapter

**Check with PowerShell:**
```powershell
[System.IO.Ports.SerialPort]::GetPortNames()
```

---

### Problem: "Access Denied" when opening port

**Solutions:**
1. Close other serial terminal programs
2. Run PowerShell as Administrator:
   - Right-click PowerShell
   - Select "Run as Administrator"

---

### Problem: No response to AT commands

**Checklist:**
- ✅ Module in Configuration Mode? (M0=HIGH, M1=LOW)
- ✅ Power cycled after setting pins?
- ✅ Correct COM port selected?
- ✅ Correct baud rate? (Try 9600 or 115200)
- ✅ TX/RX pins correctly connected? (crossed over)

**Try different baud rates:**
```powershell
# Try 115200
.\configure-lora-module.ps1 -ComPort COM3 -BaudRate 115200

# Or 9600
.\configure-lora-module.ps1 -ComPort COM3 -BaudRate 9600
```

---

### Problem: Modules not communicating in test

**Checklist:**
- ✅ Both modules in Normal Mode? (M0=LOW, M1=LOW)
- ✅ Both configured with same settings?
- ✅ Antennas connected?
- ✅ Modules powered on?

**Verify configurations:**
```powershell
# Set module to config mode, then:
.\query-lora-config.ps1 -ComPort COM3
```

---

## 💡 Manual AT Commands via PowerShell

If you prefer to send AT commands manually:

```powershell
# Open COM port
$port = New-Object System.IO.Ports.SerialPort
$port.PortName = "COM3"
$port.BaudRate = 9600
$port.Open()

# Send AT command
$port.WriteLine("AT")
Start-Sleep -Milliseconds 500

# Read response
$response = $port.ReadExisting()
Write-Host $response

# Send configuration command
$port.WriteLine("AT+CHANNEL=15")
Start-Sleep -Milliseconds 500
$response = $port.ReadExisting()
Write-Host $response

# Close port
$port.Close()
```

---

## 🔄 Configuration Settings Summary (India)

Both modules will be configured with:

| Parameter | Value | Description |
|-----------|-------|-------------|
| **GCS Address** | 0000 | Base station address |
| **Rover Address** | 0001 | Rover module address |
| **Channel** | 15 | 865.125 MHz (India) |
| **UART** | 9600,8,1,0,0 | 9600 baud, 8N1 |
| **Air Rate** | 2400 | 2.4 kbps air data rate |
| **Power** | 20 dBm | Max legal in India |
| **FEC** | Enabled | Error correction |
| **Network ID** | RTK1 | Network identifier |
| **Mode** | 0 | Transparent transmission |

---

## 🎯 Quick Reference Commands

```powershell
# List COM ports
[System.IO.Ports.SerialPort]::GetPortNames()

# Configure GCS module
.\configure-lora-module.ps1 -ComPort COM3 -ModuleType GCS

# Configure Rover module
.\configure-lora-module.ps1 -ComPort COM5 -ModuleType Rover

# Query configuration
.\query-lora-config.ps1 -ComPort COM3

# Test sending
.\test-lora-connection.ps1 -ComPort COM3 -Mode Send

# Test receiving
.\test-lora-connection.ps1 -ComPort COM5 -Mode Receive
```

---

## 📞 Additional Help

### Enable PowerShell Script Execution

If you get "script execution is disabled" error:

```powershell
# Run as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Check Script Help

```powershell
Get-Help .\configure-lora-module.ps1 -Detailed
```

---

## ✅ Success Indicators

**Configuration succeeded if you see:**
- ✅ "OK" responses to AT commands
- ✅ "Configuration Complete!" message
- ✅ Query shows correct settings

**Communication working if:**
- ✅ Messages sent from GCS appear on Rover
- ✅ No "timeout" errors
- ✅ Clear data reception

---

**You're now ready to configure your LoRa modules for RTK injection!**
