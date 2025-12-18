# Jetson Rover Module - Receiver Setup Guide

## 📡 Test Messages Sent from GCS

**Status:** ✅ 5 test messages sent from GCS laptop to Rover module

Messages transmitted:
1. "HELLO ROVER - This is GCS Base Station"
2. "RTK Link Test - Message 2"
3. "LoRa communication working!"
4. "Ready for RTK corrections"
5. "Test complete - awaiting response"

---

## 🔧 Jetson Setup Instructions

### Step 1: Connect to Jetson

SSH into your Jetson:
```bash
ssh your-username@jetson-ip-address
```

### Step 2: Find the LoRa Module Port

```bash
# List USB serial devices
ls -l /dev/ttyUSB*
ls -l /dev/ttyACM*

# Usually it will be /dev/ttyUSB0
# Check dmesg for connection info
dmesg | tail -20
```

### Step 3: Install Required Packages

```bash
# Update packages
sudo apt update

# Install Python serial library
sudo apt install python3-serial -y

# Or using pip
pip3 install pyserial
```

### Step 4: Create Test Receiver Script

Create a file called `receive-lora-test.py`:

```bash
nano ~/receive-lora-test.py
```

Paste this code:

```python
#!/usr/bin/env python3
import serial
import sys
from datetime import datetime

# Configure your serial port
PORT = '/dev/ttyUSB0'  # Change if needed
BAUD = 9600

try:
    # Open serial port
    port = serial.Serial(PORT, BAUD, timeout=1)
    print(f"Listening on {PORT} at {BAUD} baud...")
    print("Waiting for messages from GCS...")
    print("Press Ctrl+C to exit\n")
    print("-" * 60)

    while True:
        if port.in_waiting > 0:
            # Read available data
            data = port.read(port.in_waiting)

            # Try to decode as text
            try:
                message = data.decode('utf-8', errors='ignore').strip()
                if message:
                    timestamp = datetime.now().strftime('%H:%M:%S')
                    print(f"[{timestamp}] Received: {message}")
            except:
                print(f"Received {len(data)} bytes (binary data)")

except KeyboardInterrupt:
    print("\n\nExiting...")
except Exception as e:
    print(f"Error: {e}")
    print("\nTroubleshooting:")
    print("1. Check if port exists: ls -l /dev/ttyUSB*")
    print("2. Add user to dialout group: sudo usermod -a -G dialout $USER")
    print("3. Logout and login again")
    print("4. Check permissions: ls -l /dev/ttyUSB0")
finally:
    if 'port' in locals() and port.is_open:
        port.close()
```

Save and exit (Ctrl+X, Y, Enter)

### Step 5: Make Script Executable

```bash
chmod +x ~/receive-lora-test.py
```

### Step 6: Fix Permissions (if needed)

```bash
# Add your user to dialout group for serial port access
sudo usermod -a -G dialout $USER

# Logout and login again for group changes to take effect
# OR just temporarily change port permissions:
sudo chmod 666 /dev/ttyUSB0
```

### Step 7: Run the Receiver

```bash
python3 ~/receive-lora-test.py
```

**You should now see the 5 test messages that were sent from GCS!**

---

## ✅ Expected Output

If everything is working, you should see:

```
Listening on /dev/ttyUSB0 at 9600 baud...
Waiting for messages from GCS...
Press Ctrl+C to exit

------------------------------------------------------------
[14:23:45] Received: HELLO ROVER - This is GCS Base Station
[14:23:46] Received: RTK Link Test - Message 2
[14:23:47] Received: LoRa communication working!
[14:23:48] Received: Ready for RTK corrections
[14:23:49] Received: Test complete - awaiting response
```

---

## 🧪 Interactive Testing

### On GCS (Windows):
```powershell
cd D:\DYX-GCS-Mobile
.\test-lora-connection.ps1 -ComPort COM17 -Mode Send -BaudRate 9600
```

### On Jetson (Linux):
```bash
python3 ~/receive-lora-test.py
```

Now type messages on GCS - they should appear on Jetson in real-time!

---

## 🛰️ RTK Forwarder Script for Jetson

Once basic communication is confirmed, create the RTK forwarder:

```bash
nano ~/rtk-forwarder.py
```

Paste this code:

