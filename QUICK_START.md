# Quick Start Guide

## 30-Second Overview

The entire WebAuthn biometric flow is now simplified to 3 steps:

```typescript
// 1. Initialize once
FRService.init({ amBaseUrl: '...', clientId: '...' });

// 2. Start registration
const result = await Auth.registerWithBiometric('username');

// 3. Start authentication
const result = await Auth.authenticateWithBiometric('username');
```

That's it! The SDK handles the rest.

---

## Setup (5 minutes)

### Step 1: Update Configuration

Edit `src/auth/forgeRockService.ts`:

```typescript
export const DEFAULT_CONFIG = {
  amBaseUrl: 'https://YOUR_AM_SERVER/am',  // ← Update
  realm: 'YOUR_REALM',                     // ← Update
  clientId: 'YOUR_CLIENT_ID',              // ← Update
  redirectUri: 'YOUR_APP_URI:/oauth2redirect',
  registrationJourney: 'SignUp',           // Or your journey name
  authenticationJourney: 'SignIn',         // Or your journey name
};
```

### Step 2: Initialize in App.tsx

```typescript
import * as FRService from './src/auth/forgeRockService';
import { useEffect } from 'react';

export default function App() {
  useEffect(() => {
    // Initialize ONCE at app startup
    FRService.init();
    console.log('✅ ForgeRock initialized');
  }, []);

  return <YourAppContent />;
}
```

### Step 3: Use in Your Screens

```typescript
// Registration Screen
import * as Auth from './src/auth/examples';

export function SignUpScreen() {
  const handleRegister = async () => {
    const result = await Auth.registerWithBiometric(username);
    
    if (result.ok) {
      console.log('✅ Registered successfully!');
      navigation.navigate('Home');
    } else {
      console.error('❌ Registration failed:', result.error);
    }
  };

  return (
    // Your UI...
    <Button onPress={handleRegister}>Register with Biometric</Button>
  );
}
```

### Step 4: Build and Test

```bash
# Android
npx react-native run-android

# iOS
npx react-native run-ios
```

---

## Testing the Flow

### Manual Test

1. Open app
2. Enter username
3. Tap "Register with Biometric"
4. Biometric prompt appears
5. Authenticate with fingerprint/face
6. Success message shows
7. Session token received

### Console Logs (Debug)

```
✅ ForgeRock SDK initialized
🚀 Starting journey: rn-bio-register
📍 Step Type: FRStep
📦 Callbacks: NameCallback
📝 Filling callbacks...
  ✓ Setting username: ganesh
⏭️  Moving to next step...
🎯 WebAuthn callback detected
📤 Passing step to native bridge...
🔐 Native SDK: Extracting challenge → Calling FIDO2 → Showing biometric
📥 Received next step from native bridge
✅ Journey Complete
```

---

## Key Files to Know

| File | What it does |
|------|-------------|
| `src/auth/forgeRockService.ts` | Configuration & initialization |
| `src/auth/stepHandler.ts` | Main logic that processes each step |
| `src/auth/webAuthnHandler.ts` | Calls native bridge for WebAuthn |
| `src/auth/examples.ts` | Ready-to-use functions |
| `android/.../ForgeRockBridgeModule.java` | Android WebAuthn handler |
| `ios/.../ForgeRockBridge.swift` | iOS WebAuthn handler |

---

## Common Tasks

### Use Registration Journey
```typescript
const result = await Auth.registerWithBiometric(username);
```

### Use Authentication Journey
```typescript
const result = await Auth.authenticateWithBiometric(username);
```

### Get Current Session Token
```typescript
const token = FRService.getSessionToken();
```

### Logout
```typescript
await FRService.logout();
```

---

## Troubleshooting

### Biometric prompt doesn't appear
**Check:**
- Android device has at least one biometric enrolled
- iOS device has Face ID/Touch ID set up
- ForgeRock AM has WebAuthn node configured
- RP ID matches your domain

