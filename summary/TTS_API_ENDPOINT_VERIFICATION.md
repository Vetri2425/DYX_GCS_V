# TTS Voice Control - API Endpoint Verification

## Overview
This document verifies that all TTS API endpoints are properly configured to receive responses from the backend.

---

## 1. API Endpoints Configuration

**File:** `src/config.ts` (Lines 68-75)

```typescript
// TTS Voice Control
TTS_STATUS: '/api/tts/status',
TTS_CONTROL: '/api/tts/control',
TTS_TEST: '/api/tts/test',
```

**Backend URL Configuration:**
```typescript
const BACKEND_FROM_ENV = process.env.REACT_APP_ROS_HTTP_BASE || 'http://192.168.1.24:5001';
export const BACKEND_URL = BACKEND_FROM_ENV;
```

**Full URLs will be constructed as:**
- `GET http://192.168.1.24:5001/api/tts/status`
- `POST http://192.168.1.24:5001/api/tts/control`
- `POST http://192.168.1.24:5001/api/tts/test`

---

## 2. Service Response Type Definition

**File:** `src/types/telemetry.ts` (Lines 100-107)

```typescript
export interface ServiceResponse {
  success: boolean;
  message?: string;
  error?: string;
  [key: string]: any;  // Allows additional fields like 'enabled', 'engine', etc.
}
```

This is the base type. Extended types for TTS:

```typescript
getTTSStatus: () => Promise<ServiceResponse & { 
  enabled?: boolean; 
  engine?: string; 
  language?: string 
}>;

controlTTS: (enabled: boolean) => Promise<ServiceResponse & { 
  enabled?: boolean 
}>;

testTTS: (message?: string) => Promise<ServiceResponse>;
```

---

## 3. HTTP Service Methods

**File:** `src/hooks/useRoverTelemetry.ts` (Lines 127-136)

### POST Service Method
```typescript
async function postService(path: string, body?: Record<string, unknown>): Promise<ServiceResponse> {
  return fetchJson<ServiceResponse>(`${DEFAULT_HTTP_BASE}${path}`, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}
```

**How it works:**
1. Takes endpoint path (e.g., `/api/tts/control`)
2. Constructs full URL: `http://192.168.1.24:5001/api/tts/control`
3. Sends POST request with JSON body
4. Parses response as ServiceResponse
5. Returns promise

### GET Service Method
```typescript
async function getService<T extends ServiceResponse = ServiceResponse>(path: string): Promise<T> {
  return fetchJson<T>(`${DEFAULT_HTTP_BASE}${path}`);
}
```

**How it works:**
1. Takes endpoint path (e.g., `/api/tts/status`)
2. Constructs full URL: `http://192.168.1.24:5001/api/tts/status`
3. Sends GET request
4. Parses response as ServiceResponse (or extended type)
5. Returns promise

### Fetch JSON Helper
```typescript
async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(path, {
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      ...init,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Request failed (${response.status}): ${text}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error('[fetchJson] Error:', error);
    throw error;
  }
}
```

**Error handling:**
- Checks response.ok (status 200-299)
- Throws error if not ok
- Tries to get error text from response body
- Logs all errors to console
- Re-throws error for caller to handle

---

## 4. TTS Service Method Implementations

**File:** `src/hooks/useRoverTelemetry.ts` (Lines 1045-1049)

### getTTSStatus()
```typescript
getTTSStatus: () => getService(API_ENDPOINTS.TTS_STATUS),
```

**Request:**
```
GET http://192.168.1.24:5001/api/tts/status
Content-Type: application/json
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "enabled": true,
  "engine": "piper",
  "language": "en",
  "bluetooth_warmup_enabled": true
}
```

**Response Handling in Component:**
```typescript
const response = await services.getTTSStatus?.();

if (response && response.success !== false) {
  setEnabled(response.enabled === true);
  await AsyncStorage.setItem(TTS_STORAGE_KEY, (response.enabled === true).toString());
}
```

### controlTTS(enabled: boolean)
```typescript
controlTTS: (enabled: boolean) =>
  postService(API_ENDPOINTS.TTS_CONTROL, { enabled }),
```

**Request:**
```
POST http://192.168.1.24:5001/api/tts/control
Content-Type: application/json

{
  "enabled": true
}
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "enabled": true,
  "message": "TTS voice output enabled"
}
```

