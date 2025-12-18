# Jetson - LoRa Module Not Detected Troubleshooting

## Issue: `/dev/ttyUSB*` not found

This means the LoRa module is either not connected or not recognized by the Jetson.

---

## 🔍 Step 1: Check All Serial Devices

Run these commands on Jetson:

```bash
# Check for ANY tty devices
ls -l /dev/tty*

# Check specifically for ACM devices (some USB-Serial show as ACM)
ls -l /dev/ttyACM*

# List all USB devices
lsusb

# Check kernel messages for USB connections
dmesg | tail -30
```

---

## 🔌 Step 2: Physical Connection Check

### Check:
1. **Is the USB cable plugged into Jetson?**
2. **Is the LoRa module powered?** (LED should be on)
3. **Try a different USB port on Jetson**
4. **Try a different USB cable** (some cables are power-only, no data)

### Test USB port:
```bash
# Watch for USB connection events
dmesg -w

# Now plug/unplug the LoRa module USB cable
# You should see messages like:
# "usb 1-2: new full-speed USB device"
# "ch341-uart converter now attached to ttyUSB0"
```

---

## 🔍 Step 3: Check What's Connected

```bash
# Before plugging in LoRa module
lsusb > /tmp/before.txt

# Plug in LoRa module, wait 5 seconds

# After plugging in
lsusb > /tmp/after.txt

# Compare - this shows what was added
diff /tmp/before.txt /tmp/after.txt
```

---

## 🔍 Step 4: Check for CH340 Driver

The USB-Serial adapter is CH340. Check if driver is loaded:

```bash
# Check if CH340/CH341 driver is loaded
lsmod | grep ch34

# If not loaded, try loading it
sudo modprobe ch341

# Check again
lsmod | grep ch34

# Check kernel support
ls /lib/modules/$(uname -r)/kernel/drivers/usb/serial/

# Should see ch341.ko file
```

---

## 🔍 Step 5: Check dmesg for Errors

```bash
# Clear kernel ring buffer (optional)
sudo dmesg -c

# Plug in the LoRa module

# Check for USB messages
dmesg | grep -i "usb\|tty\|ch34\|serial"
```

### Expected output:
```
[  123.456] usb 1-2: new full-speed USB device number 3 using xhci_hcd
[  123.678] usb 1-2: New USB device found, idVendor=1a86, idProduct=7523
[  123.890] usb 1-2: New USB device strings: Mfr=0, Product=2, SerialNumber=0
[  124.012] usb 1-2: Product: USB Serial
[  124.234] ch341 1-2:1.0: ch341-uart converter detected
[  124.456] usb 1-2: ch341-uart converter now attached to ttyUSB0
```

### If you see errors like:
- "device descriptor read/64, error -71" → Bad cable or port
- "device not accepting address" → Power issue
- No messages at all → Cable not connected or power-only cable

---

## 🔍 Step 6: Alternative Device Names

The device might appear as something else:

```bash
# Check all serial ports
ls -l /dev/serial/by-id/
ls -l /dev/serial/by-path/

# Check for ttyACM (alternative USB-serial)
ls -l /dev/ttyACM*

# Check for ttyAMA (UART)
ls -l /dev/ttyAMA*

# Check for ttyTHS (Tegra High Speed UART)
ls -l /dev/ttyTHS*
```

---

## ⚡ Common Issues & Solutions

### Issue 1: Power Problem
**Symptom:** LoRa module LED not lit, or flickering

**Solution:**
```bash
# Check USB power
lsusb -v | grep -i "maxpower\|power"

# Try powered USB hub if Jetson USB power is insufficient
```

### Issue 2: Wrong USB Port
**Symptom:** Some Jetson USB ports don't work properly

**Solution:**
- Try all available USB ports on Jetson
- Avoid using USB hubs if possible
- Use USB 2.0 ports (better compatibility with CH340)

### Issue 3: Driver Not Loaded
**Symptom:** USB device detected but no /dev/ttyUSB*

**Solution:**
```bash
# Install USB serial drivers
sudo apt update
sudo apt install linux-modules-extra-$(uname -r)

# Load CH341 module
sudo modprobe ch341

# Make it load at boot
echo "ch341" | sudo tee -a /etc/modules
```

### Issue 4: Jetson Nano Specific
**Symptom:** Jetson Nano doesn't recognize CH340

**Solution:**
```bash
# Check Jetpack version
cat /etc/nv_tegra_release

# Update kernel (if needed)
sudo apt update
sudo apt upgrade

# Reboot
sudo reboot
```

---

## 🧪 Test with Known Working Device

To verify Jetson USB is working:

```bash
# Try a USB keyboard or mouse - does it work?
# Try a USB flash drive - does it mount?
lsblk

# If other USB devices work, but LoRa doesn't, likely:
# 1. Bad USB cable
# 2. LoRa module not powered
# 3. Wrong M0/M1 pin settings (shouldn't affect USB though)
```

---

## 🔧 Quick Fixes to Try

### Try 1: Replug with monitoring
```bash
# Open terminal and run:
dmesg -w

# In another terminal, or physically:
# 1. Unplug LoRa module
# 2. Wait 5 seconds
# 3. Plug it back in
# Watch the dmesg output
```

### Try 2: Check Jetson USB ports
```bash
# List all USB buses
lsusb -t

# This shows the USB hierarchy
```

### Try 3: Force driver reload
```bash
sudo rmmod ch341
sudo modprobe ch341
```

### Try 4: Check permissions
```bash
# See if udev rules are blocking
ls -l /etc/udev/rules.d/ | grep serial

# Check system logs
sudo journalctl -f
# Then plug in device
```

---

## 📋 Information to Collect

Please check and report:

```bash
# 1. What does lsusb show?
lsusb

# 2. What USB devices are currently connected?
ls -l /dev/tty*

# 3. What does dmesg show when you plug in?
dmesg | tail -50

# 4. Kernel version
uname -r

# 5. Jetson model
cat /etc/nv_tegra_release
```

---

## 🚨 If Still Not Working

### Option A: Use Jetson GPIO UART Instead
If USB-Serial won't work, you can connect LoRa module directly to Jetson GPIO UART pins:
- Jetson TX (pin 8) → LoRa RX
- Jetson RX (pin 10) → LoRa TX
- Jetson GND (pin 6) → LoRa GND
- Device will be `/dev/ttyTHS1` (or `/dev/ttyTHS0`)

### Option B: Try Another USB-Serial Adapter
- FTDI FT232 (better Linux support)
- CP2102 (good alternative)
- PL2303 (commonly supported)

---

## ✅ Once Device is Found

When you finally see `/dev/ttyUSB0` (or similar):

```bash
# Test it immediately
sudo chmod 666 /dev/ttyUSB0

# Quick listen test
cat /dev/ttyUSB0

# Or better, with Python
python3 -c "import serial; p=serial.Serial('/dev/ttyUSB0',9600); print('Listening...');
while True:
    if p.in_waiting: print(p.read(p.in_waiting).decode('utf-8',errors='ignore'))"
```

---

**Next Steps:**
1. Run the diagnostic commands above
2. Share the output of `lsusb` and `dmesg | tail -30`
3. We'll identify the issue and get the module working!
