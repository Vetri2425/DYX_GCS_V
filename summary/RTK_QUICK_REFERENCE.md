# RTK API Quick Reference Guide

## 🚀 Quick Start

### Import Services
```typescript
import { useRoverTelemetry } from '../hooks/useRoverTelemetry';

const { services } = useRoverTelemetry();
```

---

## 📡 NTRIP Operations

### Start NTRIP Stream
```typescript
const response = await services.startNTRIPStream({
  host: 'caster.example.com',
  port: 2101,
  mountpoint: 'RTCM3',
  user: 'myuser',
  password: 'mypass'
});

// Response
{
  success: true,
  message: "NTRIP RTK stream started from caster.example.com:2101/RTCM3",
  source: "NTRIP",
  caster: {
    host: "caster.example.com",
    port: 2101,
    mountpoint: "RTCM3",
    user: "myuser",
    password: "mypass"
  }
}
```

### Stop NTRIP Stream
```typescript
const response = await services.stopNTRIPStream();

// Response
{
  success: true,
  message: "NTRIP RTK stream stopped successfully",
  source: "NTRIP"
}
```

---

## 📻 LoRa Operations

### Start LoRa Stream
```typescript
const response = await services.startLoRaStream();

// Response
{
  success: true,
  message: "LoRa RTK stream started successfully",
  source: "LoRa",
  status: {
    is_connected: true,
    is_running: true,
    status_message: "Streaming",
    messages_received: 0,
    bytes_received: 0,
    error_count: 0,
    connection_time: "2025-12-18T13:00:00.000000",
    uptime_seconds: 0
  }
}
```

### Stop LoRa Stream
```typescript
const response = await services.stopLoRaStream();

// Response
{
  success: true,
  message: "LoRa RTK stream stopped successfully",
  source: "LoRa"
}
```

---

## 🔄 Unified Operations

### Get RTK Status
```typescript
const status = await services.getRTKStatus();

// Response
{
  success: true,
  ntrip: {
    running: true,
    caster: {
      host: "caster.example.com",
      port: 2101,
      mountpoint: "RTCM3",
      user: "myuser",
      password: "mypass"
    },
    total_bytes: 245678
  },
  lora: {
    running: false,
    status: null
  }
}
```

### Stop All Streams
```typescript
const response = await services.stopAllRTKStreams();

// Response
{
  success: true,
  message: "RTK stream(s) stopped: NTRIP, LoRa"
}
```

---

## 🎯 Common Patterns

### NTRIP with Error Handling
```typescript
try {
  const response = await services.startNTRIPStream({
    host: 'caster.example.com',
    port: 2101,
    mountpoint: 'RTCM3',
    user: 'myuser',
    password: 'mypass'
  });

  if (response.success) {
    console.log('✅ NTRIP started:', response.message);
    console.log('📡 Caster:', response.caster);
  } else {
    console.error('❌ Failed:', response.message);
  }
} catch (error) {
  console.error('🔥 Error:', error.message);
}
```

### Switch from NTRIP to LoRa
```typescript
// Stop NTRIP first
await services.stopNTRIPStream();

// Start LoRa
const response = await services.startLoRaStream();

if (response.success) {
  console.log('✅ Switched to LoRa');
  console.log('📊 Status:', response.status);
}
```

### Poll RTK Status
```typescript
const pollStatus = async () => {
  const status = await services.getRTKStatus();

  if (status.ntrip.running) {
    console.log('📡 NTRIP Active');
    console.log('   Host:', status.ntrip.caster?.host);
    console.log('   Bytes:', status.ntrip.total_bytes);
  }

  if (status.lora.running) {
    console.log('📻 LoRa Active');
    console.log('   Messages:', status.lora.status?.messages_received);
    console.log('   Bytes:', status.lora.status?.bytes_received);
    console.log('   Errors:', status.lora.status?.error_count);
  }
};

// Poll every 3 seconds
setInterval(pollStatus, 3000);
```

### Emergency Stop All
```typescript
const emergencyStop = async () => {
  try {
    const response = await services.stopAllRTKStreams();
    console.log('🛑 Emergency stop:', response.message);
  } catch (error) {
    console.error('🔥 Emergency stop failed:', error);
  }
};
```

---

## 🔍 Response Types