**Response Handling in Component:**
```typescript
const response = await services.controlTTS?.(newState);

if (response && response.success) {
  setEnabled(newState);
  await AsyncStorage.setItem(TTS_STORAGE_KEY, newState.toString());
  Alert.alert('Success', newState ? 'Voice output enabled' : 'Voice output disabled');
} else {
  const errorMsg = response?.error || 'Failed to toggle TTS';
  Alert.alert('Error', errorMsg);
  setEnabled(enabled);  // Revert
}
```

### testTTS(message?: string)
```typescript
testTTS: (message?: string) =>
  postService(API_ENDPOINTS.TTS_TEST, { message: message || 'TTS voice test' }),
```

**Request:**
```
POST http://192.168.1.24:5001/api/tts/test
Content-Type: application/json

{
  "message": "TTS voice test"
}
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "message": "TTS test message queued"
}
```

---

## 5. TTSToggleButton Component API Flow

**File:** `src/components/shared/TTSToggleButton.tsx`

### Initialization Flow (useEffect)
```typescript
useEffect(() => {
  const initializeTTSState = async () => {
    try {
      // 1. Check AsyncStorage
      const savedState = await AsyncStorage.getItem(TTS_STORAGE_KEY);
      
      if (savedState !== null) {
        // Use saved preference
        setEnabled(savedState === 'true');
      } else {
        // Fetch from backend if no saved preference
        await fetchTTSStatusFromBackend();
      }
    } catch (error) {
      console.error('[TTSToggleButton] Failed to load initial state:', error);
      setEnabled(true);  // Default to enabled
    }
  };

  initializeTTSState();
}, []);
```

**Sequence:**
1. Component mounts
2. Check AsyncStorage for saved 'tts_enabled' value
3. If found: restore state from storage
4. If not found: call `fetchTTSStatusFromBackend()`
5. Backend returns current TTS status
6. Save response to AsyncStorage
7. Update component state

### Toggle Flow (API Call)
```typescript
const toggleTTS = async () => {
  const newState = !enabled;
  setLoading(true);  // Show spinner

  try {
    if (!services) {
      Alert.alert('Error', 'Services not available');
      return;
    }

    // Call API
    const response = await services.controlTTS?.(newState);

    if (response && response.success) {
      // Success path
      setEnabled(newState);
      await AsyncStorage.setItem(TTS_STORAGE_KEY, newState.toString());
      onStatusChange?.(newState);
      Alert.alert('Success', newState ? 'Voice output enabled' : 'Voice output disabled');
    } else {
      // Error path - API returned error response
      const errorMsg = response?.error || 'Failed to toggle TTS';
      Alert.alert('Error', errorMsg);
      setEnabled(enabled);  // Revert to previous state
    }
  } catch (error) {
    // Network/connection error
    const errorMessage = error instanceof Error ? error.message : 'Network error';
    Alert.alert('Error', `Failed to toggle voice output: ${errorMessage}`);
    setEnabled(enabled);  // Revert to previous state
  } finally {
    setLoading(false);  // Hide spinner
  }
};
```

**Sequence:**
1. User taps button
2. setLoading(true) → spinner appears
3. Call services.controlTTS(newState)
4. postService() constructs full URL and sends POST request
5. Backend processes request and returns response
6. Component checks response.success
7. If true: update state, save to AsyncStorage, show success
8. If false: show error, revert state
9. If network error: caught in catch block, show error, revert state
10. setLoading(false) → spinner disappears

---

## 6. Request/Response Flow Diagram

```
TTSToggleButton Component
        ↓
[User taps button]
        ↓
toggleTTS()
        ↓
services.controlTTS(enabled)
        ↓
postService(API_ENDPOINTS.TTS_CONTROL, {enabled})
        ↓
fetchJson(url, {method: 'POST', body, headers})
        ↓
fetch(http://192.168.1.24:5001/api/tts/control, options)
        ↓
[Network Request to Backend]
        ↓
Backend /api/tts/control endpoint
        ↓
Backend Response (JSON)
        ↓
response.json() → ServiceResponse object
        ↓
Check response.ok (status 200-299)
        ↓
Return Promise<ServiceResponse>
        ↓
Component receives response
        ↓
Check response.success
        ├─ true → Update state, save storage, show success
        ├─ false → Show error from response.error, revert state
        └─ thrown → Catch network error, show error, revert state
```

---

## 7. Error Scenarios

### Scenario 1: Successful Response
```
Request:  POST /api/tts/control {enabled: true}
Response: 200 OK
Body:     {success: true, enabled: true, message: "..."}
Result:   ✅ State updated, saved, success shown
```

