# Quick Jetson LoRa Module Check via SSH

## 🔍 Step-by-Step Commands

### 1. SSH into Jetson
```bash
ssh your-username@jetson-ip-address
```

### 2. Check if LoRa module is detected
```bash
# List all USB serial devices
ls -l /dev/ttyUSB*

# Check recent USB connections
dmesg | grep -i "usb\|tty" | tail -20

# List all tty devices
ls -l /dev/tty* | grep USB
```

### 3. Check USB devices
```bash
# Show USB devices connected
lsusb

# Show detailed USB info
lsusb -v | grep -A 10 "CH340"
```

### 4. Test if port is accessible
```bash
# Give yourself permission (temporary)
sudo chmod 666 /dev/ttyUSB0

# Or add to dialout group (permanent)
sudo usermod -a -G dialout $USER
# Then logout and login again
```

### 5. Quick serial port test
```bash
# Install screen if not available
sudo apt install screen -y

# Listen on the port (Ctrl+A then K to exit)
screen /dev/ttyUSB0 9600
```

### 6. Python quick test (one-liner)
```bash
# Install pyserial if needed
sudo apt install python3-serial -y

# Quick receive test
python3 -c "import serial; p=serial.Serial('/dev/ttyUSB0',9600); print('Listening...');
while True:
    if p.in_waiting: print(p.read(p.in_waiting).decode('utf-8',errors='ignore'))"
```

---

## 📋 Expected Results

### If module is connected correctly:
```bash
$ ls -l /dev/ttyUSB*
crw-rw---- 1 root dialout 188, 0 Dec 16 14:30 /dev/ttyUSB0
```

### USB device should show:
```bash
$ lsusb
Bus 001 Device 003: ID 1a86:7523 QinHeng Electronics CH340 serial converter
```

### dmesg should show:
```bash
$ dmesg | tail -10
[12345.678] usb 1-2: new full-speed USB device number 3 using xhci_hcd
[12345.890] usb 1-2: New USB device found, idVendor=1a86, idProduct=7523
[12346.012] ch341 1-2:1.0: ch341-uart converter detected
[12346.134] usb 1-2: ch341-uart converter now attached to ttyUSB0
```

---

## 🚀 Quick Receive Test

Once you confirm the device exists, run this simple receive test:

```bash
# Create and run receiver in one command
cat > /tmp/test-receive.py << 'EOF'
#!/usr/bin/env python3
import serial
try:
    p = serial.Serial('/dev/ttyUSB0', 9600, timeout=1)
    print("Listening on /dev/ttyUSB0 at 9600 baud...")
    print("Press Ctrl+C to exit\n")
    while True:
        if p.in_waiting > 0:
            data = p.read(p.in_waiting).decode('utf-8', errors='ignore')
            print(f"Received: {data}")
except KeyboardInterrupt:
    print("\nExiting...")
except Exception as e:
    print(f"Error: {e}")
EOF

python3 /tmp/test-receive.py
```

---

## ⚠️ Common Issues

### Port not found
```bash
# Check if USB cable is connected
lsusb

# Check kernel messages
dmesg -w
# Then plug/unplug the USB
```

### Permission denied
```bash
sudo chmod 666 /dev/ttyUSB0
```

### Port already in use
```bash
# Check what's using it
sudo lsof | grep ttyUSB

# Kill the process
sudo pkill -f ttyUSB0
```

### CH340 driver not loaded
```bash
# Check if driver is loaded
lsmod | grep ch341

# Load driver manually
sudo modprobe ch341
```

---

## ✅ Ready to Receive Test Messages

Once the device is confirmed working, you should receive the test messages that were sent from GCS:

1. "HELLO ROVER - This is GCS Base Station"
2. "RTK Link Test - Message 2"
3. "LoRa communication working!"
4. "Ready for RTK corrections"
5. "Test complete - awaiting response"

If you need more messages sent from GCS, just let me know!

---

**Quick copy-paste commands:**

```bash
# All-in-one check
ls -l /dev/ttyUSB* && sudo chmod 666 /dev/ttyUSB0 && python3 -c "import serial; p=serial.Serial('/dev/ttyUSB0',9600); print('Listening...'); exec('while True:\n if p.in_waiting: print(p.read(p.in_waiting).decode(\"utf-8\",errors=\"ignore\"))')"
```
