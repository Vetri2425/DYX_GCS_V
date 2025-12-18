# LoRa Module Configuration for RTK Injection
## eByte E22-900T22U Module Setup

This guide provides AT commands to configure two eByte E22-900T22U LoRa modules for RTK correction data transmission between the Ground Control Station (GCS) and the Jetson-based rover.

---

## 📡 Module Overview

**Model:** eByte E22-900T22U
**Frequency Range:** 850-930 MHz
**Interface:** UART (Serial)
**Use Case:** RTK GNSS correction data injection from GCS to Rover

---

## 🔧 Hardware Connection

### Pin Configuration
```
E22-900T22U Module Pins:
- VCC  → 3.3V-5.5V power
- GND  → Ground
- TXD  → Connect to RX of your UART device
- RXD  → Connect to TX of your UART device
- AUX  → Auxiliary status pin (optional monitoring)
- M0   → Mode selection pin
- M1   → Mode selection pin
```

### Operating Modes (M0, M1 pins)
| M0 | M1 | Mode | Description |
|----|----|----|-------------|
| 0  | 0  | Normal Mode | Standard transmission/reception |
| 0  | 1  | WOR Mode | Wake-On-Radio (power saving) |
| 1  | 0  | Configuration Mode | AT command configuration |
| 1  | 1  | Deep Sleep | Ultra low power mode |

**To enter Configuration Mode:** Set M0=HIGH, M1=LOW

---

## ⚙️ Configuration Steps

### Step 1: Enter Configuration Mode

**Hardware Method:**
- Connect M0 to 3.3V (HIGH)
- Connect M1 to GND (LOW)
- Power cycle the module

**Software Method (if supported):**
```
AT+MODE=2
```

---

### Step 2: Base Station (GCS Side) Configuration

Connect to the module via serial terminal (115200 baud default for config mode):

```bash
# Reset to factory defaults (optional)
AT+RESET

# Set module address (GCS = Address 0)
AT+ADDR=0000

# Set channel (frequency)
# Channel 15 = 865.125 MHz (India ISM band - license free)
AT+CHANNEL=15

# Set UART configuration
# 9600 baud, 8N1 (suitable for NTRIP/RTK data)
AT+UART=9600,8,1,0,0

# Set Air Data Rate (lower = longer range, higher = faster data)
# 2.4 kbps is good for RTK (balance of speed and range)
AT+AIR=2400

# Set transmission power
# 20 dBm = maximum legal power in India (865-867 MHz band)
AT+POWER=20

# Set transmission mode
# Transparent transmission mode
AT+MODE=0

# Enable FEC (Forward Error Correction) for better reliability
AT+FEC=1

# Set network ID (must match on both modules)
AT+NETID=5678

# Save configuration
AT+SAVE

# Query configuration to verify
AT+CFG?
```

---

### Step 3: Rover Station (Jetson Side) Configuration

**Use identical settings except for address:**

```bash
# Reset to factory defaults (optional)
AT+RESET

# Set module address (Rover = Address 1)
AT+ADDR=0001

# Set channel (must match base station)
# Channel 15 = 865.125 MHz (India ISM band)
AT+CHANNEL=15

# Set UART configuration (must match)
AT+UART=9600,8,1,0,0

# Set Air Data Rate (must match)
AT+AIR=2400

# Set transmission power (max for India)
AT+POWER=20

# Set transmission mode
AT+MODE=0

# Enable FEC
AT+FEC=1

# Set network ID (must match base station)
AT+NETID=5678

# Save configuration
AT+SAVE

# Query configuration to verify
AT+CFG?
```

---

### Step 4: Switch to Normal Operation Mode

**Hardware Method:**
- Connect M0 to GND (LOW)
- Connect M1 to GND (LOW)
- Power cycle the module

**Software Method:**
```
AT+MODE=0
```

---

## 📋 Complete AT Command Reference

### Basic Commands
```bash
AT              # Test command (returns OK)
AT+RESET        # Reset to factory defaults
AT+SAVE         # Save current configuration to flash
AT+CFG?         # Query current configuration
AT+VER?         # Query firmware version
```