### Scenario 2: API Error Response
```
Request:  POST /api/tts/control {enabled: true}
Response: 200 OK (or 400/500)
Body:     {success: false, error: "TTS service not available"}
Result:   ❌ State reverted, error shown
```

### Scenario 3: Network Error
```
Request:  POST /api/tts/control {enabled: true}
Response: Network timeout / unreachable
Error:    Network error thrown
Result:   ❌ State reverted, error shown
```

### Scenario 4: Malformed Response
```
Request:  POST /api/tts/control {enabled: true}
Response: 500 Internal Server Error
Body:     HTML error page or empty
Result:   ❌ Error thrown, caught in catch, state reverted
```

---

## 8. Request Headers

All requests include:
```
Content-Type: application/json
```

**Example POST request:**
```http
POST http://192.168.1.24:5001/api/tts/control HTTP/1.1
Host: 192.168.1.24:5001
Content-Type: application/json
Content-Length: 17

{"enabled":true}
```

**Example GET request:**
```http
GET http://192.168.1.24:5001/api/tts/status HTTP/1.1
Host: 192.168.1.24:5001
Content-Type: application/json
```

---

## 9. Verification Checklist

### Backend Endpoints Ready?
- [ ] `/api/tts/status` (GET) implemented
- [ ] `/api/tts/control` (POST) implemented
- [ ] `/api/tts/test` (POST) implemented

### Backend Response Format?
- [ ] All responses return JSON with `success` boolean
- [ ] Error responses include `error` field
- [ ] `getTTSStatus` returns `enabled`, `engine`, `language` fields
- [ ] `controlTTS` returns `enabled` field
- [ ] All responses follow ServiceResponse structure

### Frontend Ready?
- [ ] ✅ API endpoints configured in src/config.ts
- [ ] ✅ ServiceResponse types defined in src/types/telemetry.ts
- [ ] ✅ HTTP methods (getService/postService) implemented in src/hooks/useRoverTelemetry.ts
- [ ] ✅ Service methods (getTTSStatus/controlTTS/testTTS) added to RoverServices
- [ ] ✅ TTSToggleButton component properly calls API
- [ ] ✅ Error handling implemented at all levels
- [ ] ✅ Response parsing correct

---

## 10. Testing the API

### Test 1: Get Status
```bash
curl http://192.168.1.24:5001/api/tts/status
```

**Expected:**
```json
{
  "success": true,
  "enabled": true,
  "engine": "piper",
  "language": "en",
  "bluetooth_warmup_enabled": true
}
```

### Test 2: Toggle TTS
```bash
curl -X POST http://192.168.1.24:5001/api/tts/control \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

**Expected:**
```json
{
  "success": true,
  "enabled": false,
  "message": "TTS voice output disabled"
}
```

### Test 3: Test Voice
```bash
curl -X POST http://192.168.1.24:5001/api/tts/test \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello world"}'
```

**Expected:**
```json
{
  "success": true,
  "message": "TTS test message queued"
}
```

---

## 11. Response Handling Summary

| Endpoint | Method | Request | Response | Component Action |
|----------|--------|---------|----------|------------------|
| `/api/tts/status` | GET | None | `{success, enabled, engine, language}` | Set initial state |
| `/api/tts/control` | POST | `{enabled}` | `{success, enabled}` | Toggle state/show alert |
| `/api/tts/test` | POST | `{message}` | `{success, message}` | Optional testing |

---

## 12. Configuration Check

**Current Configuration:**
```typescript
BACKEND_URL = 'http://192.168.1.24:5001'
API_ENDPOINTS.TTS_STATUS = '/api/tts/status'
API_ENDPOINTS.TTS_CONTROL = '/api/tts/control'
API_ENDPOINTS.TTS_TEST = '/api/tts/test'
```

**Full URLs Generated:**
```
GET    http://192.168.1.24:5001/api/tts/status
POST   http://192.168.1.24:5001/api/tts/control
POST   http://192.168.1.24:5001/api/tts/test
```

**To change backend URL:**
```bash
# Set environment variable
REACT_APP_ROS_HTTP_BASE=http://new-host:5001
```

---

## Summary

✅ **All API endpoints properly configured**
✅ **All response types properly defined**
✅ **All HTTP methods properly implemented**
✅ **All error handling properly implemented**
✅ **Component properly calls and handles API responses**
✅ **Ready to test with backend**

---

**Verification Status:** COMPLETE ✅
**Backend Integration:** READY
**Frontend Implementation:** COMPLETE
**Next Step:** Test with actual backend responses
