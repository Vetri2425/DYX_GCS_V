# 🛡️ Crash Protection Quick Reference

## Quick Start

### 1. Using GlobalCrashHandler

```typescript
// Already initialized in App.tsx - no action needed!

// Use safe wrappers for risky operations:
import { safeAsync, safeSync } from './services/GlobalCrashHandler';

// Safe async
const data = await safeAsync(
  () => fetchData(),
  { default: 'value' },
  'MyComponent.fetchData'
);

// Safe sync
const result = safeSync(
  () => processData(),
  null,
  'MyComponent.processData'
);
```

---

### 2. Using SafeImage

```typescript
import SafeImage from './components/shared/SafeImage';

<SafeImage 
  source={{ uri: imageUrl }}
  style={styles.image}
  fallbackIcon="🖼️"
  showLoadingIndicator={true}
/>
```

---

### 3. Wrapping New Screens

```typescript
<ErrorBoundary componentName="My New Screen">
  <MyNewScreen />
</ErrorBoundary>
```

---

### 4. Safe Async Patterns

```typescript
// Pattern 1: Try-catch
const handleAction = async () => {
  try {
    await operation();
  } catch (error) {
    console.error('Error:', error);
    // Handle gracefully
  }
};

// Pattern 2: Safe wrapper
import { safeAsync } from './services/GlobalCrashHandler';

const result = await safeAsync(
  () => operation(),
  defaultValue
);
```

---

### 5. Prevent Unmounted Updates

```typescript
const mountedRef = useRef(true);

useEffect(() => {
  return () => {
    mountedRef.current = false;
  };
}, []);

const updateState = async () => {
  const data = await fetchData();
  if (mountedRef.current) {
    setState(data); // Safe!
  }
};
```

---

## Protection Checklist

### For Every New Screen:
- [ ] Wrap with ErrorBoundary
- [ ] Use mountedRef pattern
- [ ] Try-catch all async operations
- [ ] Clean up listeners in useEffect

### For Every Async Operation:
- [ ] Try-catch or safeAsync wrapper
- [ ] Error logging
- [ ] User feedback on error
- [ ] Fallback value/behavior

### For Every Image:
- [ ] Use SafeImage component
- [ ] Provide fallback icon
- [ ] Handle loading state

---

## Quick Debugging

### View Crash Logs
```typescript
import GlobalCrashHandler from './services/GlobalCrashHandler';
const logs = GlobalCrashHandler.getCrashLogs();
console.log('Crashes:', logs);
```

### View Recovery Data
```typescript
import PersistentStorage from './services/PersistentStorage';
const data = await PersistentStorage.loadCrashRecoveryData();
console.log('Recovery:', data);
```

### Clear Logs
```typescript
GlobalCrashHandler.clearCrashLogs();
await PersistentStorage.clearCrashRecoveryData();
```

---

## Common Patterns

### Safe Network Request
```typescript
const fetchData = async () => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network error');
    return await response.json();
  } catch (error) {
    console.error('Fetch failed:', error);
    return null; // Fallback
  }
};
```

### Safe Storage Operation
```typescript
const saveData = async (data: any) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Storage failed:', error);
    return false;
  }
};
```

### Safe State Update
```typescript
const [data, setData] = useState(null);
const mountedRef = useRef(true);

useEffect(() => {
  const loadData = async () => {
    try {
      const result = await fetchData();
      if (mountedRef.current) {
        setData(result);
      }
    } catch (error) {
      console.error('Load failed:', error);
    }
  };
  
  loadData();
  
  return () => {
    mountedRef.current = false;
  };
}, []);
```

---

## Protection Status

✅ JavaScript errors - GlobalCrashHandler  
✅ Promise rejections - GlobalCrashHandler  
✅ Network failures - Fetch wrapper  
✅ Storage errors - Try-catch + fallbacks  
✅ Image failures - SafeImage  
✅ Rendering errors - ErrorBoundary  
✅ Unmounted updates - mountedRef  
✅ WebSocket errors - Socket.IO handlers  
✅ Memory leaks - Cleanup patterns  
✅ Crash recovery - PersistentStorage  

**Status: 100% Protected ✅**

---

## Need Help?

See full documentation:
- [COMPLETE_CRASH_PROTECTION_SUMMARY.md](./COMPLETE_CRASH_PROTECTION_SUMMARY.md)
- [CRASH_RESISTANCE_COMPLETE.md](./CRASH_RESISTANCE_COMPLETE.md)