### "No WebAuthn callback found"
**Check:**
- Your AM journey includes WebAuthn nodes
- You're using the correct journey name
- ForgeRock SDK supports WebAuthn in your version

### Session token is undefined
**Check:**
- You completed the full journey (all steps)
- ForgeRock AM returned LoginSuccess step
- Token store is properly configured

### Biometric auth fails with "User cancelled"
**This is normal!** User is allowed to cancel. Handle gracefully:
```typescript
if (result.ok) {
  // Success
} else if (result.error?.includes('cancelled')) {
  // User cancelled biometric
} else {
  // Other error
}
```

---

## Architecture in One Picture

```
YOU (React Native)
    ↓
forgeRockService (Init & config)
    ↓
stepHandler (Process steps)
    ├─ Fill callbacks
    ├─ Detect WebAuthn?
    │  └─ Call webAuthnHandler
    │     └─ Call Native Bridge
    │        └─ Native SDK (FIDO2 / AuthenticationServices)
    │           ├─ Extract challenge
    │           ├─ Show biometric
    │           ├─ Create credential
    │           └─ Validate
    │        ← Returns next step
    │     ← Recurse
    │
    └─ Continue to next step
    ↓
Result (success / failure)
    ↓
YOU (show message)
```

---

## What's Happening Behind the Scenes

When WebAuthn is detected, here's what happens **automatically**:

### On Android:
```
ForgeRockBridgeModule.handleWebAuthn()
  ↓
ForgeRock SDK's WebAuthnRegistrationCallback.register()
  ├─ Extract challenge from callback
  ├─ Call Google Play Services FIDO2 API
  ├─ Show biometric prompt
  ├─ User authenticates
  ├─ Create attestation
  ├─ Validate
  └─ Continue journey to next step
ForgeRockBridgeModule returns next step
```

### On iOS:
```
ForgeRockBridge.handleWebAuthn()
  ↓
ForgeRock SDK's WebAuthnRegistrationCallback.authenticate()
  ├─ Extract challenge from callback
  ├─ Call AuthenticationServices API
  ├─ Show Face ID / Touch ID / Passkey UI
  ├─ User authenticates
  ├─ Create attestation
  ├─ Validate
  └─ Continue journey to next step
ForgeRockBridge returns next step
```

**You don't need to do any of this manually!** The SDK handles it all.

---

## Production Checklist

Before deploying:

- [ ] Update configuration with real AM server URL
- [ ] Update client ID, realm, journey names
- [ ] Replace in-memory token store with secure storage
- [ ] Add error handling and user feedback
- [ ] Add retry logic for network failures
- [ ] Test on real devices with biometric
- [ ] Test iOS 16.0+ for Passkeys
- [ ] Test Android with multiple biometric types
- [ ] Configure AM WebAuthn nodes properly
- [ ] Set RP ID to your actual domain
- [ ] Remove debug console.logs
- [ ] Add analytics/logging

---

## Need Help?

### Documentation
- Read `ARCHITECTURE.md` for complete details
- Read `src/auth/examples.ts` for usage patterns
- Read `src/auth/stepHandler.ts` for core logic

### Common Issues
1. **Biometric not showing:** Check device has biometric enrolled
2. **Session token undefined:** Ensure full journey completes
3. **WebAuthn callback not detected:** Verify AM journey config
4. **Bridge not found:** Rebuild native code with `npx react-native run-{android|ios}`

### Testing
```bash
# Run on Android
npx react-native run-android

# Run on iOS
npx react-native run-ios

# Check logs
npx react-native logs android
npx react-native logs ios
```

---

## Summary

✅ **Simple:** 3 lines to use  
✅ **Fast:** Set up in 5 minutes  
✅ **Secure:** SDK handles all security  
✅ **Works:** Registration + Authentication  
✅ **Reliable:** Proven ForgeRock architecture  

You're ready to integrate! 🚀