```python
#!/usr/bin/env python3
"""
RTK Correction Data Forwarder
Receives RTCM3 data from LoRa module and forwards to GNSS receiver
"""

import serial
import time
from datetime import datetime

# Configuration
LORA_PORT = '/dev/ttyUSB0'    # LoRa module port
LORA_BAUD = 9600              # Must match LoRa configuration

GNSS_PORT = '/dev/ttyACM0'    # GNSS receiver port (adjust for your receiver)
GNSS_BAUD = 115200            # GNSS receiver baud rate

# Statistics
total_bytes = 0
start_time = time.time()

try:
    # Open ports
    print("Opening LoRa receiver...")
    lora = serial.Serial(LORA_PORT, LORA_BAUD, timeout=0.1)

    print("Opening GNSS receiver...")
    gnss = serial.Serial(GNSS_PORT, GNSS_BAUD, timeout=0.1)

    print("\n" + "="*60)
    print("RTK Correction Forwarder Started")
    print("="*60)
    print(f"LoRa Input:  {LORA_PORT} @ {LORA_BAUD} baud")
    print(f"GNSS Output: {GNSS_PORT} @ {GNSS_BAUD} baud")
    print("\nForwarding RTK corrections...")
    print("Press Ctrl+C to exit\n")

    byte_count = 0
    last_print = time.time()

    while True:
        # Read from LoRa module
        if lora.in_waiting > 0:
            rtcm_data = lora.read(lora.in_waiting)

            # Forward to GNSS receiver
            gnss.write(rtcm_data)

            byte_count += len(rtcm_data)
            total_bytes += len(rtcm_data)

        # Print statistics every second
        if time.time() - last_print >= 1.0:
            if byte_count > 0:
                timestamp = datetime.now().strftime('%H:%M:%S')
                uptime = int(time.time() - start_time)
                print(f"[{timestamp}] RTK: {byte_count:4d} B/s | Total: {total_bytes:6d} bytes | Uptime: {uptime}s")

            byte_count = 0
            last_print = time.time()

except KeyboardInterrupt:
    print("\n\nShutting down...")
    uptime = int(time.time() - start_time)
    print(f"Total data forwarded: {total_bytes} bytes in {uptime} seconds")

except Exception as e:
    print(f"\nError: {e}")
    print("\nTroubleshooting:")
    print(f"1. Check LoRa port: ls -l {LORA_PORT}")
    print(f"2. Check GNSS port: ls -l {GNSS_PORT}")
    print("3. Verify port permissions")
    print("4. Check if ports are already in use: sudo lsof | grep ttyUSB")

finally:
    if 'lora' in locals() and lora.is_open:
        lora.close()
    if 'gnss' in locals() and gnss.is_open:
        gnss.close()
    print("Ports closed.")
```

Save and make executable:
```bash
chmod +x ~/rtk-forwarder.py
```

---

## 🚀 Running RTK Forwarder

```bash
# Run in foreground
python3 ~/rtk-forwarder.py

# Run in background
nohup python3 ~/rtk-forwarder.py > rtk-forwarder.log 2>&1 &

# View log
tail -f rtk-forwarder.log

# Stop background process
pkill -f rtk-forwarder.py
```

---

## 🐛 Troubleshooting on Jetson

### Port Not Found
```bash
# Check which port the LoRa module is on
ls -l /dev/tty*

# Check USB device info
lsusb
dmesg | grep tty
```

### Permission Denied
```bash
# Add user to dialout group
sudo usermod -a -G dialout $USER

# Logout and login again, OR:
sudo chmod 666 /dev/ttyUSB0
```

### No Data Received
```bash
# Test with simple serial monitor
screen /dev/ttyUSB0 9600

# Or with minicom
sudo apt install minicom
minicom -D /dev/ttyUSB0 -b 9600
```

### Check if Port is in Use
```bash
sudo lsof | grep ttyUSB
# Kill any processes using the port
sudo pkill -f ttyUSB0
```

---

## 📊 Verify RTK is Working

After running the RTK forwarder, check your GNSS receiver status:

**Expected progression:**
1. **No RTK:** Single point positioning (accuracy ~2-5m)
2. **RTK Float:** Using corrections but not converged (~20-50cm)
3. **RTK Fixed:** Full RTK lock (accuracy ~2-5cm) ✅

**Check GNSS status:**
- Via GNSS receiver software/interface
- Check NMEA GGA messages for quality indicator:
  - 1 = GPS fix (no RTK)
  - 4 = RTK fixed
  - 5 = RTK float

---

## 🎯 Quick Command Reference

```bash
# Find LoRa module port
ls -l /dev/ttyUSB*

# Test receiver
python3 ~/receive-lora-test.py

# Run RTK forwarder
python3 ~/rtk-forwarder.py

# Check GNSS receiver output
cat /dev/ttyACM0

# Monitor system messages
dmesg -w
```

---

## ✅ Jetson Setup Checklist

- [ ] SSH connected to Jetson
- [ ] Python3 and pyserial installed
- [ ] LoRa module connected (check /dev/ttyUSB0)
- [ ] User added to dialout group
- [ ] Test receiver script created and working
- [ ] Received test messages from GCS
- [ ] RTK forwarder script created
- [ ] GNSS receiver connected
- [ ] RTK forwarder running
- [ ] GNSS showing RTK fixed status

---

**Status:** Test messages sent from GCS
**Next:** Run receive script on Jetson to confirm LoRa link

---

*Setup guide created: 2025-12-16*