### Address Configuration
```bash
AT+ADDR=XXXX    # Set module address (0000-FFFF)
AT+ADDR?        # Query current address
```

### Channel/Frequency
```bash
AT+CHANNEL=XX   # Set channel (0-83 for 900MHz band)
                # Frequency = 850.125 + CH * 1 MHz
                # Channel 23 = 873.125 MHz
                # Channel 65 = 915.125 MHz (ISM band)
AT+CHANNEL?     # Query current channel
```

### UART Settings
```bash
AT+UART=BAUD,PARITY,STOPBIT,DATABIT,FLOWCTRL
# BAUD: 1200,2400,4800,9600,19200,38400,57600,115200
# PARITY: 0=None, 1=Odd, 2=Even
# STOPBIT: 1 or 2
# DATABIT: 7 or 8
# FLOWCTRL: 0=None, 1=Hardware
AT+UART?        # Query UART settings
```

### Air Data Rate
```bash
AT+AIR=RATE     # Set air data rate
# Options: 1200, 2400, 4800, 9600, 19200, 38400, 62500
AT+AIR?         # Query air data rate
```

### Transmission Power
```bash
AT+POWER=XX     # Set TX power (10-22 dBm)
AT+POWER?       # Query TX power
```

### Network ID
```bash
AT+NETID=XXXX   # Set network ID (0-FFFF)
                # Only modules with same NETID communicate
AT+NETID?       # Query network ID
```

### FEC (Forward Error Correction)
```bash
AT+FEC=X        # 0=Disabled, 1=Enabled
AT+FEC?         # Query FEC status
```

---

## 🚀 Recommended RTK Configuration

### For Best Range (Lower Data Rate)
```bash
AT+ADDR=0000          # GCS: 0000, Rover: 0001
AT+CHANNEL=15         # 865 MHz ISM band (India)
AT+UART=9600,8,1,0,0
AT+AIR=1200           # Slower air rate = longer range
AT+POWER=20           # Max for India: 20 dBm
AT+FEC=1
AT+NETID=RTK1
AT+SAVE
```

### For Faster Data Transfer (Shorter Range)
```bash
AT+ADDR=0000          # GCS: 0000, Rover: 0001
AT+CHANNEL=15         # 865 MHz ISM band (India)
AT+UART=19200,8,1,0,0
AT+AIR=19200          # Faster air rate = higher throughput
AT+POWER=20           # Max for India: 20 dBm
AT+FEC=1
AT+NETID=RTK1
AT+SAVE
```

### For Balanced Performance (Recommended for India) ✅
```bash
AT+ADDR=0000          # GCS: 0000, Rover: 0001
AT+CHANNEL=15         # 865 MHz ISM band (India)
AT+UART=9600,8,1,0,0
AT+AIR=2400           # Good balance
AT+POWER=20           # Max for India: 20 dBm
AT+FEC=1
AT+NETID=RTK1
AT+SAVE
```

---

## 🔍 Testing the Connection

### 1. Serial Terminal Test

**On GCS (Base Station):**
```bash
# Open serial terminal at 9600 baud
# Type: Hello Rover
```

**On Rover (Jetson):**
```bash
# Open serial terminal at 9600 baud
# You should receive: Hello Rover
```

### 2. RTK Data Flow Test

**On GCS:**
- Connect to NTRIP caster
- Forward RTCM3 data to LoRa module serial port
- Monitor data transmission

**On Rover:**
- Read from LoRa module serial port
- Forward to GNSS receiver RTK input
- Check GNSS fix status (should show RTK FIXED)

---

## 🐛 Troubleshooting

### Module Not Responding to AT Commands
- ✅ Verify M0=HIGH, M1=LOW for config mode
- ✅ Check serial baud rate (default 115200 or 9600)
- ✅ Ensure proper TX/RX connections
- ✅ Power cycle the module

### No Communication Between Modules
- ✅ Verify both modules have same CHANNEL
- ✅ Verify both modules have same NETID
- ✅ Verify both modules have same AIR data rate
- ✅ Check antenna connections
- ✅ Verify modules are in Normal Mode (M0=LOW, M1=LOW)