### NTRIPStartResponse
```typescript
interface NTRIPStartResponse {
  success: boolean;
  message: string;
  source: 'NTRIP';
  caster?: {
    host: string;
    port: number;
    mountpoint: string;
    user: string;
    password: string;
  };
}
```

### LoRaStartResponse
```typescript
interface LoRaStartResponse {
  success: boolean;
  message: string;
  source: 'LoRa';
  status?: {
    is_connected: boolean;
    is_running: boolean;
    status_message: string;
    messages_received: number;
    bytes_received: number;
    error_count: number;
    connection_time: string;
    uptime_seconds: number;
  };
}
```

### RTKStatusResponse
```typescript
interface RTKStatusResponse {
  success: boolean;
  ntrip: {
    running: boolean;
    caster: NTRIPCasterInfo | null;
    total_bytes: number;
  };
  lora: {
    running: boolean;
    status: LoraRTKStatus | null;
  };
}
```

---

## ⚠️ Error Codes

| HTTP Code | Meaning | Solution |
|-----------|---------|----------|
| 200 | Success | Continue normally |
| 400 | Invalid parameters | Check host, port, mountpoint |
| 409 | Conflict | Stop other stream first |
| 500 | Server error | Check backend logs |

---

## 🎨 UI Integration Example

```typescript
const RTKControl = () => {
  const { services } = useRoverTelemetry();
  const [ntripRunning, setNtripRunning] = useState(false);
  const [loraRunning, setLoraRunning] = useState(false);

  const startNTRIP = async () => {
    const response = await services.startNTRIPStream({
      host: 'caster.example.com',
      port: 2101,
      mountpoint: 'RTCM3',
      user: 'user',
      password: 'pass'
    });
    setNtripRunning(response.success);
  };

  const stopNTRIP = async () => {
    await services.stopNTRIPStream();
    setNtripRunning(false);
  };

  const startLoRa = async () => {
    const response = await services.startLoRaStream();
    setLoraRunning(response.success);
  };

  const stopLoRa = async () => {
    await services.stopLoRaStream();
    setLoraRunning(false);
  };

  return (
    <View>
      <Button
        title={ntripRunning ? "Stop NTRIP" : "Start NTRIP"}
        onPress={ntripRunning ? stopNTRIP : startNTRIP}
      />
      <Button
        title={loraRunning ? "Stop LoRa" : "Start LoRa"}
        onPress={loraRunning ? stopLoRa : startLoRa}
      />
    </View>
  );
};
```

---

## 📋 Checklist for Production

- [ ] Backend endpoints configured correctly
- [ ] CORS enabled if cross-origin
- [ ] NTRIP credentials secured (not hardcoded)
- [ ] LoRa USB device permissions configured
- [ ] Error handling implemented in UI
- [ ] Status polling interval optimized (2-5 seconds recommended)
- [ ] Mutual exclusivity enforced
- [ ] GPS RTK fix type monitored (should be 6 for RTK fixed)
- [ ] Cleanup logic on component unmount
- [ ] User feedback for all operations

---

## 🐛 Troubleshooting

### NTRIP Connection Fails
```typescript
// Check credentials
console.log('Host:', params.host);
console.log('Port:', params.port);
console.log('Mountpoint:', params.mountpoint);

// Verify backend logs
// journalctl -u nrp-service -f
```

### LoRa Device Not Found
```typescript
// Check USB device
// lsusb | grep 1a86:7523

// Check permissions
// ls -l /dev/ttyUSB*
```

### Status Shows Incorrect State
```typescript
// Force refresh
const status = await services.getRTKStatus();
console.log('Force refresh:', status);
```

---

## 📚 Related Files

- **Types**: [src/types/rtk.ts](src/types/rtk.ts)
- **Config**: [src/config.ts](src/config.ts)
- **Services**: [src/hooks/useRoverTelemetry.ts](src/hooks/useRoverTelemetry.ts)
- **UI**: [src/components/missionreport/RTKInjectionScreen.tsx](src/components/missionreport/RTKInjectionScreen.tsx)
- **Full Docs**: [RTK_IMPLEMENTATION_COMPLETE.md](RTK_IMPLEMENTATION_COMPLETE.md)

---

**Last Updated**: 2025-12-18
**Version**: 1.0
**Status**: ✅ Production Ready