### Poor Range/Signal
- ✅ Use external antennas with proper impedance match
- ✅ Increase transmission power to 22 dBm
- ✅ Lower air data rate (1200 or 2400 bps)
- ✅ Enable FEC
- ✅ Check for obstacles and interference

### RTK Data Not Working
- ✅ Verify UART baud rate matches RTK data source
- ✅ Check that air data rate is sufficient for RTCM3 data
- ✅ Monitor data throughput (RTCM3 needs ~500-2000 bps)
- ✅ Verify transparent transmission mode is active

---

## 📊 Data Rate Considerations for RTK

**RTCM3 Message Data Rates:**
- Basic RTK corrections: ~500-800 bytes/second
- Full constellation (GPS+GLONASS+Galileo): ~1500-2000 bytes/second

**Recommended Air Data Rates:**
- Minimum: 2400 bps (provides ~300 bytes/sec actual throughput)
- Recommended: 4800 bps (provides ~600 bytes/sec actual throughput)
- High performance: 9600 bps (provides ~1200 bytes/sec actual throughput)

**Note:** Air data rate must be higher than UART data rate due to protocol overhead.

---

## 🔐 Frequency Band Selection by Region

### Choose appropriate channel based on your location:

**USA (ISM Band):**
- Channel 65: 915.125 MHz

**Europe (ISM Band):**
- Channel 18: 868.125 MHz

**India (ISM Band):** ✅ **YOUR REGION**
- **Channel 15: 865.125 MHz** ✅ Recommended
- **Channel 16: 866.125 MHz** ✅ Alternative
- **Channel 17: 867.125 MHz** ✅ Alternative
- India uses 865-867 MHz ISM band (License-free)
- As per WPC (Wireless Planning and Coordination) India regulations
- Maximum permitted power: 20 dBm EIRP for 865-867 MHz

**Asia-Pacific (Other):**
- Check local regulations
- Typically 915-928 MHz range

**Important:** Always comply with local radio frequency regulations!

---

## 💡 Integration with Jetson

### Python Serial Example (Jetson Side)

```python
import serial
import time

# Configure serial port for LoRa module
lora_port = serial.Serial(
    port='/dev/ttyUSB0',  # Adjust to your serial port
    baudrate=9600,
    parity=serial.PARITY_NONE,
    stopbits=serial.STOPBITS_ONE,
    bytesize=serial.EIGHTBITS,
    timeout=1
)

# Read RTK data and forward to GNSS receiver
gnss_port = serial.Serial('/dev/ttyACM0', 115200)

while True:
    if lora_port.in_waiting > 0:
        rtk_data = lora_port.read(lora_port.in_waiting)
        # Forward to GNSS receiver
        gnss_port.write(rtk_data)
        print(f"Forwarded {len(rtk_data)} bytes to GNSS")
```

---

## ✅ Configuration Checklist

### GCS Module (Base Station)
- [ ] Module in configuration mode (M0=HIGH, M1=LOW)
- [ ] Address set to 0000
- [ ] Channel set to 15 (865 MHz - India ISM band)
- [ ] UART set to 9600,8,1,0,0
- [ ] Air data rate set to 2400 or higher
- [ ] Power set to 20 dBm (max legal in India)
- [ ] FEC enabled
- [ ] Network ID set (e.g., RTK1)
- [ ] Configuration saved
- [ ] Switched to normal mode (M0=LOW, M1=LOW)

### Rover Module (Jetson)
- [ ] Module in configuration mode (M0=HIGH, M1=LOW)
- [ ] Address set to 0001
- [ ] Channel set to 15 (865 MHz - match base station)
- [ ] UART set to 9600,8,1,0,0 (match base station)
- [ ] Air data rate set to 2400 (match base station)
- [ ] Power set to 20 dBm (max legal in India)
- [ ] FEC enabled
- [ ] Network ID set to RTK1 (match base station)
- [ ] Configuration saved
- [ ] Switched to normal mode (M0=LOW, M1=LOW)

---

## 📞 Support

If you encounter issues:
1. Verify all settings match between modules
2. Test with simple text data first
3. Monitor AUX pin status (HIGH = ready, LOW = busy)
4. Check module datasheet for specific firmware version commands

---

**Configuration Complete! Your LoRa modules are now ready for RTK injection.**
